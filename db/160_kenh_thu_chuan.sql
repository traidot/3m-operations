-- Gom hai cách gõ tên kênh thu về một.
--
-- Bên CMS có 303 đợt ghi "cần trừ cọc" và 5 đợt ghi "cấn trừ cọc" (10.000 yên,
-- hợp đồng HD001463 và HD002055, nhập tháng 4-5/2026). Báo cáo nhóm theo chuỗi
-- nên hai cách gõ thành hai dòng riêng, và ở đây còn tệ hơn: cờ `can_tru_coc`
-- so bằng đúng chuỗi "cần trừ cọc" nên 5 đợt kia bị đếm nhầm thành tiền ngân
-- hàng.
--
-- Chuẩn hoá lúc ĐỌC chứ không sửa dữ liệu đã đồng bộ: kho phải soi đúng nguồn,
-- và nguồn chỉ bên CMS sửa được. Luật bắt theo "trừ cọc" nên cách gõ lệch dấu
-- về sau cũng tự vào đúng nhóm.

create or replace function kenh_thu_chuan(kenh text)
returns text language sql immutable as $$
  select case
    when kenh is null or btrim(kenh) = ''      then 'CHUA_GHI'
    when lower(btrim(kenh)) like '%trừ cọc%'   then 'cần trừ cọc'
    else btrim(kenh)
  end;
$$;

/** Tiền về theo kênh thu, cho một khoảng ngày. */
create or replace function fixed_channel_report(p_tu date default null, p_den date default null)
returns table (kenh text, so_ky bigint, tien numeric)
language sql stable as $$
  select case when kenh_thu_chuan(f.channel) = 'CHUA_GHI'
              then 'không ghi kênh' else kenh_thu_chuan(f.channel) end as kenh,
         count(*) as so_ky,
         coalesce(sum(f.amount) filter (where not f.is_free), 0) as tien
  from fee_period_snapshot f
  where f.source = 'FIXED'
    and f.paid_at is not null
    and (p_tu  is null or f.paid_at::date >= p_tu)
    and (p_den is null or f.paid_at::date <= p_den)
  group by 1
  order by tien desc;
$$;

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
  kenh_thu_chuan(i.channel) = 'cần trừ cọc'    as can_tru_coc
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
