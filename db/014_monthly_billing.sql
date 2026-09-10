-- Bảng cước theo tháng: mỗi kỳ phải thu bao nhiêu, đã thu bao nhiêu,
-- cắt theo trạng thái hợp đồng.
--
-- Ghép theo KỲ chứ không theo ngày thu. Bên nguồn ghi kỳ vào paymentMonth,
-- và tiền một kỳ có thể được thu ở tháng khác — thu trước hoặc thu bù.

create or replace view v_fixed_monthly_billing as
with phai_thu as (
  select
    e.ky,
    s.status,
    count(*)                as so_hop_dong,
    sum(e.phai_thu)         as phai_thu
  from v_fixed_expected_fee e
  join subscription_snapshot s
    on s.source = 'FIXED' and s.source_id = e.subscription_id
  group by 1, 2
),
da_thu as (
  select
    p.reference             as ky,
    s.status,
    count(*)                as so_khoan,
    sum(p.amount)           as da_thu
  from payment_snapshot p
  join subscription_snapshot s
    on s.source = p.source and s.source_id = p.subscription_source_id
  where p.source = 'FIXED' and p.reference is not null
  group by 1, 2
)
select
  coalesce(pt.ky, dt.ky)                                    as ky,
  coalesce(pt.status, dt.status)                            as trang_thai,
  coalesce(pt.so_hop_dong, 0)                               as so_hop_dong,
  coalesce(pt.phai_thu, 0)                                  as phai_thu,
  coalesce(dt.so_khoan, 0)                                  as so_khoan_thu,
  coalesce(dt.da_thu, 0)                                    as da_thu,
  coalesce(pt.phai_thu, 0) - coalesce(dt.da_thu, 0)         as con_thieu,
  round(100.0 * coalesce(dt.da_thu, 0)
        / nullif(pt.phai_thu, 0), 1)                        as ty_le_thu
from phai_thu pt
full join da_thu dt on dt.ky = pt.ky and dt.status = pt.status;

-- Gộp mọi trạng thái, để nhìn nhanh một cột.
create or replace view v_fixed_monthly_total as
select
  ky,
  sum(so_hop_dong)                                  as so_hop_dong,
  sum(phai_thu)                                     as phai_thu,
  sum(da_thu)                                       as da_thu,
  sum(phai_thu) - sum(da_thu)                       as con_thieu,
  round(100.0 * sum(da_thu) / nullif(sum(phai_thu), 0), 1) as ty_le_thu
from v_fixed_monthly_billing
group by ky;

/**
 * Tiền thu cho kỳ mà không có kỳ phải thu tương ứng.
 * Thường là hợp đồng thiếu monthlyFee nên không sinh được kỳ, hoặc ghi nhầm kỳ.
 */
create or replace view v_fixed_payment_orphan as
select
  p.reference                     as ky,
  count(*)                        as so_khoan,
  sum(p.amount)                   as tien
from payment_snapshot p
where p.source = 'FIXED'
  and not exists (
    select 1 from v_fixed_expected_fee e
     where e.subscription_id = p.subscription_source_id and e.ky = p.reference)
group by 1;
