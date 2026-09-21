-- Từng đợt thu cước của wifi cố định, gắn sẵn CẢ HAI trục thời gian.
--
-- Hai báo cáo bên CMS đo cùng một dòng tiền bằng hai trục khác nhau nên không
-- bao giờ bằng nhau, và người đọc tưởng là lệch số:
--   - "Báo cáo thống kê cước phí" xếp theo KỲ CƯỚC   (tiền này là cước tháng nào)
--   - "Báo cáo tài khoản thu"     xếp theo NGÀY TIỀN VỀ (tiền vào tháng nào)
-- 3M thu trước một tháng, nên hai trục lệch nhau gần đúng một nhịp.
--
-- View này để mỗi đợt mang sẵn cả `ky` lẫn `thang_tien_ve`, cộng theo trục nào
-- cũng ra đúng con số của báo cáo tương ứng, không phải viết hai truy vấn.
--
-- `vao_bao_cao_cuoc` dựng đúng bộ lọc của "Báo cáo thống kê cước phí": phiếu
-- cha đã duyệt, không phải tháng miễn phí, hợp đồng đã lắp xong và có cước
-- tháng. Cộng cột tiền của những dòng này theo `ky` thì khớp từng đồng với ô
-- "Tổng đã thu" của tháng đó bên CMS — đã đối chiếu kỳ 2026-08: 1.021.300.

create or replace view v_fixed_dot_thu as
select
  i.source_id,
  i.ky,
  -- Kho chạy ở Asia/Ho_Chi_Minh và bên nguồn cũng được đọc theo đúng múi đó
  -- lúc đồng bộ, nên to_char ra đúng tháng mà CMS hiển thị. Đổi múi giờ của
  -- database là lệch tháng ở các đợt thu ngày mùng 1.
  to_char(coalesce(i.paid_at, to_date(i.ky || '-01', 'YYYY-MM-DD')), 'YYYY-MM') as thang_tien_ve,
  i.paid_at::date                              as ngay_thu,
  coalesce(i.channel, 'CHUA_GHI')              as tai_khoan,
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
  -- Cấn trừ cọc không có đồng nào chạy qua ngân hàng, soát sổ phải trừ ra.
  coalesce(i.channel, '') = 'cần trừ cọc'      as can_tru_coc
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
