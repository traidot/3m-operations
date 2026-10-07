-- Máy đánh dấu "không thu hồi" không phải máy đang cho thuê.
--
-- 1.196 trong 3.752 máy ở cột "ở khách" có phiếu xuất CUỐI CÙNG đánh dấu
-- is_no_recall — giao đi luôn, không đòi lại. Đo thử thì chúng khác hẳn phần
-- còn lại:
--
--                           đang cho thuê    giao luôn
--   thuê bao đang chạy           1.193            7
--   không có hồ sơ nào             247          864
--
-- Bảy trên một nghìn hai còn thuê bao chạy. Đống đó không bao giờ về kho và
-- không sinh cước nữa, nên để chung rổ với máy đang cho thuê là làm hỏng cả
-- hai con số: "ở khách" phồng lên gần một nửa, còn phần giao luôn thì không ai
-- đếm.
--
-- Nhánh GIAO_LUON đặt SAU DIEU_CHINH_SO: 195 trên 221 phiếu đối soát phần mềm
-- cũng mang dấu is_no_recall, nhưng chúng là chỉnh sổ chứ không phải giao cho
-- ai — đảo thứ tự là mất luôn nhóm đó.
--
-- is_no_recall phải đi qua hai tầng view mới tới chỗ phân loại, nên
-- v_kho_phieu_cuoi dựng lại kèm cột đó. Dùng EXISTS trên bảng gốc thì ngắn hơn
-- nhưng sai nghĩa: nó bắt cả máy TỪNG có phiếu không thu hồi rồi sau đó về kho
-- và xuất lại.

drop view if exists v_tram_van_hanh;
drop view if exists v_tram_chi_tiet;
drop view if exists v_kho_doi_chieu;
drop view if exists v_kho_thieu_o_file;
drop view if exists v_kho_ma;
drop view if exists v_kho_phan_mem;
drop view if exists v_kho_phieu_cuoi;

create view v_kho_phieu_cuoi as
 SELECT DISTINCT ON (device_code) device_code,
    doc_type,
    business_type,
    reason_type,
    product_name,
    product_type,
    warehouse_name,
    doc_date,
    doc_code,
    subscription_source_id,
    party_id,
    vendor_name,
    is_no_recall
   FROM stock_move_snapshot
  WHERE source = 'TELECOM'::source_system AND device_code IS NOT NULL
  ORDER BY device_code, doc_date DESC NULLS LAST, source_id DESC;

