-- Bày mã khách (KH03901) lên thuê bao và lên trang khách.
--
-- Thêm vào cuối danh sách cột nên replace được, không phải drop kéo theo hai
-- view phía sau.

create or replace view v_telecom_subscription as
WITH hd AS (
         SELECT invoice_snapshot.subscription_source_id AS sid,
            count(*) AS so_hoa_don,
            count(*) FILTER (WHERE invoice_snapshot.status = 'ISSUED'::text) AS hoa_don_dang_doi,
            round(sum(invoice_snapshot.total_amount - invoice_snapshot.paid_amount) FILTER (WHERE invoice_snapshot.status = 'ISSUED'::text)) AS con_no,
            count(*) FILTER (WHERE invoice_snapshot.status = 'UNPAYABLE'::text) AS hoa_don_mat,
            round(sum(invoice_snapshot.total_amount - invoice_snapshot.paid_amount) FILTER (WHERE invoice_snapshot.status = 'UNPAYABLE'::text)) AS tien_mat,
            round(sum(invoice_snapshot.paid_amount)) AS da_thu,
            max(invoice_snapshot.period_end) AS ky_gan_nhat_den,
            max(CURRENT_DATE - invoice_snapshot.due_on) FILTER (WHERE invoice_snapshot.status = 'ISSUED'::text) AS ngay_qua_han
           FROM invoice_snapshot
          WHERE invoice_snapshot.source = 'TELECOM'::source_system AND invoice_snapshot.status <> 'VOID'::text
          GROUP BY invoice_snapshot.subscription_source_id
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
    ps.customer_code AS ma_khach
   FROM subscription_snapshot s
     LEFT JOIN party p ON p.id = s.party_id
     LEFT JOIN party_source ps ON ps.source = 'TELECOM'::source_system AND ps.source_customer_id = s.source_customer_id AND ps.status <> 'REJECTED'::text
     LEFT JOIN hd ON hd.sid = s.source_id
     LEFT JOIN may ON may.sid = s.source_id
  WHERE s.source = 'TELECOM'::source_system;

create or replace view v_telecom_customer as
 WITH cb AS (
         SELECT s_1.party_id, array_agg(DISTINCT u.cb) AS canh_bao
           FROM v_telecom_subscription s_1, LATERAL unnest(s_1.canh_bao) u(cb)
          WHERE s_1.party_id IS NOT NULL
          GROUP BY s_1.party_id
        )
 SELECT p.id AS party_id,
    COALESCE(p.display_name, 'khách chưa có tên') AS khach,
    p.phone_norm AS dien_thoai,
    max(s.loai_khach) AS loai_khach,
    customer_type_label(max(s.loai_khach)) AS loai_khach_chu,
    max(s.nhom_khach) AS nhom_khach,
    count(*) AS so_thue_bao,
    count(*) FILTER (WHERE s.trang_thai = 'ACTIVE') AS dang_chay,
    array_agg(DISTINCT s.service_type) FILTER (WHERE s.service_type IS NOT NULL) AS dich_vu,
    round(sum(s.da_thu)) AS da_thu,
    round(sum(s.con_no)) AS con_no,
    round(sum(s.tien_mat)) AS tien_mat,
    sum(s.may_chua_tra) AS may_chua_tra,
    max(s.ngay_qua_han) AS ngay_qua_han,
    max(s.ky_gan_nhat_den) AS ky_gan_nhat_den,
    COALESCE(cb.canh_bao, '{}'::text[]) AS canh_bao,
    -- Một party gộp từ hai mã nguồn thì bày cả hai, đừng chọn bừa một cái.
    string_agg(DISTINCT s.ma_khach, ', ' ORDER BY s.ma_khach) AS ma_khach
   FROM v_telecom_subscription s
     JOIN party p ON p.id = s.party_id
     LEFT JOIN cb ON cb.party_id = p.id
  GROUP BY p.id, p.display_name, p.phone_norm, cb.canh_bao;
