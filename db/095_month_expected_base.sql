-- Thêm cột "phải ra kỳ": hợp đồng công ty đủ điều kiện sinh kỳ cước trong tháng.
--
-- Cột "công ty" đếm mọi hợp đồng đã lắp xong và chưa huỷ trong tháng, nhưng
-- không phải cái nào cũng ra được kỳ. Tháng 9/2026 đi từ 884 xuống 716:
--   −105  thiếu giá cước hoặc thiếu ngày bắt đầu thu
--   − 63  có giá nhưng khoảng thu chưa tới hoặc đã kết thúc trong tháng đó
--   = 716  phải ra kỳ — và sổ cước có đúng 716, khớp tuyệt đối.
--
-- Nên đây là chốt đối chiếu: "phải ra kỳ" lệch với "có kỳ cước" là sổ cước
-- thiếu dòng, chứ không phải chuyện bình thường. Vài tháng cũ lệch 1–4 hợp
-- đồng do ngày lắp hoặc khoảng thu bên nguồn sửa sau khi kỳ đã sinh.

create or replace view v_fixed_month_chay as
 WITH moc AS (
         SELECT to_char(d.d, 'YYYY-MM') AS ky,
            d.d::date AS d1,
            (d.d + '1 mon -1 days'::interval)::date AS d2
           FROM generate_series(( SELECT min(date_trunc('month', c.ngay_lap_xong))
                   FROM v_fixed_contract c
                  WHERE c.ngay_lap_xong IS NOT NULL),
                -- Tới hết tháng sau, khớp với 090: kỳ cước sinh trước một tháng
                -- nên tháng đang thu phải có dòng ở đây, không để trống.
                date_trunc('month', CURRENT_DATE) + '1 mon'::interval, '1 mon'::interval) d(d)
        ), so AS (
         SELECT e.ky, count(DISTINCT e.subscription_id) AS co_ky
           FROM v_fixed_expected_fee e
          GROUP BY e.ky
        )
 SELECT m.ky,
    count(c.subscription_id) FILTER (WHERE o.do_cong_ty) AS cong_ty,
    count(c.subscription_id) FILTER (WHERE NOT o.do_cong_ty) AS dai_ly,
    COALESCE(so.co_ky, 0::bigint) AS co_ky_cuoc,
    count(c.subscription_id) FILTER (WHERE o.do_cong_ty
      AND (c.cuoc_thang IS NULL OR c.cuoc_thang = 0::numeric OR c.fee_start_on IS NULL))
      AS thieu_gia_cuoc,
    count(c.subscription_id) FILTER (WHERE o.do_cong_ty) - COALESCE(so.co_ky, 0::bigint)
      AS chenh,
    count(c.subscription_id) FILTER (WHERE o.do_cong_ty
      AND c.cuoc_thang > 0::numeric AND c.fee_start_on IS NOT NULL
      AND c.fee_start_on <= m.d2
      AND (c.fee_end_on IS NULL OR c.fee_end_on >= m.d1))
      AS phai_ra_ky
   FROM moc m
     LEFT JOIN v_fixed_contract c ON c.trang_thai_lap_dat = 'DONE'
       AND c.ngay_lap_xong <= m.d2 AND (c.ngay_huy IS NULL OR c.ngay_huy >= m.d1)
     LEFT JOIN v_fixed_contract_owner o ON o.subscription_id = c.subscription_id
     LEFT JOIN so ON so.ky = m.ky
  GROUP BY m.ky, m.d1, m.d2, so.co_ky;
