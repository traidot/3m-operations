-- Nối hệ telecom vào làm quy tắc thiếu hoá đơn nổ 350 phán quyết một lượt,
-- mỗi thuê bao một thẻ. Bản tin dài 350 thẻ thì không ai đọc, và phần lớn là
-- nhiễu: chu kỳ cước bên telecom là tháng nên vài ngày sau khi hết kỳ mà chưa
-- có hoá đơn mới là chuyện bình thường.
--
-- Hai sửa:
--   1. Ân hạn 3 ngày là của nhánh hoá đơn theo ngày. Nâng lên 35 ngày — một
--      chu kỳ tháng cộng dư — nên chỉ còn thuê bao thật sự bị bỏ quên.
--   2. Gộp thành một phán quyết cho mỗi nguồn, kèm số lượng và ca nặng nhất.
--      Chi tiết xem ở trang danh sách chứ không rải ra bản tin.

update threshold
   set value = 35,
       note = 'Ân hạn sau khi hết kỳ cước trước khi coi là thuê bao chạy mà thiếu hoá đơn',
       updated_at = now()
 where key = 'invoice_grace_days';

/** Gộp theo nguồn: bao nhiêu thuê bao, nặng nhất bao nhiêu ngày. */
drop view if exists v_missing_invoice_summary;
create view v_missing_invoice_summary as
select
  source,
  count(*)                        as so_thue_bao,
  max(ngay_khong_co_cuoc)         as lau_nhat,
  round(avg(ngay_khong_co_cuoc))  as trung_binh,
  count(*) filter (where ngay_khong_co_cuoc > 180) as tren_6_thang
from v_missing_invoice
group by source;