create view v_kho_phan_mem as
 WITH ma AS (
         SELECT DISTINCT ltrim(stock_move_snapshot.device_code, '0'::text) AS ma_chuan
           FROM stock_move_snapshot
          WHERE stock_move_snapshot.source = 'TELECOM'::source_system AND stock_move_snapshot.device_code IS NOT NULL
        UNION
         SELECT DISTINCT ltrim(device_snapshot.imei, '0'::text) AS ltrim
           FROM device_snapshot
          WHERE device_snapshot.source = 'TELECOM'::source_system AND device_snapshot.imei IS NOT NULL
        UNION
         SELECT DISTINCT ltrim(subscription_device_snapshot.imei, '0'::text) AS ltrim
           FROM subscription_device_snapshot
          WHERE subscription_device_snapshot.source = 'TELECOM'::source_system AND subscription_device_snapshot.imei IS NOT NULL
        UNION
         SELECT DISTINCT ltrim(provider_device_snapshot.device_code, '0'::text) AS ltrim
           FROM provider_device_snapshot
          WHERE provider_device_snapshot.source = 'TELECOM'::source_system AND provider_device_snapshot.device_code IS NOT NULL
        ), p AS (
         SELECT DISTINCT ON ((ltrim(v_kho_phieu_cuoi.device_code, '0'::text))) ltrim(v_kho_phieu_cuoi.device_code, '0'::text) AS ma_chuan,
            v_kho_phieu_cuoi.device_code,
            v_kho_phieu_cuoi.doc_type,
            v_kho_phieu_cuoi.reason_type,
            v_kho_phieu_cuoi.product_name,
            v_kho_phieu_cuoi.warehouse_name,
            v_kho_phieu_cuoi.doc_date,
            v_kho_phieu_cuoi.is_no_recall
           FROM v_kho_phieu_cuoi
          ORDER BY (ltrim(v_kho_phieu_cuoi.device_code, '0'::text)), v_kho_phieu_cuoi.doc_date DESC NULLS LAST, v_kho_phieu_cuoi.device_code
        ), x AS (
         SELECT DISTINCT ON ((ltrim(x_1.device_code, '0'::text))) ltrim(x_1.device_code, '0'::text) AS ma_chuan,
            COALESCE(pt.display_name, 'khách chưa có tên'::text) AS khach_phieu,
            ps.customer_code AS ma_khach_phieu,
            ps.customer_type AS loai_khach_phieu,
            x_1.doc_date AS ngay_xuat
           FROM v_kho_xuat_cuoi x_1
             LEFT JOIN party pt ON pt.id = x_1.party_id
             LEFT JOIN party_source ps ON ps.source = 'TELECOM'::source_system AND ps.party_id = x_1.party_id AND ps.status <> 'REJECTED'::text
          WHERE x_1.party_id IS NOT NULL
          ORDER BY (ltrim(x_1.device_code, '0'::text)), x_1.doc_date DESC NULLS LAST, x_1.device_code
        ), nm AS (
         SELECT DISTINCT ON ((ltrim(provider_device_snapshot.device_code, '0'::text))) ltrim(provider_device_snapshot.device_code, '0'::text) AS ma_chuan,
            provider_device_snapshot.state,
            provider_device_snapshot.vendor
           FROM provider_device_snapshot
          WHERE provider_device_snapshot.source = 'TELECOM'::source_system AND provider_device_snapshot.device_code IS NOT NULL
          ORDER BY (ltrim(provider_device_snapshot.device_code, '0'::text)), provider_device_snapshot.state
        ), tb AS (
         SELECT v_tb_ma.ma_chuan,
            v_tb_ma.subscription_source_id,
            v_tb_ma.trang_thai_tb,
            v_tb_ma.goi,
            v_tb_ma.gia_thang,
            v_tb_ma.ky_cuoi,
            v_tb_ma.chua_thu,
            v_tb_ma.khach,
            v_tb_ma.ma_khach,
            v_tb_ma.loai_khach,
            v_tb_ma.source_customer_id,
            v_tb_ma.tinh_trang_cuoc
           FROM v_tb_ma
        ), m AS (
         SELECT DISTINCT ON ((ltrim(v_telecom_may.imei, '0'::text))) ltrim(v_telecom_may.imei, '0'::text) AS ma_chuan,
            v_telecom_may.imei,
            v_telecom_may.model,
            v_telecom_may.trang_thai,
            v_telecom_may.tinh_trang_cuoc,
            v_telecom_may.khach,
            v_telecom_may.ma_khach,
            v_telecom_may.loai_khach,
            v_telecom_may.coc,
            v_telecom_may.trang_thai_coc,
            v_telecom_may.ky_cuoi,
            v_telecom_may.chua_thu
           FROM v_telecom_may
          ORDER BY (ltrim(v_telecom_may.imei, '0'::text)), v_telecom_may.imei
        )
 SELECT ma.ma_chuan,
    COALESCE(m.imei, p.device_code, ma.ma_chuan) AS ma,
    COALESCE(m.model, p.product_name) AS doi_may,
    p.doc_type,
    p.reason_type,
    p.warehouse_name,
    p.doc_date,
    m.trang_thai AS trang_thai_may,
    tb.ma_chuan IS NOT NULL AS co_thue_bao,
    tb.subscription_source_id AS thue_bao,
    COALESCE(m.tinh_trang_cuoc, tb.tinh_trang_cuoc) AS tinh_trang_cuoc,
    COALESCE(m.ky_cuoi, tb.ky_cuoi) AS ky_cuoi,
    m.coc,
    m.trang_thai_coc,
    COALESCE(m.chua_thu, tb.chua_thu) AS chua_thu,
    COALESCE(m.khach, tb.khach, x.khach_phieu) AS khach,
    COALESCE(m.ma_khach, tb.ma_khach, x.ma_khach_phieu) AS ma_khach,
    COALESCE(m.loai_khach, tb.loai_khach, x.loai_khach_phieu) AS loai_khach,
        CASE
            WHEN m.khach IS NOT NULL THEN 'hồ sơ cho thuê'::text
            WHEN tb.khach IS NOT NULL THEN 'thuê bao '::text || tb.subscription_source_id
            WHEN x.khach_phieu IS NOT NULL THEN 'phiếu xuất '::text || x.ngay_xuat
            ELSE NULL::text
        END AS nguon_khach,
    n.state AS nha_mang,
    n.vendor,
    COALESCE(telecom_url('thue_bao'::text, tb.subscription_source_id), telecom_url('khach'::text, tb.source_customer_id)) AS link_cms,
        CASE
            WHEN p.reason_type = 'ISSUE_FOR_RETURN_VENDOR'::text THEN 'TRA_NCC'::text
            WHEN p.reason_type = 'ISSUE_FOR_SALE'::text THEN 'DA_BAN'::text
            WHEN p.reason_type = 'ISSUE_FOR_DAMAGED'::text THEN 'HONG_HUY'::text
            WHEN p.reason_type = ANY (ARRAY['ISSUE_FOR_SOFTWARE_RECONCILE'::text, 'ISSUE_FOR_STOCKTAKE'::text]) THEN 'DIEU_CHINH_SO'::text
            WHEN p.is_no_recall THEN 'GIAO_LUON'::text
            WHEN p.doc_type = 'INVENTORY_OUT'::text THEN 'O_KHACH'::text
            WHEN p.doc_type = 'INVENTORY_IN'::text THEN 'TRONG_KHO'::text
            WHEN m.trang_thai = ANY (ARRAY['RENTING'::text, 'NOT_RETURNED'::text]) THEN 'O_KHACH'::text
            WHEN m.trang_thai = 'RETURNED'::text THEN 'TRONG_KHO'::text
            WHEN n.state IS NOT NULL THEN 'CHI_NHA_MANG'::text
            ELSE 'KHONG_RO'::text
        END AS cho_dung,
    a.ma IS NOT NULL AS co_trong_file,
    a.ket_luan AS file_ket_luan,
    a.vi_tri_so AS file_vi_tri_so,
    a.vi_tri_kiem_kho AS file_kiem_kho,
    a.nguoi_giu AS file_nguoi_giu
   FROM ma
     LEFT JOIN p ON p.ma_chuan = ma.ma_chuan
     LEFT JOIN x ON x.ma_chuan = ma.ma_chuan
     LEFT JOIN nm n ON n.ma_chuan = ma.ma_chuan
     LEFT JOIN m ON m.ma_chuan = ma.ma_chuan
     LEFT JOIN tb ON tb.ma_chuan = ma.ma_chuan
     LEFT JOIN stock_audit_row a ON a.ma_chuan = ma.ma_chuan;

