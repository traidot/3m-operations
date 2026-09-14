-- Tách ngày huỷ và ngày hết hạn của thuê bao ra hai cột riêng.
--
-- terminated_on đang là coalesce(cancelDate, expirationDate): có ngày huỷ thì
-- lấy ngày huỷ. Nhưng tháng 9/2026 bên nguồn có hai đợt dọn hàng loạt (01/09 và
-- 11/09) huỷ 661 thuê bao đã hết hạn từ nhiều tháng trước, và ngày huỷ ghi là
-- NGÀY DỌN. Lấy ngày huỷ làm ngày ngừng thì chúng thành "đang chạy" suốt tới
-- tháng 9, thổi số dịch vụ đang chạy tháng 9 từ 1.339 lên 1.911.
--
-- Giữ cả hai ngày để view tự chọn: thuê bao đã huỷ thì ngừng ở ngày nào đến
-- trước. Không sửa terminated_on để khỏi đổi nghĩa ở những chỗ đang dùng nó.

alter table subscription_snapshot
  add column if not exists cancel_on date,
  add column if not exists expire_on date;

comment on column subscription_snapshot.cancel_on is
  'Ngày huỷ ghi bên nguồn — có thể là ngày dọn dữ liệu chứ không phải ngày ngừng thật';
comment on column subscription_snapshot.expire_on is
  'Ngày hết hạn bên nguồn — với thuê bao còn chạy có thể đã cũ vì gia hạn không cập nhật';
