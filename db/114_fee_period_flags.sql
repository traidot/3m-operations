-- Kéo về ba cờ của phiếu thu cước mà mình đang bỏ qua.
--
-- Bên CMS, màn hình "Cập nhật thu cước phí" có mấy ô đánh dấu:
--   Tuỳ chỉnh số tiền thu  isManuallySettled — tháng này thu ít hơn cước/tháng
--                          NHƯNG vẫn coi là xong: giảm trừ, ưu đãi, xử lý đặc
--                          biệt. 231 kỳ đang bật cờ này.
--   Không thu cước         isNoCollection + noCollectionReasonId — đánh dấu kỳ
--                          này không thu, bắt buộc chọn lý do. 1 kỳ.
--   Miễn phí tháng này     isFree — đã kéo về từ đầu.
--
-- Không có ba cờ này thì mọi kỳ thu ít hơn giá cước đều bị đọc là "thu thiếu".
-- Tháng 9/2026 có 19 kỳ tuỳ chỉnh, thu 21.000 trên cước 37.500 — chênh 16.500,
-- gần khít con số "thu thiếu" 16.448 màn hình đang báo.

alter table fee_period_snapshot
  add column if not exists tuy_chinh          boolean not null default false,
  add column if not exists ghi_chu_tuy_chinh  text,
  add column if not exists khong_thu          boolean not null default false,
  add column if not exists ly_do_khong_thu_id text;

comment on column fee_period_snapshot.tuy_chinh is
  'isManuallySettled: thu ít hơn cước/tháng nhưng vẫn coi là xong';
comment on column fee_period_snapshot.khong_thu is
  'isNoCollection: kỳ được đánh dấu không thu, lý do ở ly_do_khong_thu_id';
