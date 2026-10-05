-- Bỏ bảng cảnh báo vận hành: màn Điểm nghẽn (db/217, 218) đã thay nó.
--
-- Không chỉ trùng mà còn SAI hai chỗ, nên để song song là để người đọc tin
-- nhầm con số:
--
--   LAP_QUA_HAN đếm 221 đơn quá hạn hẹn, trong đó 214 là hợp đồng ĐÃ HUỶ —
--   việc thật chỉ 23. Bản đồ trạm lọc hợp đồng đã đóng nên ra đúng.
--
--   Cả bảng xếp hạng theo SỐ TỒN, nên 88 phiếu cọc chờ duyệt đứng ngang hàng
--   với 1.254 lần chờ gán hoá đơn. Thực ra guồng duyệt cọc chạy 126 phiếu mỗi
--   tuần nên dọn trong nửa tuần. Mức nghẽn là tồn ÷ tốc độ ra, không phải tồn.
--
-- Không view nào phụ thuộc vào nó.

drop view if exists v_fixed_canh_bao;
