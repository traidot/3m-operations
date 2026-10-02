-- Dọn hai view bị bảng gộp thay thế.
--
-- v_fixed_gmo_loai và v_fixed_coc_cho_duyet_loai cắt dữ liệu theo đúng một
-- chiều (thứ đang thu), dùng cho bảng phụ đứng riêng. Bảng gộp (db/207) cắt
-- cả hai chiều trong một bảng nên hai view này không còn ai đọc.
--
-- Xoá chứ không để lại: view không dùng vẫn phải chạy lại mỗi lần đổi view
-- cha, và lần sau có người đọc nhầm nó rồi tưởng đó là nguồn đang hiển thị.

drop view if exists v_fixed_gmo_loai;
drop view if exists v_fixed_coc_cho_duyet_loai;
