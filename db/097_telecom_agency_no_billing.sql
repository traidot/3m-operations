-- Đại lý wifi cầm tay: mình không quản lý việc thu cước của họ.
--
-- Giống hệt luật đã chốt cho wifi cố định (086–089), chỉ khác chỗ nhận diện:
-- bên cố định là NGƯỜI TẠO hợp đồng, bên cầm tay là LOẠI KHÁCH — party_source
-- .customer_type = 'AGENCY'.
--
-- Đụng tới đâu:
--   cảnh báo tiền  NO_QUA_HAN, KHONG_DOI_DUOC, THIEU_HOA_DON, KHONG_RA_CUOC
--                  không bắn cho thuê bao của đại lý nữa
--   giữ nguyên     HET_HAN và MAY_CHUA_TRA — cái đầu là trạng thái thuê bao,
--                  cái sau là máy của 3M phải thu hồi, cả hai không phải cước
--   danh sách việc thu cước và dự kiến huỷ bỏ hẳn phần đại lý
--
-- Con số vẫn giữ trong view (hoá đơn bên CMS là có thật, xoá đi là mất dấu),
-- chỉ thôi đưa vào danh sách phải làm và thôi cộng vào tổng cần xử lý.
-- 1.152 thuê bao của 33 đại lý nằm trong diện này.

/** Thuê bao cầm tay có thuộc đại lý không. Đọc thẳng bảng gốc để khỏi vòng lặp
    phụ thuộc với v_telecom_subscription. */
create or replace view v_telecom_sub_dai_ly as
select s.source_id                        as subscription_id,
       ps.customer_type = 'AGENCY'        as la_dai_ly
  from subscription_snapshot s
  left join party_source ps
    on ps.source = 'TELECOM'
   and ps.source_customer_id = s.source_customer_id
   and ps.status <> 'REJECTED'
 where s.source = 'TELECOM';

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
 SELECT s.source_id AS subscription_id,
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

/* Khách: bỏ luôn chỗ tự gắn NO_QUA_HAN ở mức khách cho đại lý, và bày cờ ra
   ngoài để màn hình biết đường giấu các ô cước. */
create or replace view v_telecom_customer as
 WITH cb AS (
         SELECT s_1.party_id,
            array_agg(DISTINCT u.cb) AS canh_bao
           FROM v_telecom_subscription s_1,
            LATERAL unnest(s_1.canh_bao) u(cb)
          WHERE s_1.party_id IS NOT NULL
          GROUP BY s_1.party_id
        ), ma AS (
         SELECT party_source.party_id,
            string_agg(DISTINCT party_source.customer_code, ', ' ORDER BY party_source.customer_code) AS ma_khach,
            array_agg(party_source.source_customer_id ORDER BY party_source.source_customer_id) AS ma_nguon,
            max(party_source.customer_type) AS loai_khach,
            max(party_source.customer_group) AS nhom_khach
           FROM party_source
          WHERE party_source.source = 'TELECOM'::source_system AND party_source.status <> 'REJECTED'::text
          GROUP BY party_source.party_id
        )
 SELECT p.id AS party_id,
    COALESCE(p.display_name, 'khách chưa có tên') AS khach,
    p.phone_norm AS dien_thoai,
    ma.loai_khach,
    customer_type_label(ma.loai_khach) AS loai_khach_chu,
    ma.nhom_khach,
    count(s.subscription_id) AS so_thue_bao,
    count(*) FILTER (WHERE s.trang_thai = 'ACTIVE'::text) AS dang_chay,
    array_agg(DISTINCT s.service_type) FILTER (WHERE s.service_type IS NOT NULL) AS dich_vu,
    COALESCE(n.da_thu, 0::numeric) AS da_thu,
    COALESCE(n.con_no, 0::numeric) AS con_no,
    COALESCE(n.tien_mat, 0::numeric) AS tien_mat,
    COALESCE(sum(s.may_chua_tra), 0::bigint::numeric) AS may_chua_tra,
    COALESCE(n.ngay_qua_han, 0) AS ngay_qua_han,
    n.ky_gan_nhat_den,
        CASE
            WHEN COALESCE(n.con_no, 0::numeric) > 0::numeric
             AND ma.loai_khach IS DISTINCT FROM 'AGENCY'::text
             AND NOT ('NO_QUA_HAN'::text = ANY (COALESCE(cb.canh_bao, '{}'::text[])))
            THEN COALESCE(cb.canh_bao, '{}'::text[]) || 'NO_QUA_HAN'::text
            ELSE COALESCE(cb.canh_bao, '{}'::text[])
        END AS canh_bao,
    ma.ma_khach,
    COALESCE(n.chua_toi_han, 0::numeric) AS chua_toi_han,
    ( SELECT array_agg(telecom_url('khach', v.v)) FROM unnest(ma.ma_nguon) v(v)) AS link_cms,
    COALESCE(n.phai_hoan, 0::numeric) AS phai_hoan,
    ma.loai_khach = 'AGENCY'::text AS la_dai_ly
   FROM party p
     JOIN ma ON ma.party_id = p.id
     LEFT JOIN v_telecom_subscription s ON s.party_id = p.id
     LEFT JOIN cb ON cb.party_id = p.id
     LEFT JOIN v_telecom_party_debt n ON n.party_id = p.id
  GROUP BY p.id, p.display_name, p.phone_norm, cb.canh_bao, ma.ma_khach, ma.ma_nguon,
           ma.loai_khach, ma.nhom_khach, n.party_id, n.da_thu, n.con_no, n.tien_mat,
           n.ngay_qua_han, n.ky_gan_nhat_den, n.chua_toi_han, n.phai_hoan
 HAVING count(s.subscription_id) > 0 OR n.party_id IS NOT NULL;
