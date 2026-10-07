-- Hàng đợi và trạm phải nói cùng một con số.
--
-- Hai chỗ đang vênh, và vênh theo hướng xấu nhất: hàng đợi RỘNG HƠN trạm, tức
-- bắt người đi làm những việc mà chính bản đồ trạm bảo là không còn.
--
-- (1) "Bật thu cước": hàng đợi 103, trạm 39.
--
--     Trạng thái CHUA_HOAT_DONG gộp hai thứ khác hẳn nhau — 31 hợp đồng KHÔNG
--     CÓ ngày bắt đầu thu (lỗi nhập liệu, phải sửa) và 85 hợp đồng có ngày thu
--     Ở TƯƠNG LAI (bình thường, chỉ là chưa tới ngày). Hàng đợi đang bắt người
--     đi sửa cả 85 cái không hỏng. Đúng là chuyện đã tách bên lắp đặt giữa "có
--     lịch, chờ tới ngày" và "quá ngày hẹn".
--
--     Trạm cũng đổi sang đọc v_fixed_chua_hoat_dong luôn: trước đó nó tự join
--     install_order nên đếm thêm 8 hợp đồng có completed_on mà đơn chưa ở
--     trạng thái DONE. Cùng một nguồn thì không còn chỗ để lệch.
--
-- (2) "Thu hồi máy": hàng đợi 552, trạm 540 — hàng đợi chưa lọc phiếu kho nên
--     còn 92 máy ĐÃ về kho và 6 cái đã hỏng. Lần trước chỉ sửa v_tram_chi_tiet
--     mà quên v_viec_hom_nay.

drop view if exists v_tram_van_hanh;
drop view if exists v_tram_chi_tiet;
drop view if exists v_viec_hom_nay;

create view v_viec_hom_nay as
 WITH n AS (
         SELECT ( SELECT threshold.value::integer AS value
                   FROM threshold
                  WHERE threshold.key = 'goi_lai_khao_sat_ngay'::text) AS goi_lai,
            ( SELECT threshold.value::integer AS value
                   FROM threshold
                  WHERE threshold.key = 'bat_thu_cuoc_ngay'::text) AS bat_thu,
            ( SELECT threshold.value::integer AS value
                   FROM threshold
                  WHERE threshold.key = 'duyet_phieu_coc_ngay'::text) AS duyet_coc,
            ( SELECT threshold.value::integer AS value
                   FROM threshold
                  WHERE threshold.key = 'gan_hoa_don_ngay'::text) AS gan_hd,
            ( SELECT threshold.value::integer AS value
                   FROM threshold
                  WHERE threshold.key = 'thu_hoi_may_ngay'::text) AS thu_may
        )
 SELECT 'co_dinh'::text AS he,
    'GOI_LAI'::text AS viec,
    o.source_id AS id,
    c.contract_code AS ma,
    o.address AS ai,
    CURRENT_DATE - o.signed_on AS tuoi_ngay,
    NULL::numeric AS tien,
    c.nguoi_nhap AS nguoi,
    contract_url(o.source_id) AS url
   FROM install_order_snapshot o
     JOIN v_fixed_contract c ON c.subscription_id = o.source_id
     CROSS JOIN n
  WHERE o.source = 'FIXED'::source_system AND c.do_cong_ty AND o.completed_on IS NULL AND o.scheduled_at IS NULL AND c.trang_thai_hop_dong <> 'TERMINATED'::text AND o.signed_on IS NOT NULL AND (CURRENT_DATE - o.signed_on) > n.goi_lai
UNION ALL
 SELECT 'co_dinh'::text AS he,
    'BAT_THU_CUOC'::text AS viec,
    d.subscription_id AS id,
    d.ma_hd AS ma,
    d.dia_chi AS ai,
    d.sau_lap_ngay AS tuoi_ngay,
    d.cuoc_thang AS tien,
    d.nguoi_nhap AS nguoi,
    d.url
   FROM v_fixed_chua_hoat_dong d
     LEFT JOIN v_fixed_contract c ON c.subscription_id = d.subscription_id
     CROSS JOIN n
  WHERE COALESCE(c.do_cong_ty, true) AND d.sau_lap_ngay > n.bat_thu AND d.ngay_bat_dau_thu IS NULL
