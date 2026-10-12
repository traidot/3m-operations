-- Sim xuất kho là xong, không thu hồi.
--
-- Mọi loại sim: datacall vật lý, datacall esim, softbank, sim data 1 năm. Trước
-- đây 490 dòng sim bị xếp O_KHACH nên lọt vào trạm chờ thu máy chung với máy
-- wifi, trong khi sim xuất rồi là hết việc.
--
-- Nhận sim theo tên đời máy chứ không theo device_type, vì sim datacall esim và
-- sim data 1 năm chỉ có trên phiếu xuất, không có trong device_snapshot nên
-- device_type rỗng. Đã đối chiếu hai chiều: không có sim nào tên không bắt đầu
-- bằng "Sim", và không có máy wifi nào tên bắt đầu bằng "Sim".
--
-- Chỉ áp cho sim mà phiếu cuối là phiếu xuất. Sim có phiếu nhập cuối vẫn còn
-- trong kho nên phải để TRONG_KHO — 29 dòng như vậy.
--
-- Nhánh này đứng sau các lý do xuất cụ thể (trả NCC, đã bán, hỏng huỷ, điều
-- chỉnh sổ) để sim xuất vì những lý do đó vẫn giữ đúng nhãn lý do.

create or replace view v_kho_phan_mem as
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
            WHEN p.doc_type = 'INVENTORY_OUT'::text AND COALESCE(m.model, p.product_name) ~* '^sim'::text THEN 'SIM_DA_XUAT'::text
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
