-- Bên CMS có cột "khách khó đòi", đánh dấu tay ở từng hợp đồng. Cờ nằm sẵn
-- trong contracts.isDifficultDebt mà kho chưa kéo về.
--
-- Đây là đánh giá của người, không suy ra từ số kỳ nợ, nên phải giữ riêng chứ
-- không gộp vào nhóm nợ nặng: một hợp đồng có thể nợ ít nhưng đã xác định là
-- khó đòi, và ngược lại.

alter table subscription_snapshot
  add column if not exists is_difficult_debt boolean;

comment on column subscription_snapshot.is_difficult_debt is
  'Kế toán đánh dấu tay là khó đòi bên hệ thống nguồn';

drop view if exists v_fixed_contract;
create view v_fixed_contract as
with ky_cuoi as (
  select subscription_id, max(ky) as ky_da_thu_gan_nhat
    from v_fixed_settled_fee group by 1
),
so as (
  select subscription_source_id as subscription_id,
         count(*) filter (where status = 'PENDING_APPROVAL') as ky_cho_duyet,
         count(*) filter (where status = 'NOTE_ONLY')        as ky_ghi_chu
    from fee_period_snapshot where source = 'FIXED'
   group by 1
),
ngoai as (
  select subscription_id, count(*) as ky_ngoai
    from v_fixed_contract_period where ngoai_ky_tinh group by 1
),
thieu as (
  select subscription_id,
         count(*)                  as ky_thu_thieu,
         sum(phai_thu - tien)      as tien_thieu
    from v_fixed_contract_period
   where trang_thai = 'DA_THU' and phai_thu is not null and tien < phai_thu
   group by 1
),
nguong as (
  select (select value::int from threshold where key = 'fixed_arrears_periods') as ky_no,
         (select value::int from threshold where key = 'fixed_install_wait_days') as ngay_cho_lap
)
select
  s.source_id                                       as subscription_id,
  s.source_customer_id                              as contract_code,
  o.address                                         as dia_chi,
  s.status                                          as trang_thai_hop_dong,
  o.status                                          as trang_thai_lap_dat,
  s.plan_name                                       as goi_cuoc,
  s.monthly_price                                   as cuoc_thang,
  s.fee_start_on,
  s.fee_end_on,
  o.signed_on                                       as ngay_ky,
  o.completed_on                                    as ngay_lap_xong,
  s.terminated_on                                   as ngay_huy,
  s.cancel_reason                                   as ly_do_huy,
  cancel_reason_group(s.cancel_reason)              as nhom_ly_do_huy,
  coalesce(s.is_difficult_debt, false)              as kho_doi,
  s.created_at_src                                  as ngay_nhap,
  coalesce(nv.display_name, s.created_by_src)       as nguoi_nhap,
  coalesce(d.so_ky, 0)                              as so_ky,
  coalesce(d.so_ky_mien_phi, 0)                     as so_ky_mien_phi,
  coalesce(d.so_ky_no, 0)                           as so_ky_no,
  coalesce(d.tong_da_thu, 0)                        as tong_da_thu,
  coalesce(d.con_no, 0)                             as con_no,
  k.ky_da_thu_gan_nhat,
  coalesce(so.ky_cho_duyet, 0)                      as ky_cho_duyet,
  coalesce(so.ky_ghi_chu, 0)                        as ky_ghi_chu,
  coalesce(ng.ky_ngoai, 0)                          as ky_ngoai,
  coalesce(th.ky_thu_thieu, 0)                      as ky_thu_thieu,
  coalesce(th.tien_thieu, 0)                        as tien_thieu,
  case
    when d.subscription_id is null then 'CHUA_TINH_DUOC'
    when d.so_ky_no = 0            then 'DU'
    else                                'NO'
  end                                               as tinh_trang_cuoc,
  array_remove(array[
    case when coalesce(d.so_ky_no, 0) >= (select ky_no from nguong)
         then 'NO_NANG' end,
    case when s.status = 'TERMINATED' and coalesce(d.con_no, 0) > 0
         then 'HUY_CON_NO' end,
    case when s.status = 'ACTIVE'
          and (s.monthly_price is null or s.monthly_price = 0 or s.fee_start_on is null)
         then 'THIEU_CUOC' end,
    case when coalesce(so.ky_cho_duyet, 0) > 0 then 'CHO_DUYET' end,
    case when coalesce(so.ky_ghi_chu, 0)  > 0 then 'GHI_CHU' end,
    case when coalesce(ng.ky_ngoai, 0)    > 0 then 'NGOAI_KY' end,
    case when coalesce(th.ky_thu_thieu, 0) > 0 then 'THU_THIEU' end,
    case when s.is_difficult_debt then 'KHO_DOI' end,
    case when o.status = 'SURVEY' and s.status <> 'TERMINATED'
          and o.signed_on < current_date - (select ngay_cho_lap from nguong)
         then 'CHO_LAP_LAU' end
  ], null)                                          as canh_bao
from subscription_snapshot s
left join install_order_snapshot o
       on o.source = 'FIXED' and o.source_id = s.source_id
left join v_fixed_debt d on d.subscription_id = s.source_id
left join ky_cuoi k      on k.subscription_id = s.source_id
left join so             on so.subscription_id = s.source_id
left join ngoai ng       on ng.subscription_id = s.source_id
left join thieu th       on th.subscription_id = s.source_id
left join staff_snapshot nv
       on nv.source = 'FIXED' and nv.source_id = s.created_by_src
where s.source = 'FIXED';
