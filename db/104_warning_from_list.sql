-- Dấu ⚠ trên cột "Sổ CMS" đang đếm lại theo một luật riêng nên lệch với chính
-- danh sách /thu-ngoai mà nó trỏ tới: T07 cảnh báo 1 mà danh sách rỗng (dòng
-- đó 0 yên), T05 và T04 cảnh báo 2 mà danh sách có 3 (kỳ của đại lý và kỳ chưa
-- đặt cước bị luật kia lọc mất). Bấm vào cảnh báo ra số khác thì không tin được
-- cả hai.
--
-- Giờ đếm thẳng số dòng trong v_fixed_thu_ngoai_hop_dong, một nguồn duy nhất.
-- Bốn tháng tương lai (T11/2026–T02/2027) có trong danh sách nhưng không có
-- dòng trên bảng theo tháng, nên tổng hai nơi vẫn khác: 15 trên bảng, 19 trong
-- danh sách.

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
            count(DISTINCT f.subscription_source_id) FILTER (WHERE w.do_cong_ty AND f.status = 'APPROVED'::text AND NOT f.is_free) AS so_cms,
            0::bigint AS ngoai_ky
           FROM fee_period_snapshot f
             LEFT JOIN v_fixed_sub_owner w ON w.subscription_id = f.subscription_source_id
             LEFT JOIN v_fixed_expected_fee e2 ON e2.subscription_id = f.subscription_source_id AND e2.ky = f.period
          WHERE f.source = 'FIXED'::source_system
          GROUP BY f.period
        ), ngoai AS (
         -- Đếm thẳng từ danh sách /thu-ngoai chứ không đếm lại theo luật riêng:
         -- hai chỗ hai công thức thì bấm vào cảnh báo ra số khác, đúng cái bẫy
         -- vừa dính. Danh sách đã loại kỳ 0 yên và loại kỳ khách trả trước.
         SELECT t.ky, count(*) AS so_ky
           FROM v_fixed_thu_ngoai_hop_dong t
          GROUP BY t.ky
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
    COALESCE(ngoai.so_ky, 0::bigint) AS ngoai_ky,
    count(c.subscription_id) FILTER (WHERE o.do_cong_ty AND c.fee_start_on IS NULL) AS thieu_ngay_thu
   FROM moc m
     LEFT JOIN v_fixed_contract c ON c.trang_thai_lap_dat = 'DONE'::text AND c.ngay_lap_xong <= m.d2 AND (c.ngay_huy IS NULL OR c.ngay_huy >= m.d1)
     LEFT JOIN v_fixed_contract_owner o ON o.subscription_id = c.subscription_id
     LEFT JOIN so ON so.ky = m.ky
     LEFT JOIN cms ON cms.ky = m.ky
     LEFT JOIN ngoai ON ngoai.ky = m.ky
  GROUP BY m.ky, m.d1, m.d2, so.co_ky, cms.so_cms, ngoai.so_ky;
