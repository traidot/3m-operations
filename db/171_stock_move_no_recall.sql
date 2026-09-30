-- Phiếu xuất có ô "không cần thu hồi".
--
-- CMS đánh dấu từng dòng phiếu xuất: máy này xuất đi là xong, không đòi về.
-- Thiếu cờ này thì mọi màn hình đòi máy đều kể oan — 1.398 máy bị xếp vào
-- "huỷ rồi mà chưa về" trong khi chúng vốn không bao giờ về.
--
-- `device_recall_status` và `device_recall_note` cũng lấy luôn: nguồn có sẵn
-- mà kho chưa dùng, lấy một thể đỡ phải sửa sync lần nữa.

alter table stock_move_snapshot
  add column if not exists is_no_recall boolean not null default false,
  add column if not exists device_recall_status text,
  add column if not exists device_recall_note text;

comment on column stock_move_snapshot.is_no_recall is
  'Dòng phiếu xuất đánh dấu không cần thu hồi — đừng tính vào máy phải đòi về';