create view v_kho_ma as
 WITH ma AS (
         SELECT v_kho_phan_mem.ma_chuan
           FROM v_kho_phan_mem
        UNION
         SELECT stock_audit_row.ma_chuan
           FROM stock_audit_row
        ), loai AS (
         SELECT DISTINCT ON ((ltrim(v_kho_phieu_cuoi.device_code, '0'::text))) ltrim(v_kho_phieu_cuoi.device_code, '0'::text) AS ma_chuan,
            v_kho_phieu_cuoi.product_type
           FROM v_kho_phieu_cuoi
          ORDER BY (ltrim(v_kho_phieu_cuoi.device_code, '0'::text)), v_kho_phieu_cuoi.doc_date DESC NULLS LAST, v_kho_phieu_cuoi.device_code
        )
 SELECT ma.ma_chuan,
    COALESCE(p.ma, a.ma) AS ma,
        CASE
            WHEN l.product_type = 'WIFI_DEVICE'::text THEN 'MAY_WIFI'::text
            WHEN l.product_type ~~ '%SIM%'::text THEN 'SIM'::text
            WHEN p.doi_may ~~* 'Wifi%'::text THEN 'MAY_WIFI'::text
            WHEN p.doi_may ~~* 'Sim%'::text THEN 'SIM'::text
            WHEN a.nhom_hang = ANY (ARRAY['U20'::text, 'MR1'::text, 'WIMAX'::text]) THEN 'MAY_WIFI'::text
            WHEN a.nhom_hang ~~ 'SB%'::text OR a.nhom_hang ~~ 'Datacall%'::text THEN 'SIM'::text
            WHEN length(ma.ma_chuan) = 15 THEN 'MAY_WIFI'::text
            WHEN length(ma.ma_chuan) >= 9 AND length(ma.ma_chuan) <= 11 THEN 'SIM'::text
            ELSE 'KHONG_RO'::text
        END AS nhom_tb,
        CASE
            WHEN length(ma.ma_chuan) = 15 THEN 'IMEI'::text
            WHEN length(ma.ma_chuan) >= 9 AND length(ma.ma_chuan) <= 11 THEN 'SO_DIEN_THOAI'::text
            WHEN length(ma.ma_chuan) >= 18 THEN 'ICCID'::text
            ELSE 'KHAC'::text
        END AS loai_ma,
    p.ma_chuan IS NOT NULL AS pm_co,
    COALESCE(p.cho_dung, 'PM_KHONG_CO'::text) AS cho_dung,
    p.doi_may,
    p.doc_type,
    p.reason_type,
    p.warehouse_name,
    p.doc_date,
    p.trang_thai_may,
    p.co_thue_bao,
    p.thue_bao,
    p.tinh_trang_cuoc,
    p.ky_cuoi,
    p.coc,
    p.trang_thai_coc,
    p.chua_thu,
    p.khach,
    p.ma_khach,
    p.loai_khach,
    p.nguon_khach,
    p.nha_mang,
    p.vendor,
    p.link_cms,
    a.ma IS NOT NULL AS file_co,
    a.nhom_hang AS file_nhom_hang,
    a.ket_luan AS file_ket_luan,
    a.vi_tri_so AS file_vi_tri_so,
    a.vi_tri_kiem_kho AS file_kiem_kho,
    a.nguoi_giu AS file_nguoi_giu,
    a.coc AS file_coc,
    (EXISTS ( SELECT 1
           FROM stock_move_snapshot sm
          WHERE sm.source = 'TELECOM'::source_system AND sm.is_no_recall AND ltrim(sm.device_code, '0'::text) = ma.ma_chuan)) AS khong_thu_hoi
   FROM ma
     LEFT JOIN v_kho_phan_mem p ON p.ma_chuan = ma.ma_chuan
     LEFT JOIN loai l ON l.ma_chuan = ma.ma_chuan
     LEFT JOIN stock_audit_row a ON a.ma_chuan = ma.ma_chuan;