UNION ALL
 SELECT 'co_dinh'::text AS he,
    'DIEN_GIA_CUOC'::text AS viec,
    c.subscription_id AS id,
    c.contract_code AS ma,
    c.dia_chi AS ai,
    CURRENT_DATE - c.ngay_ky AS tuoi_ngay,
    NULL::numeric AS tien,
    c.nguoi_nhap AS nguoi,
    contract_url(c.subscription_id) AS url
   FROM v_fixed_contract c
  WHERE c.do_cong_ty AND ('THIEU_GIA_CUOC'::text = ANY (c.canh_bao))
UNION ALL
 SELECT 'co_dinh'::text AS he,
    'DUYET_COC'::text AS viec,
    d.source_id AS id,
    d.ma_hd AS ma,
    d.dia_chi AS ai,
    d.cho_ngay AS tuoi_ngay,
    d.tien,
    NULL::text AS nguoi,
    d.url
   FROM v_fixed_coc_cho_phan_bo d
     LEFT JOIN v_fixed_contract c ON c.contract_code = d.ma_hd
     CROSS JOIN n
  WHERE COALESCE(c.do_cong_ty, true) AND d.cho_ngay > n.duyet_coc
UNION ALL
 SELECT 'cam_tay'::text AS he,
    'GAN_HOA_DON'::text AS viec,
    t.payment_id AS id,
    t.ma_khach AS ma,
    t.khach AS ai,
    t.so_ngay_treo AS tuoi_ngay,
    t.amount AS tien,
    NULL::text AS nguoi,
    t.link_cms AS url
   FROM v_telecom_thu_chua_can_tru t
     CROSS JOIN n
  WHERE t.so_ngay_treo > n.gan_hd AND COALESCE(t.loai_khach, ''::text) <> 'AGENCY'::text
UNION ALL
 SELECT 'cam_tay'::text AS he,
    'THU_HOI_MAY'::text AS viec,
    m.imei AS id,
    m.imei AS ma,
    m.khach AS ai,
    CURRENT_DATE - s.terminated_on AS tuoi_ngay,
    m.coc AS tien,
    NULL::text AS nguoi,
    m.link_cms AS url
   FROM v_telecom_may m
     JOIN subscription_snapshot s ON s.source = 'TELECOM'::source_system AND s.source_id = m.thue_bao_hien_tai
     CROSS JOIN n
     JOIN v_kho_phan_mem kpm ON kpm.ma = m.imei AND kpm.cho_dung = 'O_KHACH'::text
  WHERE m.ngay_tra IS NULL AND m.trang_thai = 'RENTING'::text AND m.trang_thai_thue_bao = 'TERMINATED'::text AND NOT m.khong_thu_hoi AND s.terminated_on IS NOT NULL AND s.terminated_on <= CURRENT_DATE AND (CURRENT_DATE - s.terminated_on) > n.thu_may AND COALESCE(m.nhom_khach, ''::text) !~~ '%ĐẠI LÝ%'::text;

comment on view v_viec_hom_nay is
  'Hàng đợi việc phải làm, một dòng một việc, đã quá ngưỡng chờ — không gồm đại lý';

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
    cht.subscription_id AS id,
    cht.ma_hd AS ma,
    cht.dia_chi AS ai,
    cht.sau_lap_ngay AS tuoi_ngay,
    cht.cuoc_thang AS tien,
    cht.nguoi_nhap AS nguoi,
    cht.url
   FROM v_fixed_chua_hoat_dong cht
  WHERE cht.ngay_bat_dau_thu IS NULL
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
