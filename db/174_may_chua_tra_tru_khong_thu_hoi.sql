-- "Máy chưa trả" phải trừ máy mà phiếu xuất ghi không cần thu hồi.
--
-- Cột này đếm device_snapshot.status = 'NOT_RETURNED', nhưng 164 trên 171 máy
-- đó đã được đánh dấu không thu hồi ở phiếu xuất — xuất đi là xong, không ai
-- đòi. Chỉ 7 máy là phải đi đòi thật, trong khi 154 khách đang mang nhãn
-- "máy chưa trả" và cảnh báo MAY_CHUA_TRA oan.
--
-- v_telecom_customer cộng thẳng cột này nên sửa ở đây là cả hai màn hình đúng
-- theo.

create or replace view v_telecom_subscription as
 WITH don AS (
         SELECT sub.source_id AS sid,
            count(*) AS so_hoa_don_don_hang,
            max(COALESCE(i.period_end, i.issued_on)) AS moc_gan_nhat
           FROM subscription_snapshot sub
             JOIN invoice_snapshot i ON i.source = 'TELECOM'::source_system AND i.order_id = sub.order_ref AND i.status <> 'VOID'::text
          WHERE sub.source = 'TELECOM'::source_system AND sub.order_ref IS NOT NULL
          GROUP BY sub.source_id
        ), hd AS (
         SELECT i.subscription_source_id AS sid,
            count(*) AS so_hoa_don,
            count(*) FILTER (WHERE i.status = 'ISSUED'::text) AS hoa_don_dang_doi,
            round(sum(i.con_lai) FILTER (WHERE i.status = 'ISSUED'::text AND CURRENT_DATE > i.han_tra)) AS con_no,
            round(sum(i.con_lai) FILTER (WHERE i.status = 'ISSUED'::text AND CURRENT_DATE <= i.han_tra)) AS chua_toi_han,
            count(*) FILTER (WHERE i.status = 'UNPAYABLE'::text) AS hoa_don_mat,
            round(sum(i.con_lai) FILTER (WHERE i.status = 'UNPAYABLE'::text)) AS tien_mat,
            round(sum(i.paid_amount)) AS da_thu,
            max(i.period_end) AS ky_gan_nhat_den,
            max(CURRENT_DATE - i.han_tra) FILTER (WHERE i.status = 'ISSUED'::text) AS ngay_qua_han
           FROM v_telecom_invoice_due i
          WHERE i.status <> 'VOID'::text
          GROUP BY i.subscription_source_id
        ), may AS (
         SELECT device_snapshot.subscription_source_id AS sid,
            count(*) FILTER (WHERE device_snapshot.status = 'NOT_RETURNED'::text) AS may_chua_tra
           FROM device_snapshot
          WHERE device_snapshot.source = 'TELECOM'::source_system AND device_snapshot.subscription_source_id IS NOT NULL
            -- Máy phiếu xuất ghi không cần thu hồi thì không phải máy chưa trả.
            AND NOT (EXISTS (
              SELECT 1 FROM stock_move_snapshot sm
               WHERE sm.source = 'TELECOM'::source_system
                 AND sm.is_no_recall
                 AND ltrim(sm.device_code, '0') = ltrim(device_snapshot.imei, '0')
            ))
          GROUP BY device_snapshot.subscription_source_id
        ), ky_nay AS (
         SELECT fl.subscription_source_id AS sid,
            count(*) AS so_dong
           FROM fee_line_snapshot fl
          WHERE fl.source = 'TELECOM'::source_system AND fl.subscription_source_id IS NOT NULL AND make_date(fl.nam, fl.thang, 1) >= date_trunc('month'::text, CURRENT_DATE::timestamp with time zone)::date
          GROUP BY fl.subscription_source_id
        ), nguong AS (
         SELECT ( SELECT threshold.value::integer AS value
                   FROM threshold
                  WHERE threshold.key = 'ar_overdue_days'::text) AS qua_han,
            ( SELECT threshold.value::integer AS value
                   FROM threshold
                  WHERE threshold.key = 'invoice_grace_days'::text) AS an_han
        )
