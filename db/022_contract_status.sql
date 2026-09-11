-- Nhìn một hợp đồng nợ mà không biết nó còn chạy hay đã huỷ, lắp xong chưa,
-- đã thu tới kỳ nào thì không quyết được gì. Gắn mấy trạng thái đó vào.

drop view if exists v_fixed_arrears;
create view v_fixed_arrears as
with ky_cuoi as (
  select subscription_id, max(ky) as ky_da_thu_gan_nhat
    from v_fixed_settled_fee group by 1
),
cho_duyet as (
  select subscription_source_id as subscription_id,
         count(*) filter (where status = 'PENDING_APPROVAL') as ky_cho_duyet,
         count(*) filter (where status = 'NOTE_ONLY')        as ky_ghi_chu
    from fee_period_snapshot where source = 'FIXED'
   group by 1
)
select
  d.subscription_id,
  d.contract_code,
  s.status                                   as trang_thai_hop_dong,
  o.status                                   as trang_thai_lap_dat,
  k.ky_da_thu_gan_nhat,
  coalesce(p.ky_cho_duyet, 0)                as ky_cho_duyet,
  coalesce(p.ky_ghi_chu, 0)                  as ky_ghi_chu,
  d.so_ky,
  d.so_ky_mien_phi,
  d.so_ky_no,
  d.tong_da_thu,
  d.con_no
from v_fixed_debt d
join subscription_snapshot s
  on s.source = 'FIXED' and s.source_id = d.subscription_id
left join install_order_snapshot o
  on o.source = 'FIXED' and o.source_id = d.subscription_id
left join ky_cuoi k    on k.subscription_id = d.subscription_id
left join cho_duyet p  on p.subscription_id = d.subscription_id
where s.status = 'ACTIVE'
  and d.so_ky_no >= (select value::int from threshold where key = 'fixed_arrears_periods');
