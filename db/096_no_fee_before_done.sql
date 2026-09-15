-- Không sinh kỳ cước cho tháng trước khi lắp xong.
--
-- 050 đã chặn hợp đồng CHƯA lắp bao giờ, nhưng còn sót trường hợp lắp MUỘN hơn
-- ngày bắt đầu thu: bên nguồn đặt fee_start_on ngày ký, lắp xong vài tháng sau,
-- thế là sổ cước có kỳ của những tháng máy chưa về nhà khách. Ví dụ HD001283
-- thu từ 01/04/2026 mà 05/07/2026 mới lắp xong — ba kỳ ma.
--
-- Cả kho đang có 7 kỳ như vậy trên 5 hợp đồng, 14.000 yên (T04 4 kỳ, T05–T07
-- mỗi tháng 1 kỳ). Đúng luật đã chốt: chưa lắp thì không thu gì cả.
--
-- Đây cũng là chỗ làm cột "phải ra kỳ" lệch với "có kỳ cước" ở màn hình cước.

create or replace view v_fixed_expected_fee as
 SELECT s.source,
    s.source_id AS subscription_id,
    s.source_customer_id AS contract_code,
    to_char(thang.thang, 'YYYY-MM') AS ky,
    s.monthly_price AS phai_thu
   FROM subscription_snapshot s
     JOIN install_order_snapshot o
       ON o.source = 'FIXED'::source_system AND o.source_id = s.source_id
     JOIN v_fixed_sub_owner w ON w.subscription_id = s.source_id AND w.do_cong_ty
     CROSS JOIN LATERAL generate_series(
       -- Kỳ đầu tiên là tháng muộn hơn giữa "bắt đầu thu" và "lắp xong".
       GREATEST(date_trunc('month', s.fee_start_on::timestamptz),
                date_trunc('month', o.completed_on::timestamptz)),
       date_trunc('month',
         LEAST(COALESCE(s.fee_end_on::timestamp, CURRENT_DATE + '1 mon'::interval),
               CURRENT_DATE + '1 mon'::interval)::timestamptz),
       '1 mon'::interval) thang(thang)
  WHERE s.source = 'FIXED'::source_system
    AND o.status = 'DONE'::text
    AND s.fee_start_on IS NOT NULL
    AND s.monthly_price > 0::numeric;