select s.source_id AS subscription_id,
    s.party_id,
    p.display_name AS khach,
    ps.customer_type AS loai_khach,
    customer_type_label(ps.customer_type) AS loai_khach_chu,
    ps.customer_group AS nhom_khach,
    s.service_type,
    s.plan_name AS goi,
    s.status AS trang_thai,
    s.monthly_price AS gia_thang,
    s.activated_on AS ngay_kich_hoat,
    s.terminated_on AS ngay_ngung,
    s.device_ref AS ma_may,
    COALESCE(hd.so_hoa_don, 0::bigint) AS so_hoa_don,
    COALESCE(hd.hoa_don_dang_doi, 0::bigint) AS hoa_don_dang_doi,
    COALESCE(hd.con_no, 0::numeric) AS con_no,
    COALESCE(hd.hoa_don_mat, 0::bigint) AS hoa_don_mat,
    COALESCE(hd.tien_mat, 0::numeric) AS tien_mat,
    COALESCE(hd.da_thu, 0::numeric) AS da_thu,
    hd.ky_gan_nhat_den,
    COALESCE(hd.ngay_qua_han, 0) AS ngay_qua_han,
    COALESCE(may.may_chua_tra, 0::bigint) AS may_chua_tra,
    COALESCE(CURRENT_DATE - hd.ky_gan_nhat_den, CURRENT_DATE - s.activated_on) AS ngay_khong_co_cuoc,
    array_remove(ARRAY[
        CASE
            WHEN COALESCE(hd.ngay_qua_han, 0) > (( SELECT nguong.qua_han
               FROM nguong)) AND NOT COALESCE(dl.la_dai_ly, false) THEN 'NO_QUA_HAN'::text
            ELSE NULL::text
        END,
        CASE
            WHEN COALESCE(hd.hoa_don_mat, 0::bigint) > 0 AND NOT COALESCE(dl.la_dai_ly, false) THEN 'KHONG_DOI_DUOC'::text
            ELSE NULL::text
        END,
        CASE
            WHEN s.status = 'ACTIVE'::text AND (CURRENT_DATE - GREATEST(hd.ky_gan_nhat_den, don.moc_gan_nhat, s.activated_on)) > (( SELECT nguong.an_han
               FROM nguong)) AND NOT COALESCE(dl.la_dai_ly, false) THEN 'THIEU_HOA_DON'::text
            ELSE NULL::text
        END,
        CASE
            WHEN s.status = 'ACTIVE'::text AND s.expire_on < CURRENT_DATE THEN 'HET_HAN'::text
            ELSE NULL::text
        END,
        CASE
            WHEN s.status = 'ACTIVE'::text AND (s.expire_on IS NULL OR s.expire_on >= CURRENT_DATE) AND COALESCE(ky_nay.so_dong, 0::bigint) = 0 AND NOT COALESCE((CURRENT_DATE - GREATEST(hd.ky_gan_nhat_den, don.moc_gan_nhat, s.activated_on)) > (( SELECT nguong.an_han
               FROM nguong)), false) AND NOT COALESCE(dl.la_dai_ly, false) THEN 'KHONG_RA_CUOC'::text
            ELSE NULL::text
        END,
        CASE
            WHEN COALESCE(may.may_chua_tra, 0::bigint) > 0 THEN 'MAY_CHUA_TRA'::text
            ELSE NULL::text
        END], NULL::text) AS canh_bao,
    ps.customer_code AS ma_khach,
    COALESCE(hd.chua_toi_han, 0::numeric) AS chua_toi_han,
    COALESCE(don.so_hoa_don_don_hang, 0::bigint) AS hoa_don_don_hang,
    COALESCE(dl.la_dai_ly, false) AS la_dai_ly
   FROM subscription_snapshot s
     LEFT JOIN party p ON p.id = s.party_id
     LEFT JOIN party_source ps ON ps.source = 'TELECOM'::source_system AND ps.source_customer_id = s.source_customer_id AND ps.status <> 'REJECTED'::text
     LEFT JOIN hd ON hd.sid = s.source_id
     LEFT JOIN may ON may.sid = s.source_id
     LEFT JOIN don ON don.sid = s.source_id
     LEFT JOIN v_telecom_sub_dai_ly dl ON dl.subscription_id = s.source_id
     LEFT JOIN ky_nay ON ky_nay.sid = s.source_id
  WHERE s.source = 'TELECOM'::source_system;
