-- Màn hình cọc đi từ lượt GẮN THUÊ BAO nên bỏ sót cọc của máy chưa gắn.
--
-- 405 máy đang giữ 1.186.107 yên cọc mà /cam-tay/coc không thấy:
--   191 chưa gắn thuê bao bao giờ        831.357
--   178 thuê bao đã huỷ, lượt gắn đã đóng 213.750
--    35 hụt cước                          135.000
--     1 thuê bao đã xoá                     6.000
--
-- Tiền cọc gắn với CÁI MÁY, không gắn với thuê bao — máy nằm ở khách thì tiền
-- vẫn đang giữ dù có mở dịch vụ hay không. Nên đổi gốc: đi từ máy, thuê bao chỉ
-- là thông tin kèm theo. Sau migration này ba màn hình may/coc/kho cùng ra
-- 6.103.662.
--
-- Bỏ nhóm KHONG_CO_PHIEU: nó có nghĩa "lượt gắn thuê bao mà không tìm thấy
-- phiếu thuê", đi từ máy thì không còn tồn tại. Thay bằng CHUA_GAN.

drop view if exists v_telecom_deposit_summary;
drop view if exists v_telecom_deposit;

create view v_telecom_deposit as
with luot as (
  select distinct on (imei)
         imei, status, deposit, deposit_status, rented_on, returned_on
    from device_snapshot
   where source = 'TELECOM' and imei is not null
   order by imei, rented_on desc nulls last, source_id desc
), gan as (
  select distinct on (sd.imei)
         sd.imei, sd.subscription_source_id, sd.started_on, sd.ended_on
    from subscription_device_snapshot sd
   where sd.source = 'TELECOM'
   order by sd.imei, sd.started_on desc nulls last, sd.source_id desc
)
select l.imei,
  g.subscription_source_id                        as subscription_id,
  s.party_id,
  coalesce(p.display_name, 'khách chưa có tên')   as khach,
  ps.customer_type                                as loai_khach,
  s.service_type,
  s.status                                        as trang_thai_thue_bao,
  s.terminated_on                                 as ngay_ngung,
  l.status                                        as trang_thai_may,
  l.deposit                                       as coc,
  l.deposit_status                                as trang_thai_coc,
  l.rented_on                                     as ngay_thue,
  l.returned_on                                   as ngay_tra,
  g.started_on                                    as gan_tu,
  g.ended_on                                      as gan_den,
  case
    when l.status = 'NOT_RETURNED' and l.deposit_status = 'PENDING' then 'CHUA_TRA'
    when l.deposit_status = 'PENDING' and g.imei is null            then 'CHUA_GAN'
    when l.deposit_status = 'PENDING' and s.status = 'TERMINATED'   then 'NGUNG_CHUA_CHOT'
    when l.deposit_status = 'PENDING'                               then 'DANG_THUE'
    else 'XONG'
  end                                             as nhom,
  current_date - coalesce(s.terminated_on, g.started_on, l.rented_on) as so_ngay_treo
from luot l
left join gan g on g.imei = l.imei
left join subscription_snapshot s
       on s.source = 'TELECOM' and s.source_id = g.subscription_source_id
left join party_source ps
       on ps.source = 'TELECOM' and ps.source_customer_id = s.source_customer_id
      and ps.status <> 'REJECTED'
left join party p on p.id = ps.party_id;

create view v_telecom_deposit_summary as
select nhom,
       count(*)                        as so_may,
       round(coalesce(sum(coc), 0))    as tien,
       max(so_ngay_treo)               as treo_lau_nhat
from v_telecom_deposit group by nhom;
