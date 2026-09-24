-- Vì sao một đợt không nằm trong báo cáo của CMS.
--
-- 161 mới cho biết CÓ hay KHÔNG. Để màn hình dựng được bảng đối chiếu "tổng đầy
-- đủ, trừ đi từng lý do, ra đúng số của CMS" thì cần biết lý do của từng dòng,
-- và cần cả phần bị cap theo cước tháng — cái đó không loại dòng nào mà chỉ cắt
-- bớt tiền, nên phải là một cột riêng.

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
     and i.amount > 0)                          as vao_bao_cao_tai_khoan,
  -- Vì sao bị loại, để màn hình dựng được bảng đối chiếu "tổng đầy đủ trừ đi
  -- từng lý do thì ra đúng số của CMS". Null nghĩa là không bị loại.
  case
    when i.channel is null                     then 'đợt chưa ghi tài khoản thu'
    when coalesce(fp.is_free, false)           then 'tháng miễn phí'
    when not (i.status = 'APPROVED'
              or coalesce(fp.tuy_chinh, false)) then 'đợt chưa duyệt'
    when i.amount <= 0                         then 'đợt tiền bằng 0'
  end                                          as ly_do_ngoai_tai_khoan,
  case
    when fp.status is null                     then 'phiếu cha đã bị xoá ở nguồn'
    when coalesce(fp.is_free, false)           then 'tháng miễn phí'
    when fp.status <> 'APPROVED'               then 'phiếu cha chưa duyệt'
    when io.status is distinct from 'DONE'     then 'hợp đồng chưa lắp xong'
    when coalesce(s.monthly_price, 0) <= 0     then 'hợp đồng chưa có giá cước'
  end                                          as ly_do_ngoai_cuoc,
  -- Báo cáo tài khoản thu cap mỗi đợt ở mức cước tháng. Đây là phần bị cắt mất,
  -- không phải một dòng bị loại nên phải tính riêng.
  case when coalesce(s.monthly_price, 0) > 0
        and i.amount > s.monthly_price
        and not coalesce(fp.tuy_chinh, false)
       then i.amount - s.monthly_price else 0 end as tien_bi_cap
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
