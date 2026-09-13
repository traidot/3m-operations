-- Trang cọc đang lấy sẵn chữ tiếng Việt của vai trò khách, nên web không biết
-- mã gốc để tô màu chip. Trả về mã, để việc dịch chữ cho web như mọi chỗ khác.
-- Cột giữ nguyên tên và kiểu nên replace được, view tổng ở dưới không đụng tới.

create or replace view v_telecom_deposit as
select
  sd.imei,
  sd.subscription_source_id                       as subscription_id,
  s.party_id,
  coalesce(p.display_name, 'khách chưa có tên')   as khach,
  ps.customer_type                                as loai_khach,
  s.service_type,
  s.status                                        as trang_thai_thue_bao,
  s.terminated_on                                 as ngay_ngung,
  d.status                                        as trang_thai_may,
  d.deposit                                       as coc,
  d.deposit_status                                as trang_thai_coc,
  d.rented_on                                     as ngay_thue,
  d.returned_on                                   as ngay_tra,
  sd.started_on                                   as gan_tu,
  sd.ended_on                                     as gan_den,
  case
    when d.status = 'NOT_RETURNED' and d.deposit_status = 'PENDING'
      then 'CHUA_TRA'
    when d.deposit_status = 'PENDING' and s.status = 'TERMINATED'
      then 'NGUNG_CHUA_CHOT'
    when d.imei is null and sd.ended_on is null
      then 'KHONG_CO_PHIEU'
    when d.deposit_status = 'PENDING'
      then 'DANG_THUE'
    else 'XONG'
  end                                             as nhom,
  current_date - coalesce(s.terminated_on, sd.started_on, d.rented_on) as so_ngay_treo
from subscription_device_snapshot sd
left join lateral (
  select * from device_snapshot dv
   where dv.source = sd.source and dv.imei = sd.imei
   order by dv.rented_on desc nulls last, dv.source_id desc
   limit 1
) d on true
left join subscription_snapshot s
       on s.source = 'TELECOM' and s.source_id = sd.subscription_source_id
left join party p on p.id = s.party_id
left join party_source ps
       on ps.source = 'TELECOM' and ps.source_customer_id = s.source_customer_id
      and ps.status <> 'REJECTED'
where sd.source = 'TELECOM' and sd.ended_on is null;
