-- Dải T01–T12: tháng chưa tới hạn đóng thì đừng tô đỏ như tháng nợ.
--
-- Trước đây kỳ nào không có tiền là 'NO', kể cả tháng đang chạy — nhìn vào
-- bảng thì mọi hợp đồng đều đỏ ở tháng này, tô đỏ mà không có việc gì để làm.
-- Thêm 'CHUA_DEN_HAN' cho tháng chưa qua mốc mùng 10 của tháng sau, và
-- 'CHO_COC' cho tháng đã có tiền khách nộp đang nằm chờ duyệt.
--
-- Chỉ đổi ở dải hiển thị, không đụng tới trang_thai của kỳ — báo cáo tháng
-- đếm theo trang_thai nên thêm giá trị ở đó là lặng lẽ đổi mọi số tổng.

create or replace view v_fixed_year_status as
 WITH nam AS (
         SELECT EXTRACT(year FROM CURRENT_DATE)::integer AS y,
            make_date(EXTRACT(year FROM CURRENT_DATE)::integer, 1, 1) AS dau_nam,
            make_date(EXTRACT(year FROM CURRENT_DATE)::integer, 12, 31) AS cuoi_nam
        ), doan AS (
         SELECT s.source_id,
            GREATEST(s.fee_start_on, n.dau_nam) AS tu_ngay,
            LEAST(COALESCE(s.fee_end_on, n.cuoi_nam), n.cuoi_nam) AS den_ngay,
            EXTRACT(year FROM s.fee_start_on) = n.y::numeric AS co_mo_dau,
            s.fee_end_on IS NOT NULL AND EXTRACT(year FROM s.fee_end_on) = n.y::numeric AS co_ket_thuc
           FROM subscription_snapshot s, nam n
          WHERE s.source = 'FIXED'::source_system
        )
 SELECT c.source_id AS subscription_id,
    (SELECT nam.y FROM nam) AS nam,
        CASE WHEN d.tu_ngay <= d.den_ngay THEN EXTRACT(month FROM d.tu_ngay)::integer
             ELSE NULL::integer END AS tu_thang,
        CASE WHEN d.tu_ngay <= d.den_ngay THEN EXTRACT(month FROM d.den_ngay)::integer
             ELSE NULL::integer END AS den_thang,
    COALESCE(d.co_mo_dau, false) AS co_mo_dau,
    COALESCE(d.co_ket_thuc, false) AS co_ket_thuc,
    array_agg(
      CASE
        WHEN p.trang_thai IS NULL          THEN 'NA'
        WHEN p.trang_thai <> 'NO'          THEN p.trang_thai
        WHEN p.coc_cho_duyet > 0           THEN 'CHO_COC'
        WHEN NOT p.qua_han                 THEN 'CHUA_DEN_HAN'
        ELSE 'NO'
      END ORDER BY m.thang) AS cac_ky
   FROM subscription_snapshot c
     JOIN doan d ON d.source_id = c.source_id
     CROSS JOIN generate_series(1, 12) m(thang)
     LEFT JOIN v_fixed_contract_period p
            ON p.subscription_id = c.source_id
           AND p.ky = to_char(make_date((SELECT nam.y FROM nam), m.thang, 1), 'YYYY-MM')
  WHERE c.source = 'FIXED'::source_system
  GROUP BY c.source_id, d.tu_ngay, d.den_ngay, d.co_mo_dau, d.co_ket_thuc;
