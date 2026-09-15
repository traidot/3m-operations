-- Đối chiếu với sổ cước THẬT, thay cho phép tự so với chính mình.
--
-- Cột "phải ra kỳ" (095) và cột "có kỳ cước" đều bắt nguồn từ
-- v_fixed_expected_fee, tức hai cách viết của cùng một luật trên cùng mấy cột
-- nguồn. Chúng khớp nhau là chuyện đương nhiên, không chứng minh được gì về
-- việc số của mình có giống hệ thống nguồn hay không. Dấu ✓ dựa trên phép so
-- đó là ✓ rỗng.
--
-- Bên độc lập duy nhất là fee_period_snapshot — sổ thu cước do người bên CMS
-- nhập, mình chỉ kéo về. Hai cột mới:
--   so_cms    hợp đồng công ty có dòng trong sổ CMS của kỳ đó
--   ngoai_ky  trong số đó, bao nhiêu cái luật của mình bảo lẽ ra không có kỳ
--
-- ngoai_ky mới là cảnh báo thật. T04–T09/2026 có 282 dòng như vậy: 246 ghi chú
-- và 23 miễn phí (0 yên), còn 13 dòng đã thu thật 21.150 yên. Lý do áp đảo là
-- sổ vẫn thu sau ngày kết thúc thu ghi trên hợp đồng — 58/60 dòng của T07.

create or replace view v_fixed_month_chay as
 WITH moc AS (
         SELECT to_char(d.d, 'YYYY-MM'::text) AS ky,
            d.d::date AS d1,
            (d.d + '1 mon -1 days'::interval)::date AS d2
           FROM generate_series(( SELECT min(date_trunc('month'::text, c_1.ngay_lap_xong::timestamp with time zone)) AS min
                   FROM v_fixed_contract c_1
                  WHERE c_1.ngay_lap_xong IS NOT NULL), date_trunc('month'::text, CURRENT_DATE::timestamp with time zone) + '1 mon'::interval, '1 mon'::interval) d(d)
        ), cms AS (
         -- Sổ cước THẬT kéo từ CMS về. Đây mới là bên độc lập để đối chiếu:
         -- fee_period_snapshot do người bên CMS nhập, không phải mình suy ra.
         SELECT f.period AS ky,
                count(DISTINCT f.subscription_source_id) FILTER (WHERE w.do_cong_ty)
                  AS so_cms,
                count(DISTINCT f.subscription_source_id) FILTER (
                  WHERE w.do_cong_ty AND e2.subscription_id IS NULL) AS ngoai_ky
           FROM fee_period_snapshot f
           LEFT JOIN v_fixed_sub_owner w ON w.subscription_id = f.subscription_source_id
           LEFT JOIN v_fixed_expected_fee e2
             ON e2.subscription_id = f.subscription_source_id AND e2.ky = f.period
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
    count(c.subscription_id) FILTER (WHERE o.do_cong_ty AND (c.cuoc_thang IS NULL OR c.cuoc_thang = 0::numeric OR c.fee_start_on IS NULL)) AS thieu_gia_cuoc,
    count(c.subscription_id) FILTER (WHERE o.do_cong_ty) - COALESCE(so.co_ky, 0::bigint) AS chenh,
    count(c.subscription_id) FILTER (WHERE o.do_cong_ty AND c.cuoc_thang > 0::numeric AND c.fee_start_on IS NOT NULL AND c.fee_start_on <= m.d2 AND (c.fee_end_on IS NULL OR c.fee_end_on >= m.d1)) AS phai_ra_ky,
    COALESCE(cms.so_cms, 0::bigint) AS so_cms,
    COALESCE(cms.ngoai_ky, 0::bigint) AS ngoai_ky
   FROM moc m
     LEFT JOIN v_fixed_contract c ON c.trang_thai_lap_dat = 'DONE'::text AND c.ngay_lap_xong <= m.d2 AND (c.ngay_huy IS NULL OR c.ngay_huy >= m.d1)
     LEFT JOIN v_fixed_contract_owner o ON o.subscription_id = c.subscription_id
     LEFT JOIN so ON so.ky = m.ky
     LEFT JOIN cms ON cms.ky = m.ky
  GROUP BY m.ky, m.d1, m.d2, so.co_ky, cms.so_cms, cms.ngoai_ky;
