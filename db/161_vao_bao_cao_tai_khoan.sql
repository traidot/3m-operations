-- Cờ "đợt này có nằm trong Báo cáo tài khoản thu của CMS không".
--
-- Màn hình /dong-tien cố ý không bỏ rơi đợt nào, nên tổng của nó lớn hơn tổng
-- bên CMS và người đọc tưởng lệch số. Tháng 8/2026: màn hình 802.100, CMS
-- 794.100 — chênh đúng 8.000, gồm 6.000 của 3 đợt chưa ghi tài khoản và 2.000
-- của 1 đợt chưa duyệt.
--
-- Dựng lại đúng bộ lọc bên đó (đã đối chiếu từng đồng) để màn hình hiện được cả
-- hai con số cạnh nhau và nói rõ phần chênh là gì.

create or replace view v_fixed_dot_thu as
select
  i.source_id,
  i.ky,
  -- Kho chạy ở Asia/Ho_Chi_Minh và bên nguồn cũng được đọc theo đúng múi đó
  -- lúc đồng bộ, nên to_char ra đúng tháng mà CMS hiển thị. Đổi múi giờ của
  -- database là lệch tháng ở các đợt thu ngày mùng 1.
  to_char(coalesce(i.paid_at, to_date(i.ky || '-01', 'YYYY-MM-DD')), 'YYYY-MM') as thang_tien_ve,
  i.paid_at::date                              as ngay_thu,
  kenh_thu_chuan(i.channel)                    as tai_khoan,
  i.amount                                     as so_tien,
  i.contract_id,
  hd.contract_code                             as ma_hd,
  hd.dia_chi,
  hd.cuoc_thang,
  hd.trang_thai_hop_dong,
  i.status                                     as trang_thai_dot,
  fp.status                                    as trang_thai_phieu,
  fp.status is null                            as phieu_da_xoa,
  (fp.status = 'APPROVED'
     and not coalesce(fp.is_free, false)
     and io.status = 'DONE'
     and coalesce(s.monthly_price, 0) > 0)     as vao_bao_cao_cuoc,
  (i.status <> 'APPROVED'
     or coalesce(fp.status, 'MAT') <> 'APPROVED') as cho_duyet,
  -- Cấn trừ cọc: tiền khách đã nộp trước qua combini dưới dạng cọc, nay trừ
  -- sang cước. Tiền là thật và đã vào tài khoản, nhưng vào ở THÁNG KHÁC — nên
  -- đối chiếu sao kê của đúng tháng này thì không tìm thấy giao dịch tương ứng.
  kenh_thu_chuan(i.channel) = 'cần trừ cọc'    as can_tru_coc,
  -- Bộ lọc của "Báo cáo tài khoản thu" bên CMS, song song với `vao_bao_cao_cuoc`
  -- ở trên. Bên đó bỏ hẳn đợt không ghi tài khoản và đợt chưa duyệt, nên tổng
  -- luôn nhỏ hơn tổng thật; giữ cờ này để màn hình nói được chênh bao nhiêu và
  -- vì sao, thay vì để người đọc tự đoán.
  (i.channel is not null
     and not coalesce(fp.is_free, false)
     and (i.status = 'APPROVED' or coalesce(fp.tuy_chinh, false))
     and i.amount > 0)                          as vao_bao_cao_tai_khoan
from fixed_fee_installment i
-- Trái, không phải trong: có đợt mà phiếu cha đã bị xoá ở nguồn. Bỏ hẳn dòng đó
-- thì mất dấu một khoản tiền, nên giữ lại và gắn cờ `phieu_da_xoa`.
left join fee_period_snapshot fp
  on fp.source = 'FIXED' and fp.source_id = i.fee_period_id
left join subscription_snapshot s
  on s.source = 'FIXED' and s.source_id = i.contract_id
left join install_order_snapshot io
  on io.source = 'FIXED' and io.source_id = i.contract_id
left join v_fixed_contract hd on hd.subscription_id = i.contract_id
where i.source = 'FIXED' and i.amount > 0;