create view v_kho_doi_chieu as
 WITH pm AS (
         SELECT DISTINCT ON ((ltrim(p_1.device_code, '0'::text))) ltrim(p_1.device_code, '0'::text) AS ma_chuan,
            p_1.doc_type,
            p_1.reason_type,
            p_1.warehouse_name,
            p_1.doc_date,
            p_1.product_name,
            p_1.subscription_source_id,
            p_1.is_no_recall
           FROM v_kho_phieu_cuoi p_1
          ORDER BY (ltrim(p_1.device_code, '0'::text)), p_1.doc_date DESC NULLS LAST, p_1.device_code
        ), xuat AS (
         SELECT DISTINCT ON ((ltrim(x_1.device_code, '0'::text))) ltrim(x_1.device_code, '0'::text) AS ma_chuan,
            COALESCE(pt.display_name, 'khách chưa có tên'::text) AS khach_phieu,
            x_1.doc_date AS ngay_xuat
           FROM v_kho_xuat_cuoi x_1
             LEFT JOIN party pt ON pt.id = x_1.party_id
          WHERE x_1.party_id IS NOT NULL
          ORDER BY (ltrim(x_1.device_code, '0'::text)), x_1.doc_date DESC NULLS LAST, x_1.device_code
        ), nm AS (
         SELECT DISTINCT ON ((ltrim(provider_device_snapshot.device_code, '0'::text))) ltrim(provider_device_snapshot.device_code, '0'::text) AS ma_chuan,
            provider_device_snapshot.state,
            provider_device_snapshot.vendor
           FROM provider_device_snapshot
          WHERE provider_device_snapshot.source = 'TELECOM'::source_system AND provider_device_snapshot.device_code IS NOT NULL
          ORDER BY (ltrim(provider_device_snapshot.device_code, '0'::text)), provider_device_snapshot.state
        ), may AS (
         SELECT DISTINCT ON ((ltrim(v_telecom_may.imei, '0'::text))) ltrim(v_telecom_may.imei, '0'::text) AS ma_chuan,
            v_telecom_may.imei,
            v_telecom_may.model,
            v_telecom_may.trang_thai,
            v_telecom_may.tinh_trang_cuoc,
            v_telecom_may.khach,
            v_telecom_may.ma_khach,
            v_telecom_may.coc AS coc_pm,
            v_telecom_may.trang_thai_coc
           FROM v_telecom_may
          ORDER BY (ltrim(v_telecom_may.imei, '0'::text)), v_telecom_may.imei
        ), so AS (
         SELECT stock_audit_book.ma_chuan,
            count(*) AS so_dong_so,
            string_agg(DISTINCT stock_audit_book.danh_sach, ' · '::text) AS danh_sach_so
           FROM stock_audit_book
          GROUP BY stock_audit_book.ma_chuan
        )
 SELECT a.ma,
    a.ma_chuan,
    a.nhom_hang,
    a.ket_luan,
    a.vi_tri_so,
    a.vi_tri_kiem_kho,
    a.nguoi_giu,
    a.coc,
    s.so_dong_so,
    s.danh_sach_so,
    m.imei AS pm_imei,
    COALESCE(m.model, p.product_name) AS pm_doi_may,
    m.model IS NULL AND p.product_name IS NOT NULL AS doi_may_tu_phieu,
    m.trang_thai AS pm_trang_thai_may,
    m.tinh_trang_cuoc AS pm_tinh_trang_cuoc,
    COALESCE(m.khach, x.khach_phieu) AS pm_khach,
    m.ma_khach AS pm_ma_khach,
        CASE
            WHEN m.khach IS NOT NULL THEN 'hồ sơ cho thuê'::text
            WHEN x.khach_phieu IS NOT NULL THEN 'phiếu xuất '::text || x.ngay_xuat
            ELSE NULL::text
        END AS nguon_khach,
    p.doc_type AS pm_phieu,
    p.reason_type AS pm_ly_do,
    p.warehouse_name AS pm_kho,
    p.doc_date AS pm_ngay_phieu,
    n.state AS pm_nha_mang,
    n.vendor AS pm_vendor,
        CASE
            WHEN p.reason_type = 'ISSUE_FOR_RETURN_VENDOR'::text THEN 'TRA_NCC'::text
            WHEN p.reason_type = 'ISSUE_FOR_SALE'::text THEN 'DA_BAN'::text
            WHEN p.reason_type = 'ISSUE_FOR_DAMAGED'::text THEN 'HONG_HUY'::text
            WHEN p.reason_type = ANY (ARRAY['ISSUE_FOR_SOFTWARE_RECONCILE'::text, 'ISSUE_FOR_STOCKTAKE'::text]) THEN 'DIEU_CHINH_SO'::text
            WHEN p.is_no_recall THEN 'GIAO_LUON'::text
            WHEN p.doc_type = 'INVENTORY_OUT'::text THEN 'O_KHACH'::text
            WHEN p.doc_type = 'INVENTORY_IN'::text THEN 'TRONG_KHO'::text
            WHEN m.trang_thai = ANY (ARRAY['RENTING'::text, 'NOT_RETURNED'::text]) THEN 'O_KHACH'::text
            WHEN m.trang_thai = 'RETURNED'::text THEN 'TRONG_KHO'::text
            WHEN n.state IS NOT NULL THEN 'CHI_NHA_MANG'::text
            ELSE 'PM_KHONG_BIET'::text
        END AS pm_ket_luan
   FROM stock_audit_row a
     LEFT JOIN pm p ON p.ma_chuan = a.ma_chuan
     LEFT JOIN xuat x ON x.ma_chuan = a.ma_chuan
     LEFT JOIN nm n ON n.ma_chuan = a.ma_chuan
     LEFT JOIN may m ON m.ma_chuan = a.ma_chuan
     LEFT JOIN so s ON s.ma_chuan = a.ma_chuan;

