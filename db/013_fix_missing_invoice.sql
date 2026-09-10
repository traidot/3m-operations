-- v_missing_invoice giả định nguồn nào cũng xuất hoá đơn. Nhánh wifi cố định
-- không có bảng hoá đơn nên mọi hợp đồng đang chạy đều bị báo thiếu — 2.858
-- phán quyết nhiễu ngay lượt chạy đầu.
--
-- Chỉ kiểm nguồn nào thật sự có hoá đơn. Nguồn không có thì dùng quy tắc riêng
-- dựa trên kỳ cước suy ra.

create or replace view v_missing_invoice as
with grace as (
  select value::int as d from threshold where key = 'invoice_grace_days'
),
co_hoa_don as (
  select distinct source from invoice_snapshot
),
last_inv as (
  select i.source, i.subscription_source_id, max(i.period_end) as ky_gan_nhat_den
    from invoice_snapshot i where i.status <> 'VOID' group by 1, 2
)
select
  s.source,
  s.source_id            as subscription_id,
  s.party_id,
  s.service_type,
  s.plan_name,
  s.monthly_price,
  s.activated_on,
  l.ky_gan_nhat_den,
  coalesce(current_date - l.ky_gan_nhat_den, current_date - s.activated_on) as ngay_khong_co_cuoc
from subscription_snapshot s
join co_hoa_don c on c.source = s.source
left join last_inv l
       on l.source = s.source and l.subscription_source_id = s.source_id
cross join grace g
where s.status = 'ACTIVE'
  and s.activated_on is not null
  and coalesce(l.ky_gan_nhat_den, s.activated_on) < current_date - g.d;

insert into threshold (key, value, unit, note) values
  ('fixed_arrears_periods', 3, 'kỳ', 'Hợp đồng wifi cố định nợ từ bao nhiêu kỳ thì báo')
on conflict (key) do nothing;

-- Nợ tính theo số kỳ chứ không theo số tiền: 2000 yên một kỳ nên một ngưỡng
-- tiền cố định sẽ vô nghĩa khi giá cước đổi.
create or replace view v_fixed_arrears as
select
  d.subscription_id,
  d.contract_code,
  d.so_ky,
  d.tong_phai_thu,
  d.tong_da_thu,
  d.con_no,
  floor(d.con_no / nullif(s.monthly_price, 0))::int as so_ky_no
from v_fixed_debt d
join subscription_snapshot s
  on s.source = 'FIXED' and s.source_id = d.subscription_id
where s.status = 'ACTIVE'
  and d.con_no > 0
  and floor(d.con_no / nullif(s.monthly_price, 0))
      >= (select value::int from threshold where key = 'fixed_arrears_periods');
