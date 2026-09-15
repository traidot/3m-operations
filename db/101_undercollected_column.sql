-- Bốn cột tiền của bảng theo tháng không cộng lại thành phải thu.
--
-- "Còn thiếu" chỉ đếm kỳ KHÔNG có dòng nào trong sổ. Kỳ đã có dòng duyệt nhưng
-- thu ít hơn giá cước thì rơi ra ngoài cả bốn cột: T07/2026 mất hút 45.000 yên
-- trên 47 kỳ, cả năm 2026 là 186.598 yên. Nhìn bảng thấy "phải thu 1.009.900,
-- miễn phí 112.000, đã thu 784.900, còn thiếu 68.000" rồi tự cộng thì hụt, mà
-- không có chỗ nào giải thích phần hụt đó.
--
-- Thêm cột thu_thieu tính bằng phần dư, nên hàng ngang luôn khép kín:
--   phải thu = miễn phí + đã thu + còn thiếu + thu thiếu
-- Số âm nghĩa là thu dư so với giá cước ghi trên hợp đồng.

create or replace view v_fixed_monthly_billing as
 SELECT e.ky,
    s.status AS trang_thai,
    count(*) AS so_hop_dong,
    sum(e.phai_thu) AS phai_thu,
    count(*) FILTER (WHERE st.mien_phi) AS so_ky_mien_phi,
    sum(e.phai_thu) FILTER (WHERE st.mien_phi) AS tien_mien_phi,
    COALESCE(sum(st.tien_thu), 0::numeric) AS da_thu,
    sum(e.phai_thu) FILTER (WHERE st.ky IS NULL) AS con_thieu,
    round(100.0 * COALESCE(sum(st.tien_thu), 0::numeric)
          / NULLIF(sum(e.phai_thu) FILTER (WHERE NOT COALESCE(st.mien_phi, false)), 0::numeric), 1)
      AS ty_le_thu,
    -- Kỳ đã có dòng duyệt, không miễn phí, mà số tiền trong sổ ít hơn giá cước.
    COALESCE(sum(e.phai_thu) FILTER (
      WHERE st.ky IS NOT NULL AND NOT st.mien_phi), 0::numeric)
      - COALESCE(sum(st.tien_thu), 0::numeric) AS thu_thieu
   FROM v_fixed_expected_fee e
     JOIN subscription_snapshot s ON s.source = 'FIXED'::source_system AND s.source_id = e.subscription_id
     LEFT JOIN v_fixed_settled_fee st ON st.subscription_id = e.subscription_id AND st.ky = e.ky
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
    sum(thu_thieu) AS thu_thieu
   FROM v_fixed_monthly_billing
  GROUP BY ky;
