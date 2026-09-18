-- Kỳ "tuỳ chỉnh số tiền thu" không phải là thu thiếu.
--
-- 114 đã kéo cờ isManuallySettled về. Giờ dùng nó: bên CMS bật ô đó nghĩa là
-- tháng này thu ít hơn cước/tháng nhưng vẫn coi là xong — giảm trừ, ưu đãi,
-- xử lý đặc biệt. Phần chênh là GIẢM TRỪ, không phải nợ.
--
-- 200 trong 213 kỳ đang bị báo "thu thiếu" chính là nhóm này, 190.100 trên
-- 198.748 yên. Sau khi sửa chỉ còn 9 kỳ hụt thật, 6.148 yên — con số đi soi
-- từng cái được.
--
-- Kỳ "không thu cước" (isNoCollection) xử lý cùng chỗ: đã quyết định không thu
-- thì toàn bộ tiền kỳ đó là giảm trừ. Hiện có 1 kỳ.
--
-- Hàng ngang của bảng theo tháng vẫn khép kín, thêm một số hạng:
--   phải thu = miễn phí + đã thu + giảm trừ + thu thiếu + chờ duyệt + ghi chú
--            + còn thiếu


create or replace view v_fixed_settled_fee as
 SELECT subscription_source_id AS subscription_id,
    period AS ky,
    bool_or(is_free) AS mien_phi,
    sum(CASE WHEN is_free THEN 0::numeric ELSE amount END) AS tien_thu,
    bool_or(tuy_chinh) AS tuy_chinh,
    bool_or(khong_thu) AS khong_thu
   FROM fee_period_snapshot f
  WHERE source = 'FIXED'::source_system AND status = 'APPROVED'::text
  GROUP BY subscription_source_id, period;


create or replace view v_fixed_contract_period as
 WITH so AS (
         SELECT fee_period_snapshot.subscription_source_id AS subscription_id,
            fee_period_snapshot.period AS ky,
            bool_or(fee_period_snapshot.status = 'APPROVED'::text AND fee_period_snapshot.is_free) AS co_mien_phi,
            bool_or(fee_period_snapshot.status = 'APPROVED'::text AND NOT fee_period_snapshot.is_free) AS co_duyet,
            bool_or(fee_period_snapshot.status = 'PENDING_APPROVAL'::text) AS co_cho_duyet,
            bool_or(fee_period_snapshot.status = 'NOTE_ONLY'::text) AS co_ghi_chu,
            sum(
                CASE
                    WHEN fee_period_snapshot.status = 'APPROVED'::text AND NOT fee_period_snapshot.is_free THEN fee_period_snapshot.amount
                    ELSE 0::numeric
                END) AS tien,
            max(fee_period_snapshot.paid_at) AS thu_luc,
            max(fee_period_snapshot.channel) AS kenh,
            max(fee_period_snapshot.created_by_src) AS nguoi_nhap_id,
            bool_or(fee_period_snapshot.tuy_chinh) AS tuy_chinh,
            bool_or(fee_period_snapshot.khong_thu) AS khong_thu
           FROM fee_period_snapshot
          WHERE fee_period_snapshot.source = 'FIXED'::source_system
          GROUP BY fee_period_snapshot.subscription_source_id, fee_period_snapshot.period
        )
 SELECT COALESCE(e.subscription_id, so.subscription_id) AS subscription_id,
    COALESCE(e.ky, so.ky) AS ky,
    e.phai_thu,
        CASE
            WHEN so.co_mien_phi THEN 'MIEN_PHI'::text
            WHEN so.co_duyet THEN 'DA_THU'::text
            WHEN so.co_cho_duyet THEN 'CHO_DUYET'::text
            WHEN so.co_ghi_chu THEN 'GHI_CHU'::text
            ELSE 'NO'::text
        END AS trang_thai,
    e.ky IS NULL AS ngoai_ky_tinh,
    so.tien,
    so.thu_luc,
    so.kenh,
    COALESCE(nv.display_name, so.nguoi_nhap_id) AS nguoi_nhap,
    e.ky IS NOT NULL AND e.ky <= c.ky_chot AS qua_han,
    COALESCE(dp.tien, 0::numeric) AS coc_cho_duyet,
    COALESCE(so.tuy_chinh, false) AS tuy_chinh,
    COALESCE(so.khong_thu, false) AS khong_thu
   FROM v_fixed_expected_fee e
     FULL JOIN so ON so.subscription_id = e.subscription_id AND so.ky = e.ky
     LEFT JOIN staff_snapshot nv ON nv.source = 'FIXED'::source_system AND nv.source_id = so.nguoi_nhap_id
     CROSS JOIN v_fixed_ky_chot c
     LEFT JOIN v_fixed_deposit_period dp ON dp.subscription_id = COALESCE(e.subscription_id, so.subscription_id) AND dp.ky = COALESCE(e.ky, so.ky);

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
          WHERE v_fixed_contract_period.trang_thai = 'DA_THU'::text
            AND v_fixed_contract_period.phai_thu IS NOT NULL
            AND v_fixed_contract_period.tien < v_fixed_contract_period.phai_thu
            -- Kỳ được đánh dấu tuỳ chỉnh hoặc không thu thì thu ít hơn cước là
            -- có chủ ý, không phải hụt. Xem db/114.
            AND NOT v_fixed_contract_period.tuy_chinh
            AND NOT v_fixed_contract_period.khong_thu
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
              WHERE cs.ten = lower(btrim(COALESCE(nv.display_name, s.created_by_src, ''::text))))) AND s.terminated_on IS NOT NULL AND s.fee_end_on IS NOT NULL AND abs(s.fee_end_on - s.terminated_on) > (( SELECT nguong.lech_ket_thuc
               FROM nguong)) THEN 'HUY_LECH_KY'::text
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

