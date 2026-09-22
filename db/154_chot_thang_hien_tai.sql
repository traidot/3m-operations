-- Mọi thứ dừng ở THÁNG HIỆN TẠI, và tháng hiện tại chưa đóng là coi như nợ.
--
-- David chốt 22/09/2026: "giờ ví dụ đang là tháng 9 thì chỉ muốn cảnh báo đến
-- tháng 9 thôi". Hai chỗ đang vượt qua mốc đó:
--
--  1. `v_fixed_expected_fee` dựng trước kỳ của tháng sau (CURRENT_DATE + 1
--     tháng), nên tháng 9 mà bảng đã có kỳ tháng 10 — 770 hợp đồng, nằm trong
--     cột "chưa đến hạn". Cắt lại đúng tháng hiện tại.
--
--  2. `v_fixed_ky_chot` lùi về tháng trước cho tới khi qua ngày hạn (mùng 10),
--     nên tháng đang chạy không bao giờ vào cột "còn nợ". Đổi thành tháng hiện
--     tại: kỳ tháng này chưa có phiếu duyệt là tính nợ ngay.
--
-- Đây là quyết định nghiệp vụ, không phải sửa lỗi: đòi sớm hơn luật "hạn mùng
-- 10 tháng sau" một nhịp. Ngưỡng `fixed_due_day` vì thế không còn chi phối mốc
-- nợ nữa, nhưng vẫn giữ nguyên vì db/052 dùng cho phần cọc.

create or replace view v_fixed_ky_chot as
select to_char(current_date, 'YYYY-MM') as ky_chot;

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
       -- Kỳ cuối cùng là tháng hiện tại, không dựng trước tháng sau.
       date_trunc('month',
         LEAST(COALESCE(s.fee_end_on::timestamp, CURRENT_DATE::timestamp),
               CURRENT_DATE::timestamp)::timestamptz),
       '1 mon'::interval) thang(thang)
  WHERE s.source = 'FIXED'::source_system
    AND o.status = 'DONE'::text
    AND s.fee_start_on IS NOT NULL
    AND s.monthly_price > 0::numeric;
