-- Cước wifi cố định chỉ muộn khi đã HẾT tháng.
--
-- Mốc chốt đang là chính tháng hiện tại, nên kỳ tháng 10 bị tính là nợ ngay từ
-- mùng 1 tháng 10 — trong khi khách còn cả tháng để đóng. Hậu quả đo được hôm
-- nay (08/10): 198 kỳ / 433.100 yên đang nằm trong "đang nợ", mà 149 kỳ /
-- 335.100 yên trong đó là cước tháng này chưa tới hạn.
--
-- Mốc đúng là tháng VỪA KẾT THÚC: kỳ tháng 10 chỉ vào danh sách nợ từ 01/11.
--
-- Hai mốc khác nhau, ăn khớp chứ không mâu thuẫn:
--
--   01/11  kỳ tháng 10 thành "đang nợ"      (view này)
--   11/11  kỳ tháng 10 thành "quá hạn"      (fixed_fee_due_date, mùng 10 + 1)
--
-- Mười ngày ở giữa là ân hạn: đã tới lúc phải đòi nhưng chưa gọi là trễ.
--
-- Hai mảng thu ngược nhau, đừng áp chung một luật:
--
--   wifi cố định  thu sau  — hết tháng dùng mới phải đóng
--   wifi cầm tay  thu trước — hạn là ngày đầu kỳ, hệ đang tính đúng rồi nên
--                             file này không đụng tới
--
-- Lấy tháng của NGÀY CUỐI THÁNG TRƯỚC chứ không trừ một tháng từ hôm nay: trừ
-- thẳng thì ngày 31/03 ra 28/02 hay 03/03 tuỳ nơi, còn cách này luôn đúng.

create or replace view v_fixed_ky_chot as
select to_char(date_trunc('month', current_date) - interval '1 day', 'YYYY-MM') as ky_chot;

comment on view v_fixed_ky_chot is
  'Kỳ cước muộn nhất được coi là tới hạn — tháng vừa kết thúc, vì cố định thu sau';
