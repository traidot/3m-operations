-- Tách "thiếu giá cước" thành hai nhãn: thiếu GIÁ và thiếu NGÀY BẮT ĐẦU THU.
--
-- Trước đây một nhãn THIEU_CUOC gánh cả hai điều kiện nối bằng OR, mà nhãn lại
-- chỉ ghi "thiếu giá cước" — đọc sai hẳn khi hợp đồng có giá mà trống
-- feeStartDate. Hôm nay chưa lộ vì 96/99 hợp đồng thiếu cả hai, nhưng nhãn sai
-- thì sớm muộn cũng dẫn người ta đi nhầm ô cần điền bên CMS.
--
-- Hai nhãn đếm độc lập, hợp đồng thiếu cả hai thì mang cả hai — không gộp,
-- không loại trừ nhau.
--
-- Sửa luôn cột "sổ CMS" của 099: nó đang đếm mọi dòng bất kể trạng thái, nên
-- cộng cả dòng ghi chú và miễn phí 0 yên vào — thành ra sổ trông "thu nhiều hơn
-- mình tính", chuyện không đời nào có. Giờ chỉ đếm dòng APPROVED có tiền thật,
-- và sổ luôn nhỏ hơn hoặc bằng số kỳ mình tính, đúng như phải thế. Kỳ nằm
-- ngoài luật tính rút từ 291 xuống 14 hợp đồng, 23.150 yên — con số đi soi được.