create view v_kho_thieu_o_file as
 SELECT p.device_code,
    p.doc_type,
    p.reason_type,
    p.warehouse_name,
    p.doc_date,
    COALESCE(m.model, p.product_name) AS model,
    m.trang_thai,
    m.tinh_trang_cuoc,
    m.khach
   FROM v_kho_phieu_cuoi p
     LEFT JOIN v_telecom_may m ON ltrim(m.imei, '0'::text) = ltrim(p.device_code, '0'::text)
  WHERE NOT (EXISTS ( SELECT 1
           FROM stock_audit_row a
          WHERE a.ma_chuan = ltrim(p.device_code, '0'::text)));

create view v_tram_chi_tiet as
 WITH cd AS (
         SELECT c.subscription_id,
            c.contract_code,
            c.dia_chi,
            c.ngay_ky,
            c.cuoc_thang,
            c.con_no,
            c.so_ky_no,
            c.canh_bao,
            c.fee_start_on,
            c.nguoi_nhap,
            o.scheduled_at::date AS hen,
            o.completed_on
           FROM v_fixed_contract c
             JOIN install_order_snapshot o ON o.source = 'FIXED'::source_system AND o.source_id = c.subscription_id
          WHERE c.do_cong_ty AND c.trang_thai_hop_dong <> 'TERMINATED'::text
        )
 SELECT 'co_dinh'::text AS he,
    'KHAO_SAT'::text AS tram,
    cd.subscription_id AS id,
    cd.contract_code AS ma,
    cd.dia_chi AS ai,
    CURRENT_DATE - cd.ngay_ky AS tuoi_ngay,
    NULL::numeric AS tien,
    cd.nguoi_nhap AS nguoi,
    contract_url(cd.subscription_id) AS url
   FROM cd
  WHERE cd.completed_on IS NULL AND cd.hen IS NULL
