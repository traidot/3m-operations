-- Phiếu tất toán tay không sinh đợt nào cũng là tiền thật, phải vào view.
--
-- `v_fixed_dot_thu` chỉ đọc bảng đợt, nên bỏ sót phiếu cha đánh dấu "tùy chỉnh
-- số tiền thu" mà không tạo đợt con — thu ghi thẳng trên dòng cha. Bản CMS mới
-- gọi nhóm này là orphanQb và cộng riêng vào Báo cáo tài khoản thu; thiếu nó
-- thì kho ít hơn màn hình đúng số tiền của chúng (HD005977, 1.000, tháng 9).
--
-- Cột `tu_phieu_cha` để tra ngược: true là dòng dựng từ phiếu cha, không có
-- đợt con nào đứng sau.

create or replace view v_fixed_dot_thu as
select
  i.source_id,
  i.ky,
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
  (fp.status = 'APPROVED' and not coalesce(fp.is_free, false)
     and io.status = 'DONE' and coalesce(s.monthly_price, 0) > 0) as vao_bao_cao_cuoc,
  (i.status <> 'APPROVED'
     or coalesce(fp.status, 'MAT') <> 'APPROVED') as cho_duyet,
  kenh_thu_chuan(i.channel) = 'cần trừ cọc'    as can_tru_coc,
  (i.channel is not null and not coalesce(fp.is_free, false)
     and (i.status = 'APPROVED' or coalesce(fp.tuy_chinh, false))
     and i.amount > 0)                         as vao_bao_cao_tai_khoan,
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
  case
    when coalesce(s.monthly_price, 0) > 0 and i.amount > s.monthly_price
         and not coalesce(fp.tuy_chinh, false) then i.amount - s.monthly_price
    else 0
  end                                          as tien_bi_cap,
  false                                        as tu_phieu_cha
from fixed_fee_installment i
left join fee_period_snapshot fp
  on fp.source = 'FIXED' and fp.source_id = i.fee_period_id
left join subscription_snapshot s
  on s.source = 'FIXED' and s.source_id = i.contract_id
left join install_order_snapshot io
  on io.source = 'FIXED' and io.source_id = i.contract_id
left join v_fixed_contract hd on hd.subscription_id = i.contract_id
where i.source = 'FIXED' and i.amount > 0

union all

-- Phiếu tất toán tay không có đợt con nào. Trạng thái đợt để null vì không có
-- đợt; mọi cột còn lại suy từ chính phiếu cha.
select
  fp.source_id,
  fp.period                                    as ky,
  to_char(coalesce(fp.paid_at, to_date(fp.period || '-01', 'YYYY-MM-DD')), 'YYYY-MM') as thang_tien_ve,
  fp.paid_at::date                             as ngay_thu,
  kenh_thu_chuan(fp.channel)                   as tai_khoan,
  fp.amount                                    as so_tien,
  fp.subscription_source_id                    as contract_id,
  hd.contract_code                             as ma_hd,
  hd.dia_chi,
  hd.cuoc_thang,
  hd.trang_thai_hop_dong,
  null::text                                   as trang_thai_dot,
  fp.status                                    as trang_thai_phieu,
  false                                        as phieu_da_xoa,
  (fp.status = 'APPROVED' and not coalesce(fp.is_free, false)
     and io.status = 'DONE' and coalesce(s.monthly_price, 0) > 0) as vao_bao_cao_cuoc,
  (fp.status <> 'APPROVED')                    as cho_duyet,
  kenh_thu_chuan(fp.channel) = 'cần trừ cọc'   as can_tru_coc,
  true                                         as vao_bao_cao_tai_khoan,
  null::text                                   as ly_do_ngoai_tai_khoan,
  case
    when coalesce(fp.is_free, false)           then 'tháng miễn phí'
    when fp.status <> 'APPROVED'               then 'phiếu cha chưa duyệt'
    when io.status is distinct from 'DONE'     then 'hợp đồng chưa lắp xong'
    when coalesce(s.monthly_price, 0) <= 0     then 'hợp đồng chưa có giá cước'
  end                                          as ly_do_ngoai_cuoc,
  0::numeric                                   as tien_bi_cap,
  true                                         as tu_phieu_cha
from fee_period_snapshot fp
left join subscription_snapshot s
  on s.source = 'FIXED' and s.source_id = fp.subscription_source_id
left join install_order_snapshot io
  on io.source = 'FIXED' and io.source_id = fp.subscription_source_id
left join v_fixed_contract hd on hd.subscription_id = fp.subscription_source_id
where fp.source = 'FIXED'
  and coalesce(fp.tuy_chinh, false)
  and fp.amount > 0
  and not coalesce(fp.is_free, false)
  and not exists (select 1 from fixed_fee_installment i
                   where i.source = 'FIXED' and i.fee_period_id = fp.source_id);