create or replace view v_fixed_contract as
 WITH ky_cuoi AS (
         SELECT v_fixed_settled_fee.subscription_id,
            max(v_fixed_settled_fee.ky) AS ky_da_thu_gan_nhat
           FROM v_fixed_settled_fee
          GROUP BY v_fixed_settled_fee.subscription_id
        ), so AS (
         SELECT fee_period_snapshot.subscription_source_id AS subscription_id,
            count(*) FILTER (WHERE fee_period_snapshot.status = 'PENDING_APPROVAL'::text) AS ky_cho_duyet,
            count(*) FILTER (WHERE fee_period_snapshot.status = 'NOTE_ONLY'::text) AS ky_ghi_chu
           FROM fee_period_snapshot
          WHERE fee_period_snapshot.source = 'FIXED'::source_system
          GROUP BY fee_period_snapshot.subscription_source_id
        ), ngoai AS (
         SELECT v_fixed_contract_period.subscription_id,
            count(*) AS ky_ngoai
           FROM v_fixed_contract_period
          WHERE v_fixed_contract_period.ngoai_ky_tinh
          GROUP BY v_fixed_contract_period.subscription_id
        ), thieu AS (
         SELECT v_fixed_contract_period.subscription_id,
            count(*) AS ky_thu_thieu,
            sum(v_fixed_contract_period.phai_thu - v_fixed_contract_period.tien) AS tien_thieu
           FROM v_fixed_contract_period
          WHERE v_fixed_contract_period.trang_thai = 'DA_THU'::text AND v_fixed_contract_period.phai_thu IS NOT NULL AND v_fixed_contract_period.tien < v_fixed_contract_period.phai_thu
          GROUP BY v_fixed_contract_period.subscription_id
        ), nguong AS (
         SELECT ( SELECT threshold.value::integer AS value
                   FROM threshold
                  WHERE threshold.key = 'fixed_arrears_periods'::text) AS ky_no,
            ( SELECT threshold.value::integer AS value
                   FROM threshold
                  WHERE threshold.key = 'fixed_install_wait_days'::text) AS ngay_cho_lap
        )
 SELECT s.source_id AS subscription_id,
    s.source_customer_id AS contract_code,
    o.address AS dia_chi,
    s.status AS trang_thai_hop_dong,
    o.status AS trang_thai_lap_dat,
    s.plan_name AS goi_cuoc,
    s.monthly_price AS cuoc_thang,
    s.fee_start_on,
    s.fee_end_on,
    o.signed_on AS ngay_ky,
    o.completed_on AS ngay_lap_xong,
    s.terminated_on AS ngay_huy,
    s.cancel_reason AS ly_do_huy,
    cancel_reason_group(s.cancel_reason) AS nhom_ly_do_huy,
    COALESCE(s.is_difficult_debt, false) AS kho_doi,
    s.created_at_src AS ngay_nhap,
    COALESCE(nv.display_name, s.created_by_src) AS nguoi_nhap,
    COALESCE(d.so_ky, 0::bigint) AS so_ky,
    COALESCE(d.so_ky_mien_phi, 0::bigint) AS so_ky_mien_phi,
    COALESCE(d.so_ky_no, 0::bigint) AS so_ky_no,
    COALESCE(d.tong_da_thu, 0::numeric) AS tong_da_thu,
    COALESCE(d.con_no, 0::numeric) AS con_no,
    k.ky_da_thu_gan_nhat,
    COALESCE(so.ky_cho_duyet, 0::bigint) AS ky_cho_duyet,
    COALESCE(so.ky_ghi_chu, 0::bigint) AS ky_ghi_chu,
    COALESCE(ng.ky_ngoai, 0::bigint) AS ky_ngoai,
    COALESCE(th.ky_thu_thieu, 0::bigint) AS ky_thu_thieu,
    COALESCE(th.tien_thieu, 0::numeric) AS tien_thieu,
        CASE
            WHEN NOT (EXISTS ( SELECT 1
               FROM fixed_company_staff cs
              WHERE cs.ten = lower(btrim(COALESCE(nv.display_name, s.created_by_src, ''::text))))) THEN 'DAI_LY'::text
            WHEN o.status <> 'DONE'::text THEN 'CHUA_LAP'::text
            WHEN d.subscription_id IS NULL THEN 'CHUA_TINH_DUOC'::text
            WHEN d.so_ky_no = 0 THEN 'DU'::text
            ELSE 'NO'::text
        END AS tinh_trang_cuoc,
    array_remove(ARRAY[
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM fixed_company_staff cs
              WHERE cs.ten = lower(btrim(COALESCE(nv.display_name, s.created_by_src, ''::text))))) AND COALESCE(d.so_ky_no, 0::bigint) >= (( SELECT nguong.ky_no
               FROM nguong)) THEN 'NO_NANG'::text
            ELSE NULL::text
        END,
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM fixed_company_staff cs
              WHERE cs.ten = lower(btrim(COALESCE(nv.display_name, s.created_by_src, ''::text))))) AND s.status = 'TERMINATED'::text AND GREATEST(COALESCE(d.con_no, 0::numeric) - COALESCE(dp.coc_cho_duyet, 0::numeric), 0::numeric) > 0::numeric THEN 'HUY_CON_NO'::text
            ELSE NULL::text
        END,
        CASE
            WHEN COALESCE(dp.coc_cho_duyet, 0::numeric) > 0::numeric THEN 'CO_COC'::text
            ELSE NULL::text
        END,
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM fixed_company_staff cs
              WHERE cs.ten = lower(btrim(COALESCE(nv.display_name, s.created_by_src, ''::text))))) AND s.status = 'ACTIVE'::text
             AND (s.monthly_price IS NULL OR s.monthly_price = 0::numeric)
            THEN 'THIEU_GIA_CUOC'::text
            ELSE NULL::text
        END,
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM fixed_company_staff cs
              WHERE cs.ten = lower(btrim(COALESCE(nv.display_name, s.created_by_src, ''::text))))) AND s.status = 'ACTIVE'::text
             AND s.fee_start_on IS NULL
            THEN 'THIEU_NGAY_THU'::text
            ELSE NULL::text
        END,
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM fixed_company_staff cs
              WHERE cs.ten = lower(btrim(COALESCE(nv.display_name, s.created_by_src, ''::text))))) AND COALESCE(so.ky_cho_duyet, 0::bigint) > 0 THEN 'CHO_DUYET'::text
            ELSE NULL::text
        END,
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM fixed_company_staff cs
              WHERE cs.ten = lower(btrim(COALESCE(nv.display_name, s.created_by_src, ''::text))))) AND COALESCE(so.ky_ghi_chu, 0::bigint) > 0 THEN 'GHI_CHU'::text
            ELSE NULL::text
        END,
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM fixed_company_staff cs
              WHERE cs.ten = lower(btrim(COALESCE(nv.display_name, s.created_by_src, ''::text))))) AND COALESCE(ng.ky_ngoai, 0::bigint) > 0 AND o.status = 'DONE'::text THEN 'NGOAI_KY'::text
            ELSE NULL::text
        END,
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM fixed_company_staff cs
              WHERE cs.ten = lower(btrim(COALESCE(nv.display_name, s.created_by_src, ''::text))))) AND COALESCE(th.ky_thu_thieu, 0::bigint) > 0 THEN 'THU_THIEU'::text
            ELSE NULL::text
        END,
        CASE
            WHEN s.is_difficult_debt THEN 'KHO_DOI'::text
            ELSE NULL::text
        END,
        CASE
            WHEN o.status = 'SURVEY'::text AND s.status <> 'TERMINATED'::text AND o.signed_on < (CURRENT_DATE - (( SELECT nguong.ngay_cho_lap
               FROM nguong))) THEN 'CHO_LAP_LAU'::text
            ELSE NULL::text
        END], NULL::text) AS canh_bao,
    COALESCE(d.so_ky_chua_den_han, 0::bigint) AS so_ky_chua_den_han,
    COALESCE(d.tien_chua_den_han, 0::numeric) AS tien_chua_den_han,
    COALESCE(dp.coc_cho_duyet, 0::numeric) AS coc_cho_duyet,
    COALESCE(dp.so_phieu_cho, 0::bigint) AS so_phieu_coc_cho,
    GREATEST(COALESCE(d.con_no, 0::numeric) - COALESCE(dp.coc_cho_duyet, 0::numeric), 0::numeric) AS con_no_sau_coc,
    (EXISTS ( SELECT 1
           FROM fixed_company_staff cs
          WHERE cs.ten = lower(btrim(COALESCE(nv.display_name, s.created_by_src, ''::text))))) AS do_cong_ty
   FROM subscription_snapshot s
     LEFT JOIN install_order_snapshot o ON o.source = 'FIXED'::source_system AND o.source_id = s.source_id
     LEFT JOIN v_fixed_debt d ON d.subscription_id = s.source_id
     LEFT JOIN v_fixed_deposit dp ON dp.subscription_id = s.source_id
     LEFT JOIN ky_cuoi k ON k.subscription_id = s.source_id
     LEFT JOIN so ON so.subscription_id = s.source_id
     LEFT JOIN ngoai ng ON ng.subscription_id = s.source_id
     LEFT JOIN thieu th ON th.subscription_id = s.source_id
     LEFT JOIN staff_snapshot nv ON nv.source = 'FIXED'::source_system AND nv.source_id = s.created_by_src
  WHERE s.source = 'FIXED'::source_system;