UNION ALL
 SELECT 'co_dinh'::text AS he,
    'CHO_HEN'::text AS tram,
    cd.subscription_id AS id,
    cd.contract_code AS ma,
    cd.dia_chi AS ai,
    cd.hen - CURRENT_DATE AS tuoi_ngay,
    NULL::numeric AS tien,
    cd.nguoi_nhap AS nguoi,
    contract_url(cd.subscription_id) AS url
   FROM cd
  WHERE cd.completed_on IS NULL AND cd.hen > CURRENT_DATE
UNION ALL
 SELECT 'co_dinh'::text AS he,
    'QUA_HEN'::text AS tram,
    cd.subscription_id AS id,
    cd.contract_code AS ma,
    cd.dia_chi AS ai,
    CURRENT_DATE - cd.hen AS tuoi_ngay,
    NULL::numeric AS tien,
    cd.nguoi_nhap AS nguoi,
    contract_url(cd.subscription_id) AS url
   FROM cd
  WHERE cd.completed_on IS NULL AND cd.hen <= CURRENT_DATE
UNION ALL
 SELECT 'co_dinh'::text AS he,
    'CHUA_BAT_THU'::text AS tram,
    cd.subscription_id AS id,
    cd.contract_code AS ma,
    cd.dia_chi AS ai,
    CURRENT_DATE - cd.completed_on AS tuoi_ngay,
    cd.cuoc_thang AS tien,
    cd.nguoi_nhap AS nguoi,
    contract_url(cd.subscription_id) AS url
   FROM cd
  WHERE cd.completed_on IS NOT NULL AND cd.fee_start_on IS NULL
