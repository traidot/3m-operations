-- Hai danh sách việc bỏ hẳn phần đại lý cầm tay.
--
-- Nối theo KHÁCH chứ không theo thuê bao: hoá đơn loại ORDER không gắn thuê bao
-- nào, lọc theo thuê bao là sót đúng nhóm gói năm thu một lần.

/** Khách cầm tay có phải đại lý không. */
create or replace view v_telecom_party_dai_ly as
select ps.party_id,
       bool_or(ps.customer_type = 'AGENCY') as la_dai_ly
  from party_source ps
 where ps.source = 'TELECOM' and ps.status <> 'REJECTED' and ps.party_id is not null
 group by ps.party_id;

create or replace view v_thu_cuoc as
 SELECT 'FIXED'::source_system AS nguon,
    c.subscription_id AS id,
    c.contract_code AS ma,
    c.dia_chi AS khach,
    'FIXED_INTERNET'::text AS dich_vu,
    p.ky,
    p.phai_thu AS tien,
    p.coc_cho_duyet,
    fixed_fee_due_date(p.ky) AS han_tra,
    p.qua_han,
    CURRENT_DATE - fixed_fee_due_date(p.ky) AS ngay_le,
    NULL::text AS so_hoa_don,
    p.trang_thai AS tinh_trang,
    NULL::text AS loai_hoa_don,
    c.kho_doi,
    contract_url(c.subscription_id) AS link_cms
   FROM v_fixed_contract_period p
     JOIN v_fixed_contract c USING (subscription_id)
  WHERE (p.trang_thai = ANY (ARRAY['NO'::text, 'CHO_DUYET'::text, 'GHI_CHU'::text])) AND NOT p.ngoai_ky_tinh AND c.trang_thai_hop_dong = 'ACTIVE'::text
UNION ALL
 SELECT 'TELECOM'::source_system AS nguon,
    COALESCE(d.subscription_source_id, d.party_id::text) AS id,
    COALESCE(d.subscription_source_id, i.number) AS ma,
    COALESCE(p.display_name, 'khách chưa có tên'::text) AS khach,
    COALESCE(s.service_type, d.invoice_type) AS dich_vu,
    to_char(COALESCE(d.period_start, d.han_tra)::timestamp with time zone, 'YYYY-MM'::text) AS ky,
    d.con_lai AS tien,
    0::numeric AS coc_cho_duyet,
    d.han_tra,
    CURRENT_DATE > d.han_tra AS qua_han,
    CURRENT_DATE - d.han_tra AS ngay_le,
    i.number AS so_hoa_don,
    'DANG_DOI'::text AS tinh_trang,
    d.invoice_type AS loai_hoa_don,
    false AS kho_doi,
    telecom_url('hoa_don'::text, d.source_id) AS link_cms
   FROM v_telecom_invoice_due d
     JOIN invoice_snapshot i ON i.source = 'TELECOM'::source_system AND i.source_id = d.source_id
     LEFT JOIN party p ON p.id = d.party_id
     LEFT JOIN subscription_snapshot s ON s.source = 'TELECOM'::source_system AND s.source_id = d.subscription_source_id
     LEFT JOIN v_telecom_party_dai_ly dl ON dl.party_id = d.party_id
  WHERE d.status = 'ISSUED'::text AND NOT d.la_hoan_tien AND d.con_lai > 0::numeric
    AND NOT COALESCE(dl.la_dai_ly, false);

create or replace view v_xem_xet_huy as
 SELECT 'FIXED'::source_system AS nguon,
    c.subscription_id AS id,
    c.contract_code AS ma,
    c.dia_chi AS khach,
    'FIXED_INTERNET'::text AS dich_vu,
    c.goi_cuoc AS goi,
    c.cuoc_thang AS gia_thang,
    c.con_no_sau_coc AS con_no,
    c.coc_cho_duyet,
    c.so_ky_no,
    k.ky_no_cu_nhat,
    CURRENT_DATE - fixed_fee_due_date(k.ky_no_cu_nhat) AS ngay_qua_han,
    c.kho_doi,
    contract_url(c.subscription_id) AS link_cms
   FROM v_fixed_contract c
     LEFT JOIN ( SELECT v_fixed_contract_period.subscription_id,
            min(v_fixed_contract_period.ky) AS ky_no_cu_nhat
           FROM v_fixed_contract_period
          WHERE v_fixed_contract_period.trang_thai = 'NO'::text AND v_fixed_contract_period.qua_han AND v_fixed_contract_period.coc_cho_duyet = 0::numeric
          GROUP BY v_fixed_contract_period.subscription_id) k ON k.subscription_id = c.subscription_id
  WHERE c.trang_thai_hop_dong = 'ACTIVE'::text AND c.con_no_sau_coc > 0::numeric
UNION ALL
 SELECT 'TELECOM'::source_system AS nguon,
    s.subscription_id AS id,
    s.subscription_id AS ma,
    s.khach,
    s.service_type AS dich_vu,
    s.goi,
    s.gia_thang,
    s.con_no,
    0::numeric AS coc_cho_duyet,
    h.so_hoa_don_qua_han AS so_ky_no,
    to_char(h.han_cu_nhat::timestamp with time zone, 'YYYY-MM'::text) AS ky_no_cu_nhat,
    CURRENT_DATE - h.han_cu_nhat AS ngay_qua_han,
    false AS kho_doi,
    telecom_url('thue_bao'::text, s.subscription_id) AS link_cms
   FROM v_telecom_subscription s
     JOIN ( SELECT v_telecom_invoice_due.subscription_source_id AS sid,
            count(*) AS so_hoa_don_qua_han,
            min(v_telecom_invoice_due.han_tra) AS han_cu_nhat
           FROM v_telecom_invoice_due
          WHERE v_telecom_invoice_due.status = 'ISSUED'::text AND CURRENT_DATE > v_telecom_invoice_due.han_tra AND v_telecom_invoice_due.subscription_source_id IS NOT NULL
          GROUP BY v_telecom_invoice_due.subscription_source_id) h ON h.sid = s.subscription_id
  WHERE s.trang_thai = 'ACTIVE'::text AND s.con_no > 0::numeric AND NOT s.la_dai_ly;
