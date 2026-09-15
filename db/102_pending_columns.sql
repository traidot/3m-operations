-- Tách "chờ duyệt" và "chỉ ghi chú" ra khỏi cột còn thiếu.
--
-- Hai loại này vốn nằm lẫn trong "còn thiếu" vì v_fixed_settled_fee chỉ nhận
-- dòng APPROVED — kỳ có phiếu chờ duyệt đọc y như kỳ chưa ai đụng tới, trong
-- khi thực tế tiền đã cầm rồi, chỉ thiếu chữ ký. Dòng "chưa chốt" ở chân bảng
-- nói tổng cộng 70 kỳ chờ duyệt và 374 kỳ ghi chú, nhưng không biết rơi vào
-- tháng nào.
--
-- Sau khi tách, hàng ngang vẫn khép kín:
--   phải thu = miễn phí + đã thu + thu thiếu + chờ duyệt + ghi chú + còn thiếu
-- "Còn thiếu" từ giờ đúng nghĩa: kỳ không có một dòng nào trong sổ.

create or replace view v_fixed_monthly_billing as
 WITH so AS (
   SELECT f.subscription_source_id AS sid,
          f.period AS ky,
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
    -- Chỉ còn kỳ trắng trơn: không duyệt, không phiếu chờ, không cả ghi chú.
    sum(e.phai_thu) FILTER (
      WHERE st.ky IS NULL
        AND NOT COALESCE(so.co_cho_duyet, false)
        AND NOT COALESCE(so.co_ghi_chu, false)) AS con_thieu,
    round(100.0 * COALESCE(sum(st.tien_thu), 0::numeric)
          / NULLIF(sum(e.phai_thu) FILTER (WHERE NOT COALESCE(st.mien_phi, false)), 0::numeric), 1)
      AS ty_le_thu,
    COALESCE(sum(e.phai_thu) FILTER (
      WHERE st.ky IS NOT NULL AND NOT st.mien_phi), 0::numeric)
      - COALESCE(sum(st.tien_thu), 0::numeric) AS thu_thieu,
    -- Đã có phiếu thu nhưng chưa ai duyệt: tiền cầm rồi, chưa vào sổ chính thức.
    sum(e.phai_thu) FILTER (
      WHERE st.ky IS NULL AND so.co_cho_duyet) AS cho_duyet,
    sum(e.phai_thu) FILTER (
      WHERE st.ky IS NULL AND NOT COALESCE(so.co_cho_duyet, false)
        AND so.co_ghi_chu) AS ghi_chu
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
    sum(ghi_chu) AS ghi_chu
   FROM v_fixed_monthly_billing
  GROUP BY ky;
