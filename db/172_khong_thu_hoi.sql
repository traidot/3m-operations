-- Cờ "xuất đi không cần thu hồi" đưa lên tới màn hình.
--
-- Máy được đánh dấu ở phiếu xuất là máy không bao giờ về kho. Mọi chỗ đếm
-- "máy phải đòi về" mà không trừ nhóm này ra đều kể oan: riêng dòng "huỷ rồi
-- mà máy chưa về" đang báo 1.743 trong khi 1.097 thuộc nhóm này, số phải đòi
-- thật chỉ 646.
--
-- Xét TỪNG CÓ đánh dấu ở bất kỳ phiếu nào, không chỉ phiếu gần nhất: máy đã
-- xuất theo kiểu không thu hồi rồi thì phiếu sau đó không đổi bản chất.

create or replace view v_kho_ma as
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
select ma.ma_chuan,
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
    (EXISTS (
       SELECT 1 FROM stock_move_snapshot sm
        WHERE sm.source = 'TELECOM'::source_system
          AND sm.is_no_recall
          AND ltrim(sm.device_code, '0') = ma.ma_chuan
     )) AS khong_thu_hoi
   FROM ma
     LEFT JOIN v_kho_phan_mem p ON p.ma_chuan = ma.ma_chuan
     LEFT JOIN loai l ON l.ma_chuan = ma.ma_chuan
     LEFT JOIN stock_audit_row a ON a.ma_chuan = ma.ma_chuan;
