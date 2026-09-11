-- Tra cứu từng hợp đồng: trạng thái hợp đồng, lắp đặt, và cước từng tháng.
-- Trước chỉ có view tổng và view hợp đồng nợ nặng, không tìm được một hợp đồng
-- cụ thể xem nó đã đóng những tháng nào.

/**
 * Một dòng một hợp đồng wifi cố định, kèm tình trạng cước.
 *
 * Left join sang v_fixed_debt chứ không join thẳng: hợp đồng thiếu giá cước
 * hoặc thiếu ngày bắt đầu thu thì không sinh được kỳ nào, nhưng vẫn phải hiện
 * ra trong danh sách — đánh dấu tinh_trang_cuoc = 'CHUA_TINH_DUOC'.
 */
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
  case
    when d.subscription_id is null then 'CHUA_TINH_DUOC'
    when d.so_ky_no = 0            then 'DU'
    else                                'NO'
  end                                               as tinh_trang_cuoc
from subscription_snapshot s
left join install_order_snapshot o
       on o.source = 'FIXED' and o.source_id = s.source_id
left join v_fixed_debt d on d.subscription_id = s.source_id
left join ky_cuoi k      on k.subscription_id = s.source_id
left join so             on so.subscription_id = s.source_id
left join staff_snapshot nv
       on nv.source = 'FIXED' and nv.source_id = s.created_by_src
where s.source = 'FIXED';

/**
 * Từng kỳ cước của từng hợp đồng.
 *
 * Full join: kỳ lẽ ra phải sinh mà sổ không có dòng nào là kỳ nợ; ngược lại sổ
 * có dòng cho kỳ nằm ngoài khoảng tính được (trả trước, hoặc nhập nhầm năm)
 * thì vẫn phải hiện, đánh dấu ngoai_ky_tinh.
 */
drop view if exists v_fixed_contract_period;
create view v_fixed_contract_period as
with so as (
  select subscription_source_id                            as subscription_id,
         period                                            as ky,
         bool_or(status = 'APPROVED' and is_free)          as co_mien_phi,
         bool_or(status = 'APPROVED' and not is_free)      as co_duyet,
         bool_or(status = 'PENDING_APPROVAL')              as co_cho_duyet,
         bool_or(status = 'NOTE_ONLY')                     as co_ghi_chu,
         sum(case when status = 'APPROVED' and not is_free then amount else 0 end) as tien,
         max(paid_at)                                      as thu_luc,
         max(channel)                                      as kenh,
         max(created_by_src)                               as nguoi_nhap_id
    from fee_period_snapshot where source = 'FIXED'
   group by 1, 2
)
select
  coalesce(e.subscription_id, so.subscription_id) as subscription_id,
  coalesce(e.ky, so.ky)                           as ky,
  e.phai_thu,
  case
    when so.co_mien_phi   then 'MIEN_PHI'
    when so.co_duyet      then 'DA_THU'
    when so.co_cho_duyet  then 'CHO_DUYET'
    when so.co_ghi_chu    then 'GHI_CHU'
    else                       'NO'
  end                                             as trang_thai,
  e.ky is null                                    as ngoai_ky_tinh,
  so.tien, so.thu_luc, so.kenh,
  coalesce(nv.display_name, so.nguoi_nhap_id)     as nguoi_nhap
from v_fixed_expected_fee e
full join so on so.subscription_id = e.subscription_id and so.ky = e.ky
left join staff_snapshot nv
       on nv.source = 'FIXED' and nv.source_id = so.nguoi_nhap_id;
