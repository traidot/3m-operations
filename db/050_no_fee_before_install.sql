-- Hợp đồng chưa lắp thì không có gì để thu.
--
-- v_fixed_expected_fee sinh đủ các tháng từ ngày bắt đầu thu đến ngày huỷ, rồi
-- v_fixed_contract_period coi tháng nào không có dòng cước là tháng nợ. Quy tắc
-- đó chỉ đúng với hợp đồng đã lắp xong: 3M không thu gì với đơn ký rồi mà không
-- lắp được. Bên nguồn có 9 hợp đồng chưa lắp vẫn được đặt feeStartDate (người
-- nhập đặt lúc ký, sau đó đơn hỏng), và 5 trong số đó chảy thành 26.000 yên nợ
-- không có thật, kèm cờ "nợ nặng" oan.
--
-- Chặn ngay ở chỗ sinh kỳ: chỉ hợp đồng đã lắp xong mới phát sinh cước. 12 dòng
-- cước thật nằm trên hợp đồng chưa lắp đều là 0 yên (miễn phí hoặc chỉ ghi chú)
-- nên không mất đồng nào khỏi báo cáo; chúng chuyển sang "ngoài kỳ tính".
--
-- Mọi hợp đồng đều có đơn lắp (kiểm: 0 hợp đồng thiếu), nên join thẳng, không
-- cần lo nhánh NULL.

create or replace view v_fixed_expected_fee as
select s.source,
       s.source_id                        as subscription_id,
       s.source_customer_id               as contract_code,
       to_char(thang.thang, 'YYYY-MM')    as ky,
       s.monthly_price                    as phai_thu
  from subscription_snapshot s
  join install_order_snapshot o
    on o.source = 'FIXED' and o.source_id = s.source_id
 cross join lateral generate_series(
         date_trunc('month', s.fee_start_on::timestamptz),
         date_trunc('month', least(coalesce(s.fee_end_on, current_date), current_date)::timestamptz),
         '1 mon'::interval) thang(thang)
 where s.source = 'FIXED'
   and o.status = 'DONE'
   and s.fee_start_on is not null
   and s.monthly_price > 0;

-- Cảnh báo "kỳ ngoài khoảng" nói rằng có dòng cước nằm ngoài khoảng hệ thống
-- tính được — trả trước, hoặc nhập nhầm năm. Với hợp đồng chưa lắp thì khoảng
-- tính rỗng nên dòng nào cũng "ngoài kỳ", báo lên chỉ là tiếng ồn. Chỉ cảnh báo
-- khi hợp đồng đã lắp.
--
-- Tình trạng cước của hợp đồng chưa lắp giờ là "chưa phát sinh", không phải
-- "thu đủ" (vì không sinh kỳ nào) cũng không phải "chưa tính được" (không thiếu
-- dữ liệu gì — đơn giản là chưa tới lúc thu).

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
            WHEN o.status <> 'DONE'::text THEN 'CHUA_LAP'::text
            WHEN d.subscription_id IS NULL THEN 'CHUA_TINH_DUOC'::text
            WHEN d.so_ky_no = 0 THEN 'DU'::text
            ELSE 'NO'::text
        END AS tinh_trang_cuoc,
    array_remove(ARRAY[
        CASE
            WHEN COALESCE(d.so_ky_no, 0::bigint) >= (( SELECT nguong.ky_no
               FROM nguong)) THEN 'NO_NANG'::text
            ELSE NULL::text
        END,
        CASE
            WHEN s.status = 'TERMINATED'::text AND COALESCE(d.con_no, 0::numeric) > 0::numeric THEN 'HUY_CON_NO'::text
            ELSE NULL::text
        END,
        CASE
            WHEN s.status = 'ACTIVE'::text AND (s.monthly_price IS NULL OR s.monthly_price = 0::numeric OR s.fee_start_on IS NULL) THEN 'THIEU_CUOC'::text
            ELSE NULL::text
        END,
        CASE
            WHEN COALESCE(so.ky_cho_duyet, 0::bigint) > 0 THEN 'CHO_DUYET'::text
            ELSE NULL::text
        END,
        CASE
            WHEN COALESCE(so.ky_ghi_chu, 0::bigint) > 0 THEN 'GHI_CHU'::text
            ELSE NULL::text
        END,
        CASE
            WHEN COALESCE(ng.ky_ngoai, 0::bigint) > 0 AND o.status = 'DONE'::text THEN 'NGOAI_KY'::text
            ELSE NULL::text
        END,
        CASE
            WHEN COALESCE(th.ky_thu_thieu, 0::bigint) > 0 THEN 'THU_THIEU'::text
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
        END], NULL::text) AS canh_bao
   FROM subscription_snapshot s
     LEFT JOIN install_order_snapshot o ON o.source = 'FIXED'::source_system AND o.source_id = s.source_id
     LEFT JOIN v_fixed_debt d ON d.subscription_id = s.source_id
     LEFT JOIN ky_cuoi k ON k.subscription_id = s.source_id
     LEFT JOIN so ON so.subscription_id = s.source_id
     LEFT JOIN ngoai ng ON ng.subscription_id = s.source_id
     LEFT JOIN thieu th ON th.subscription_id = s.source_id
     LEFT JOIN staff_snapshot nv ON nv.source = 'FIXED'::source_system AND nv.source_id = s.created_by_src
  WHERE s.source = 'FIXED'::source_system;;