UNION ALL
 SELECT 'co_dinh'::text AS he,
    'THIEU_GIA'::text AS tram,
    cd.subscription_id AS id,
    cd.contract_code AS ma,
    cd.dia_chi AS ai,
    CURRENT_DATE - cd.ngay_ky AS tuoi_ngay,
    NULL::numeric AS tien,
    cd.nguoi_nhap AS nguoi,
    contract_url(cd.subscription_id) AS url
   FROM cd
  WHERE 'THIEU_GIA_CUOC'::text = ANY (cd.canh_bao)
UNION ALL
 SELECT 'co_dinh'::text AS he,
    'CHO_DUYET_COC'::text AS tram,
    d.source_id AS id,
    d.ma_hd AS ma,
    d.dia_chi AS ai,
    d.cho_ngay AS tuoi_ngay,
    d.tien,
    NULL::text AS nguoi,
    d.url
   FROM v_fixed_coc_cho_phan_bo d
     LEFT JOIN v_fixed_contract c ON c.contract_code = d.ma_hd
  WHERE COALESCE(c.do_cong_ty, true)
UNION ALL
 SELECT 'co_dinh'::text AS he,
    'DANG_NO'::text AS tram,
    cd.subscription_id AS id,
    cd.contract_code AS ma,
    cd.dia_chi AS ai,
    NULL::integer AS tuoi_ngay,
    cd.con_no AS tien,
    cd.nguoi_nhap AS nguoi,
    contract_url(cd.subscription_id) AS url
   FROM cd
  WHERE cd.so_ky_no > 0
UNION ALL
 SELECT 'cam_tay'::text AS he,
    'CHO_GAN_HD'::text AS tram,
    v_telecom_thu_chua_can_tru.payment_id AS id,
    v_telecom_thu_chua_can_tru.ma_khach AS ma,
    v_telecom_thu_chua_can_tru.khach AS ai,
    v_telecom_thu_chua_can_tru.so_ngay_treo AS tuoi_ngay,
    v_telecom_thu_chua_can_tru.amount AS tien,
    NULL::text AS nguoi,
    v_telecom_thu_chua_can_tru.link_cms AS url
   FROM v_telecom_thu_chua_can_tru
  WHERE COALESCE(v_telecom_thu_chua_can_tru.loai_khach, ''::text) <> 'AGENCY'::text
UNION ALL
 SELECT 'cam_tay'::text AS he,
    'NO_CAM_TAY'::text AS tram,
    v_telecom_thue_bao_no.subscription_id AS id,
    v_telecom_thue_bao_no.ma_khach AS ma,
    v_telecom_thue_bao_no.khach AS ai,
    v_telecom_thue_bao_no.qua_han_lau_nhat AS tuoi_ngay,
    v_telecom_thue_bao_no.no AS tien,
    NULL::text AS nguoi,
    v_telecom_thue_bao_no.link_cms AS url
   FROM v_telecom_thue_bao_no
  WHERE COALESCE(v_telecom_thue_bao_no.loai_khach, ''::text) <> 'AGENCY'::text AND v_telecom_thue_bao_no.no > 0::numeric