create or replace view v_fixed_monthly_billing as
 WITH so AS (
   SELECT f.subscription_source_id AS sid, f.period AS ky,
          bool_or(f.status = 'PENDING_APPROVAL'::text) AS co_cho_duyet,
          bool_or(f.status = 'NOTE_ONLY'::text)        AS co_ghi_chu
     FROM fee_period_snapshot f
    WHERE f.source = 'FIXED'::source_system
    GROUP BY f.subscription_source_id, f.period
 )
 SELECT e.ky,
    s.status AS trang_thai,
    count(*) AS so_hop_dong,
    sum(e.phai_thu) AS phai_thu,
    count(*) FILTER (WHERE st.mien_phi) AS so_ky_mien_phi,
    sum(e.phai_thu) FILTER (WHERE st.mien_phi) AS tien_mien_phi,
    COALESCE(sum(st.tien_thu), 0::numeric) AS da_thu,
    sum(e.phai_thu) FILTER (
      WHERE st.ky IS NULL AND NOT COALESCE(so.co_cho_duyet, false)
        AND NOT COALESCE(so.co_ghi_chu, false)) AS con_thieu,
    round(100.0 * COALESCE(sum(st.tien_thu), 0::numeric)
          / NULLIF(sum(e.phai_thu) FILTER (WHERE NOT COALESCE(st.mien_phi, false)), 0::numeric), 1)
      AS ty_le_thu,
    -- Thu hụt THẬT là PHẦN DƯ, không tính tường minh: có kỳ vừa đánh miễn phí
    -- vừa có tiền thu, tính tường minh thì nó rơi ra ngoài mọi nhóm và hàng
    -- ngang hở. Lấy phần dư thì luôn khép kín:
    --   phải thu = miễn phí + đã thu + giảm trừ + thu thiếu + chờ duyệt
    --            + ghi chú + còn thiếu
    sum(e.phai_thu)
      - COALESCE(sum(e.phai_thu) FILTER (WHERE st.mien_phi), 0::numeric)
      - COALESCE(sum(st.tien_thu), 0::numeric)
      - (COALESCE(sum(e.phai_thu) FILTER (
           WHERE st.ky IS NOT NULL AND NOT st.mien_phi AND (st.tuy_chinh OR st.khong_thu)), 0::numeric)
         - COALESCE(sum(st.tien_thu) FILTER (
           WHERE st.ky IS NOT NULL AND NOT st.mien_phi AND (st.tuy_chinh OR st.khong_thu)), 0::numeric))
      - COALESCE(sum(e.phai_thu) FILTER (WHERE st.ky IS NULL AND so.co_cho_duyet), 0::numeric)
      - COALESCE(sum(e.phai_thu) FILTER (
          WHERE st.ky IS NULL AND NOT COALESCE(so.co_cho_duyet, false) AND so.co_ghi_chu), 0::numeric)
      - COALESCE(sum(e.phai_thu) FILTER (
          WHERE st.ky IS NULL AND NOT COALESCE(so.co_cho_duyet, false)
            AND NOT COALESCE(so.co_ghi_chu, false)), 0::numeric)
      AS thu_thieu,
    sum(e.phai_thu) FILTER (
      WHERE st.ky IS NULL AND so.co_cho_duyet) AS cho_duyet,
    sum(e.phai_thu) FILTER (
      WHERE st.ky IS NULL AND NOT COALESCE(so.co_cho_duyet, false)
        AND so.co_ghi_chu) AS ghi_chu,
    -- Giảm trừ có chủ ý: bên CMS bật "tuỳ chỉnh số tiền thu" hoặc "không thu
    -- cước". Phần chênh giữa giá cước và tiền thu là tiền đã quyết định bỏ.
    COALESCE(sum(e.phai_thu) FILTER (
      WHERE st.ky IS NOT NULL AND NOT st.mien_phi
        AND (st.tuy_chinh OR st.khong_thu)), 0::numeric)
      - COALESCE(sum(st.tien_thu) FILTER (
      WHERE st.ky IS NOT NULL AND NOT st.mien_phi
        AND (st.tuy_chinh OR st.khong_thu)), 0::numeric)
      AS giam_tru
   FROM v_fixed_expected_fee e
     JOIN subscription_snapshot s ON s.source = 'FIXED'::source_system AND s.source_id = e.subscription_id
     LEFT JOIN v_fixed_settled_fee st ON st.subscription_id = e.subscription_id AND st.ky = e.ky
     LEFT JOIN so ON so.sid = e.subscription_id AND so.ky = e.ky
  GROUP BY e.ky, s.status;

create or replace view v_fixed_monthly_total as
 SELECT ky,
    sum(so_hop_dong) AS so_hop_dong,
    sum(phai_thu) AS phai_thu,
    sum(tien_mien_phi) AS tien_mien_phi,
    sum(da_thu) AS da_thu,
    sum(con_thieu) AS con_thieu,
    round(100.0 * sum(da_thu)
          / NULLIF(sum(phai_thu) - COALESCE(sum(tien_mien_phi), 0::numeric), 0::numeric), 1)
      AS ty_le_thu,
    sum(thu_thieu) AS thu_thieu,
    sum(cho_duyet) AS cho_duyet,
    sum(ghi_chu) AS ghi_chu,
    sum(giam_tru) AS giam_tru
   FROM v_fixed_monthly_billing
  GROUP BY ky;