create or replace view v_fixed_month_chay as
 WITH moc AS (
         SELECT to_char(d.d, 'YYYY-MM'::text) AS ky,
            d.d::date AS d1,
            (d.d + '1 mon -1 days'::interval)::date AS d2
           FROM generate_series(( SELECT min(date_trunc('month'::text, c_1.ngay_lap_xong::timestamp with time zone)) AS min
                   FROM v_fixed_contract c_1
                  WHERE c_1.ngay_lap_xong IS NOT NULL), date_trunc('month'::text, CURRENT_DATE::timestamp with time zone) + '1 mon'::interval, '1 mon'::interval) d(d)
        ), cms AS (
         SELECT f.period AS ky,
            count(DISTINCT f.subscription_source_id) FILTER (
              WHERE w.do_cong_ty AND f.status = 'APPROVED'::text AND NOT f.is_free) AS so_cms,
            count(DISTINCT f.subscription_source_id) FILTER (
              WHERE w.do_cong_ty AND f.status = 'APPROVED'::text AND NOT f.is_free
                AND e2.subscription_id IS NULL) AS ngoai_ky
           FROM fee_period_snapshot f
             LEFT JOIN v_fixed_sub_owner w ON w.subscription_id = f.subscription_source_id
             LEFT JOIN v_fixed_expected_fee e2 ON e2.subscription_id = f.subscription_source_id AND e2.ky = f.period
          WHERE f.source = 'FIXED'::source_system
          GROUP BY f.period
        ), so AS (
         SELECT e.ky,
            count(DISTINCT e.subscription_id) AS co_ky
           FROM v_fixed_expected_fee e
          GROUP BY e.ky
        )
 SELECT m.ky,
    count(c.subscription_id) FILTER (WHERE o.do_cong_ty) AS cong_ty,
    count(c.subscription_id) FILTER (WHERE NOT o.do_cong_ty) AS dai_ly,
    COALESCE(so.co_ky, 0::bigint) AS co_ky_cuoc,
    count(c.subscription_id) FILTER (WHERE o.do_cong_ty AND (c.cuoc_thang IS NULL OR c.cuoc_thang = 0::numeric)) AS thieu_gia_cuoc,
    count(c.subscription_id) FILTER (WHERE o.do_cong_ty) - COALESCE(so.co_ky, 0::bigint) AS chenh,
    count(c.subscription_id) FILTER (WHERE o.do_cong_ty AND c.cuoc_thang > 0::numeric AND c.fee_start_on IS NOT NULL AND c.fee_start_on <= m.d2 AND (c.fee_end_on IS NULL OR c.fee_end_on >= m.d1)) AS phai_ra_ky,
    COALESCE(cms.so_cms, 0::bigint) AS so_cms,
    COALESCE(cms.ngoai_ky, 0::bigint) AS ngoai_ky,
    count(c.subscription_id) FILTER (WHERE o.do_cong_ty AND c.fee_start_on IS NULL) AS thieu_ngay_thu
   FROM moc m
     LEFT JOIN v_fixed_contract c ON c.trang_thai_lap_dat = 'DONE'::text AND c.ngay_lap_xong <= m.d2 AND (c.ngay_huy IS NULL OR c.ngay_huy >= m.d1)
     LEFT JOIN v_fixed_contract_owner o ON o.subscription_id = c.subscription_id
     LEFT JOIN so ON so.ky = m.ky
     LEFT JOIN cms ON cms.ky = m.ky
  GROUP BY m.ky, m.d1, m.d2, so.co_ky, cms.so_cms, cms.ngoai_ky;