UNION ALL
 SELECT 'cam_tay'::text AS he,
    'CHO_THU_MAY'::text AS tram,
    m.imei AS id,
    m.imei AS ma,
    m.khach AS ai,
    CURRENT_DATE - s.terminated_on AS tuoi_ngay,
    m.coc AS tien,
    NULL::text AS nguoi,
    m.link_cms AS url
   FROM v_telecom_may m
     JOIN subscription_snapshot s ON s.source = 'TELECOM'::source_system AND s.source_id = m.thue_bao_hien_tai
     JOIN v_kho_phan_mem k ON k.ma = m.imei AND k.cho_dung = 'O_KHACH'::text
  WHERE m.ngay_tra IS NULL AND m.trang_thai = 'RENTING'::text AND m.trang_thai_thue_bao = 'TERMINATED'::text AND NOT m.khong_thu_hoi AND s.terminated_on IS NOT NULL AND s.terminated_on <= CURRENT_DATE AND COALESCE(m.nhom_khach, ''::text) !~~ '%ĐẠI LÝ%'::text;

comment on view v_tram_chi_tiet is
  'Từng việc đang nằm ở mỗi trạm — nguồn gốc của cả bảng trạm lẫn ngăn kéo';

create view v_tram_van_hanh as
 WITH ra AS (
         SELECT ( SELECT round(count(*)::numeric / 4.0) AS round
                   FROM v_fixed_contract
                  WHERE v_fixed_contract.do_cong_ty AND v_fixed_contract.ngay_lap_xong >= (CURRENT_DATE - 28)) AS lap_xong,
            ( SELECT round(count(*)::numeric / 4.0) AS round
                   FROM deposit_allocation_snapshot
                  WHERE deposit_allocation_snapshot.source = 'FIXED'::source_system AND deposit_allocation_snapshot.status = 'APPROVED'::text AND deposit_allocation_snapshot.approved_at >= (CURRENT_DATE - 28)) AS duyet_coc,
            ( SELECT round(count(*)::numeric / 4.0) AS round
                   FROM stock_move_snapshot
                  WHERE stock_move_snapshot.source = 'TELECOM'::source_system AND stock_move_snapshot.doc_type = 'INVENTORY_IN'::text AND stock_move_snapshot.reason_type = 'RECEIPT_FOR_CANCELLED_SUBSCRIPTION'::text AND stock_move_snapshot.doc_date >= (CURRENT_DATE - 28)) AS may_ve,
            ( SELECT round(count(*)::numeric / 4.0) AS round
                   FROM payment_reconcile_snapshot
                  WHERE payment_reconcile_snapshot.source = 'TELECOM'::source_system AND payment_reconcile_snapshot.created_at_src >= (CURRENT_DATE - 28)) AS gan_hd
        )
 SELECT he,
    tram AS ma,
    count(*) AS ton,
    round(avg(tuoi_ngay))::integer AS tuoi_tb,
    max(tuoi_ngay) AS gia_nhat,
        CASE
            WHEN tram = 'CHO_HEN'::text THEN 0
            ELSE count(*) FILTER (WHERE tuoi_ngay > 90)::integer
        END AS qua_lau,
    NULLIF(sum(tien), 0::numeric) AS tien,
        CASE tram
            WHEN 'KHAO_SAT'::text THEN ( SELECT ra.lap_xong
               FROM ra)
            WHEN 'CHO_HEN'::text THEN ( SELECT ra.lap_xong
               FROM ra)
            WHEN 'QUA_HEN'::text THEN ( SELECT ra.lap_xong
               FROM ra)
            WHEN 'CHO_DUYET_COC'::text THEN ( SELECT ra.duyet_coc
               FROM ra)
            WHEN 'CHO_GAN_HD'::text THEN ( SELECT ra.gan_hd
               FROM ra)
            WHEN 'CHO_THU_MAY'::text THEN ( SELECT ra.may_ve
               FROM ra)
            ELSE NULL::numeric
        END AS ra_moi_tuan
   FROM v_tram_chi_tiet d
  GROUP BY he, tram;

comment on view v_tram_van_hanh is
  'Việc đang nằm ở trạm nào: tồn, tuổi, tốc độ ra mỗi tuần — gom từ v_tram_chi_tiet nên luôn khớp ngăn kéo';
