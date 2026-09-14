-- Nợ bên cầm tay đọc hạn trả thật từ v_telecom_invoice_due.
--
--   con_no        phần đã qua hạn — cái đi đòi, cái để xem xét huỷ
--   chua_toi_han  phiếu đã xuất nhưng chưa tới mùng 1 của tháng dùng
--
-- ngay_qua_han cũng tính lại theo hạn thật; trước đây đo từ due_on mà due_on
-- phần lớn chỉ là bản sao của ngày lập, nên hoá đơn vừa xuất đã "quá hạn".

create or replace view v_telecom_subscription as
WITH hd AS (
         SELECT i.subscription_source_id AS sid,
            count(*) AS so_hoa_don,
            count(*) FILTER (WHERE i.status = 'ISSUED') AS hoa_don_dang_doi,
            -- Nợ là phần đã qua hạn; phần chưa tới hạn tách riêng, không phải nợ.
            round(sum(i.con_lai) FILTER (WHERE i.status = 'ISSUED' AND CURRENT_DATE > i.han_tra)) AS con_no,
            round(sum(i.con_lai) FILTER (WHERE i.status = 'ISSUED' AND CURRENT_DATE <= i.han_tra)) AS chua_toi_han,
            count(*) FILTER (WHERE i.status = 'UNPAYABLE') AS hoa_don_mat,
            round(sum(i.con_lai) FILTER (WHERE i.status = 'UNPAYABLE')) AS tien_mat,
            round(sum(i.paid_amount)) AS da_thu,
            max(i.period_end) AS ky_gan_nhat_den,
            max(CURRENT_DATE - i.han_tra) FILTER (WHERE i.status = 'ISSUED') AS ngay_qua_han
           FROM v_telecom_invoice_due i
          WHERE i.status <> 'VOID'
          GROUP BY i.subscription_source_id
        ), may AS (
         SELECT device_snapshot.subscription_source_id AS sid,
            count(*) FILTER (WHERE device_snapshot.status = 'NOT_RETURNED'::text) AS may_chua_tra
           FROM device_snapshot
          WHERE device_snapshot.source = 'TELECOM'::source_system AND device_snapshot.subscription_source_id IS NOT NULL
          GROUP BY device_snapshot.subscription_source_id
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
               FROM nguong)) THEN 'NO_QUA_HAN'::text
            ELSE NULL::text
        END,
        CASE
            WHEN COALESCE(hd.hoa_don_mat, 0::bigint) > 0 THEN 'KHONG_DOI_DUOC'::text
            ELSE NULL::text
        END,
        CASE
            WHEN s.status = 'ACTIVE'::text AND COALESCE(CURRENT_DATE - hd.ky_gan_nhat_den, CURRENT_DATE - s.activated_on) > (( SELECT nguong.an_han
               FROM nguong)) THEN 'THIEU_HOA_DON'::text
            ELSE NULL::text
        END,
        CASE
            WHEN s.status = 'ACTIVE'::text AND (s.monthly_price IS NULL OR s.monthly_price = 0::numeric) THEN 'THIEU_GIA'::text
            ELSE NULL::text
        END,
        CASE
            WHEN COALESCE(may.may_chua_tra, 0::bigint) > 0 THEN 'MAY_CHUA_TRA'::text
            ELSE NULL::text
        END], NULL::text) AS canh_bao,
    ps.customer_code AS ma_khach,
    COALESCE(hd.chua_toi_han, 0::numeric) AS chua_toi_han
   FROM subscription_snapshot s
     LEFT JOIN party p ON p.id = s.party_id
     LEFT JOIN party_source ps ON ps.source = 'TELECOM'::source_system AND ps.source_customer_id = s.source_customer_id AND ps.status <> 'REJECTED'::text
     LEFT JOIN hd ON hd.sid = s.source_id
     LEFT JOIN may ON may.sid = s.source_id
  WHERE s.source = 'TELECOM'::source_system;
