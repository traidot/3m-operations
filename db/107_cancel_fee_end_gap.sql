-- Cảnh báo ngày huỷ cách xa ngày kết thúc thu cước.
--
-- Bên nguồn có hai mốc rời nhau: feeCollectionEndDate (thu tới đâu) và
-- cancelDate (dịch vụ dừng lúc nào). 1.074 hợp đồng công ty đã huỷ có hai mốc
-- trùng khít, nhưng 91 cái lệch nhau — và lệch một chiều là mất tiền thật:
-- ngừng thu trước khi dịch vụ dừng, nghĩa là mấy tháng khách vẫn dùng mà không
-- ai xuất kỳ cước.
--
-- Đặt ngưỡng 31 ngày vì lệch dưới một tháng thường chỉ là chuyện chốt sổ cuối
-- tháng rồi huỷ vài ngày sau, không phải sai. Quá mốc đó còn 61 hợp đồng, tất
-- cả đều là ngừng thu sớm, ước chừng 228.000 yên tháng chạy mà không thu.
--
-- Lệch chiều ngược lại — thu kéo dài sau khi huỷ — đã có màn hình Thu ngoài
-- hợp đồng soi từng kỳ; ở đây gộp chung một cảnh báo vì cùng là hai mốc không
-- khớp nhau, người xem mở hợp đồng ra là thấy lệch chiều nào.

insert into threshold (key, value, unit, note) values
  ('fee_end_gap_days', '31', 'ngày',
   'Ngày kết thúc thu lệch ngày huỷ quá bao nhiêu ngày thì báo')
on conflict (key) do nothing;

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
                  WHERE threshold.key = 'fixed_install_wait_days'::text) AS ngay_cho_lap,
            ( SELECT threshold.value::integer AS value
                   FROM threshold
                  WHERE threshold.key = 'fee_end_gap_days'::text) AS lech_ket_thuc
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
              WHERE cs.ten = lower(btrim(COALESCE(nv.display_name, s.created_by_src, ''::text))))) AND s.status = 'ACTIVE'::text AND (s.monthly_price IS NULL OR s.monthly_price = 0::numeric) THEN 'THIEU_GIA_CUOC'::text
            ELSE NULL::text
        END,
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM fixed_company_staff cs
              WHERE cs.ten = lower(btrim(COALESCE(nv.display_name, s.created_by_src, ''::text))))) AND s.status = 'ACTIVE'::text AND s.fee_start_on IS NULL THEN 'THIEU_NGAY_THU'::text
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
        END,
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM fixed_company_staff cs
              WHERE cs.ten = lower(btrim(COALESCE(nv.display_name, s.created_by_src, ''::text)))))
             AND s.terminated_on IS NOT NULL AND s.fee_end_on IS NOT NULL
             AND abs(s.fee_end_on - s.terminated_on) > ((SELECT nguong.lech_ket_thuc FROM nguong))
            THEN 'HUY_LECH_KY'::text
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
