-- Cùng lý do db/177, cho màn hình chi tiết thuê bao.
--
-- View này đọc thẳng subscription_snapshot nên lấy cờ và mã máy ngay tại đó.

create or replace view v_telecom_thue_bao_no as
 WITH hd AS (
         SELECT invoice_snapshot.subscription_source_id AS sid,
            count(*) FILTER (WHERE invoice_snapshot.status = 'ISSUED'::text) AS so_hd_doi,
            COALESCE(sum(invoice_snapshot.total_amount) FILTER (WHERE invoice_snapshot.status = 'ISSUED'::text), 0::numeric) AS no,
            COALESCE(sum(invoice_snapshot.total_amount) FILTER (WHERE invoice_snapshot.status = 'UNPAYABLE'::text), 0::numeric) AS bo_thu,
            count(*) FILTER (WHERE invoice_snapshot.status = 'UNPAYABLE'::text) AS so_hd_bo,
            COALESCE(sum(invoice_snapshot.total_amount) FILTER (WHERE invoice_snapshot.status = 'PAID'::text), 0::numeric) AS da_thu,
            max(CURRENT_DATE - invoice_snapshot.due_on) FILTER (WHERE invoice_snapshot.status = 'ISSUED'::text) AS qua_han_lau_nhat
           FROM invoice_snapshot
          WHERE invoice_snapshot.source = 'TELECOM'::source_system AND invoice_snapshot.subscription_source_id IS NOT NULL
          GROUP BY invoice_snapshot.subscription_source_id
        )
select s.source_id AS subscription_id,
    s.status AS trang_thai,
    s.plan_name AS goi,
    s.monthly_price AS gia_thang,
    s.activated_on AS ngay_kich_hoat,
    s.terminated_on AS ngay_ngung,
    COALESCE(p.display_name, 'khách chưa có tên'::text) AS khach,
    ps.customer_code AS ma_khach,
    ps.customer_type AS loai_khach,
    COALESCE(hd.so_hd_doi, 0::bigint) AS so_hd_doi,
    COALESCE(hd.no, 0::numeric) AS no,
    COALESCE(hd.so_hd_bo, 0::bigint) AS so_hd_bo,
    COALESCE(hd.bo_thu, 0::numeric) AS bo_thu,
    COALESCE(hd.da_thu, 0::numeric) AS da_thu,
    hd.qua_han_lau_nhat,
    ( SELECT count(*) AS count
           FROM subscription_device_snapshot sd
          WHERE sd.source = 'TELECOM'::source_system AND sd.subscription_source_id = s.source_id) AS so_may,
    CASE
        WHEN s.cho_muon_cd THEN telecom_url('cho_muon'::text, s.device_ref)
        ELSE telecom_url('thue_bao'::text, s.source_id)
    END AS link_cms
   FROM subscription_snapshot s
     LEFT JOIN hd ON hd.sid = s.source_id
     LEFT JOIN party_source ps ON ps.source = 'TELECOM'::source_system AND ps.source_customer_id = s.source_customer_id AND ps.status <> 'REJECTED'::text
     LEFT JOIN party p ON p.id = ps.party_id
  WHERE s.source = 'TELECOM'::source_system;
