-- Gắn vai trò khách (lẻ, cộng tác viên, đại lý) và nhóm nghiệp vụ vào hai
-- view của mảng cầm tay, để lọc và cộng số tách bạch hai loại.
--
-- Vai trò lấy qua party_source vì đó là thuộc tính theo nguồn.

-- Hai view kia dựng trên nó nên phải bỏ trước.
drop view if exists v_telecom_customer;
drop view if exists v_telecom_customer_sub;
drop view if exists v_telecom_subscription;
create view v_telecom_subscription as
with hd as (
  select subscription_source_id                                        as sid,
         count(*)                                                      as so_hoa_don,
         count(*) filter (where status = 'ISSUED')                     as hoa_don_dang_doi,
         round(sum(total_amount - paid_amount) filter (where status = 'ISSUED')) as con_no,
         count(*) filter (where status = 'UNPAYABLE')                  as hoa_don_mat,
         round(sum(total_amount - paid_amount) filter (where status = 'UNPAYABLE')) as tien_mat,
         round(sum(paid_amount))                                       as da_thu,
         max(period_end)                                               as ky_gan_nhat_den,
         max(current_date - due_on) filter (where status = 'ISSUED')   as ngay_qua_han
    from invoice_snapshot
   where source = 'TELECOM' and status <> 'VOID'
   group by 1
),
may as (
  select subscription_source_id as sid,
         count(*) filter (where status = 'NOT_RETURNED') as may_chua_tra
    from device_snapshot where source = 'TELECOM' and subscription_source_id is not null
   group by 1
),
nguong as (
  select (select value::int from threshold where key = 'ar_overdue_days')   as qua_han,
         (select value::int from threshold where key = 'invoice_grace_days') as an_han
)
select
  s.source_id                                   as subscription_id,
  s.party_id,
  p.display_name                                as khach,
  ps.customer_type                              as loai_khach,
  customer_type_label(ps.customer_type)         as loai_khach_chu,
  ps.customer_group                             as nhom_khach,
  s.service_type,
  s.plan_name                                   as goi,
  s.status                                      as trang_thai,
  s.monthly_price                               as gia_thang,
  s.activated_on                                as ngay_kich_hoat,
  s.terminated_on                               as ngay_ngung,
  s.device_ref                                  as ma_may,
  coalesce(hd.so_hoa_don, 0)                    as so_hoa_don,
  coalesce(hd.hoa_don_dang_doi, 0)              as hoa_don_dang_doi,
  coalesce(hd.con_no, 0)                        as con_no,
  coalesce(hd.hoa_don_mat, 0)                   as hoa_don_mat,
  coalesce(hd.tien_mat, 0)                      as tien_mat,
  coalesce(hd.da_thu, 0)                        as da_thu,
  hd.ky_gan_nhat_den,
  coalesce(hd.ngay_qua_han, 0)                  as ngay_qua_han,
  coalesce(may.may_chua_tra, 0)                 as may_chua_tra,
  coalesce(
    current_date - hd.ky_gan_nhat_den,
    current_date - s.activated_on)              as ngay_khong_co_cuoc,
  array_remove(array[
    case when coalesce(hd.ngay_qua_han, 0) > (select qua_han from nguong)
         then 'NO_QUA_HAN' end,
    case when coalesce(hd.hoa_don_mat, 0) > 0 then 'KHONG_DOI_DUOC' end,
    case when s.status = 'ACTIVE'
          and coalesce(current_date - hd.ky_gan_nhat_den,
                       current_date - s.activated_on) > (select an_han from nguong)
         then 'THIEU_HOA_DON' end,
    case when s.status = 'ACTIVE' and (s.monthly_price is null or s.monthly_price = 0)
         then 'THIEU_GIA' end,
    case when coalesce(may.may_chua_tra, 0) > 0 then 'MAY_CHUA_TRA' end
  ], null)                                      as canh_bao
from subscription_snapshot s
left join party p    on p.id = s.party_id
left join party_source ps
       on ps.source = 'TELECOM' and ps.source_customer_id = s.source_customer_id
      and ps.status <> 'REJECTED'
left join hd         on hd.sid = s.source_id
left join may        on may.sid = s.source_id
where s.source = 'TELECOM';

drop view if exists v_telecom_customer;
create view v_telecom_customer as
-- Gom cảnh báo ở CTE riêng: bung mảng ngay trong FROM sẽ nhân đôi dòng và làm
-- sai mọi phép đếm, phép cộng bên dưới.
with cb as (
  select s.party_id, array_agg(distinct u.cb) as canh_bao
    from v_telecom_subscription s, unnest(s.canh_bao) as u(cb)
   where s.party_id is not null
   group by 1
)
select
  p.id                                                            as party_id,
  coalesce(p.display_name, 'khách chưa có tên')                   as khach,
  p.phone_norm                                                    as dien_thoai,
  max(s.loai_khach)                                               as loai_khach,
  customer_type_label(max(s.loai_khach))                          as loai_khach_chu,
  max(s.nhom_khach)                                               as nhom_khach,
  count(*)                                                        as so_thue_bao,
  count(*) filter (where s.trang_thai = 'ACTIVE')                 as dang_chay,
  array_agg(distinct s.service_type) filter (where s.service_type is not null) as dich_vu,
  round(sum(s.da_thu))                                            as da_thu,
  round(sum(s.con_no))                                            as con_no,
  round(sum(s.tien_mat))                                          as tien_mat,
  sum(s.may_chua_tra)                                             as may_chua_tra,
  max(s.ngay_qua_han)                                             as ngay_qua_han,
  max(s.ky_gan_nhat_den)                                          as ky_gan_nhat_den,
  coalesce(cb.canh_bao, '{}')                                     as canh_bao
from v_telecom_subscription s
join party p on p.id = s.party_id
left join cb on cb.party_id = p.id
group by p.id, p.display_name, p.phone_norm, cb.canh_bao;

drop view if exists v_telecom_customer_sub;
create view v_telecom_customer_sub as
select party_id, subscription_id, service_type, goi, trang_thai, gia_thang,
       ngay_kich_hoat, ngay_ngung, ma_may, so_hoa_don, da_thu, con_no, tien_mat,
       ky_gan_nhat_den, ngay_qua_han, canh_bao
from v_telecom_subscription;
