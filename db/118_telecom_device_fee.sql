-- Thiết bị wifi cầm tay: tình trạng máy và lịch sử thu cước của từng máy.
--
-- Đơn vị là máy CHO THUÊ (rental_device, 3.048 cái), không phải mọi IMEI từng
-- xuất hiện. Lịch sử gắn máy ghi theo deviceCode bất kể máy có thuộc diện cho
-- thuê hay không, nên có 1.226 IMEI nằm ngoài danh sách này — máy khách tự có.
-- Ngược lại 276 máy cho thuê chưa từng gắn thuê bao nào.
--
-- Cước của MÁY, không phải cước của thuê bao: một máy đi qua nhiều thuê bao,
-- và một thuê bao có thể đổi máy giữa chừng. Nên chỉ lấy kỳ cước nằm trong
-- khoảng máy gắn với thuê bao đó — ngoài khoảng là cước của máy khác.
--
-- Cột model thực ra là device_info.msn (số serial nhà mạng), không phải mã máy;
-- 2.910/3.048 để trống nên gần như vô dụng. Giữ nguyên tên để khớp lược đồ.

create or replace view v_telecom_may_ky as
select d.source_id                       as may_id,
       d.imei,
       sd.subscription_source_id         as subscription_id,
       to_char(make_date(f.nam, f.thang, 1), 'YYYY-MM') as ky,
       f.amount                          as tien,
       i.status                          as trang_thai_hd,
       i.number                          as so_hoa_don,
       i.source_id                       as invoice_id
  from device_snapshot d
  join subscription_device_snapshot sd
    on sd.source = 'TELECOM' and sd.imei = d.imei
  join fee_line_snapshot f
    on f.source = 'TELECOM'
   and f.subscription_source_id = sd.subscription_source_id
   -- Khoảng gắn máy tính theo THÁNG: kỳ cước không có ngày, chỉ có năm tháng.
   and make_date(f.nam, f.thang, 1) >= coalesce(date_trunc('month', sd.started_on)::date, '1900-01-01')
   and make_date(f.nam, f.thang, 1) <= coalesce(date_trunc('month', sd.ended_on)::date, '2999-12-31')
  left join invoice_snapshot i
    on i.source = 'TELECOM' and i.source_id = f.invoice_source_id
 where d.source = 'TELECOM';

comment on view v_telecom_may_ky is
  'Từng kỳ cước gắn với máy cho thuê wifi cầm tay, đã giới hạn trong khoảng máy ở với thuê bao';

/** Một dòng một máy: tình trạng máy và cước gộp lại. */
create or replace view v_telecom_may as
with cuoc as (
  select may_id,
         count(*)                                                     as so_ky,
         min(ky)                                                      as ky_dau,
         max(ky)                                                      as ky_cuoi,
         round(sum(tien))                                             as phai_thu,
         round(sum(tien) filter (where trang_thai_hd = 'PAID'))        as da_thu,
         round(sum(tien) filter (where trang_thai_hd = 'ISSUED'))      as chua_thu,
         round(sum(tien) filter (where trang_thai_hd = 'UNPAYABLE'))   as mat_trang,
         count(distinct subscription_id)                              as so_thue_bao_co_cuoc
    from v_telecom_may_ky
   group by may_id
), gan as (
  select d.source_id as may_id,
         count(*)                         as so_lan_gan,
         count(distinct sd.subscription_source_id) as so_thue_bao,
         min(sd.started_on)               as gan_lan_dau,
         max(coalesce(sd.ended_on, current_date)) as gan_gan_nhat
    from device_snapshot d
    join subscription_device_snapshot sd on sd.source = 'TELECOM' and sd.imei = d.imei
   where d.source = 'TELECOM'
   group by d.source_id
)
select d.source_id                        as may_id,
       d.imei,
       d.model,
       d.status                           as trang_thai,
       d.deposit                          as coc,
       d.deposit_status                   as trang_thai_coc,
       d.rented_on                        as ngay_thue,
       d.returned_on                      as ngay_tra,
       d.subscription_source_id           as thue_bao_hien_tai,
       s.service_type                     as dich_vu,
       s.plan_name                        as goi,
       s.status                           as trang_thai_thue_bao,
       coalesce(p.display_name, 'khách chưa có tên') as khach,
       ps.customer_code                   as ma_khach,
       ps.customer_type                   as loai_khach,
       coalesce(g.so_lan_gan, 0)          as so_lan_gan,
       coalesce(g.so_thue_bao, 0)         as so_thue_bao,
       g.gan_lan_dau,
       coalesce(c.so_ky, 0)               as so_ky,
       c.ky_dau,
       c.ky_cuoi,
       coalesce(c.phai_thu, 0)            as phai_thu,
       coalesce(c.da_thu, 0)              as da_thu,
       coalesce(c.chua_thu, 0)            as chua_thu,
       coalesce(c.mat_trang, 0)           as mat_trang,
       -- Máy còn ở nhà khách mà không ra kỳ cước nào là chỗ đáng xem nhất:
       -- hoặc chưa gắn thuê bao, hoặc gắn rồi mà không ai xuất cước.
       d.status <> 'RETURNED' and coalesce(c.so_ky, 0) = 0 as chua_ra_cuoc,
       telecom_url('thue_bao', d.subscription_source_id) as link_cms
  from device_snapshot d
  left join cuoc c on c.may_id = d.source_id
  left join gan  g on g.may_id = d.source_id
  left join subscription_snapshot s
    on s.source = 'TELECOM' and s.source_id = d.subscription_source_id
  left join party_source ps
    on ps.source = 'TELECOM' and ps.source_customer_id = s.source_customer_id
   and ps.status <> 'REJECTED'
  left join party p on p.id = ps.party_id
 where d.source = 'TELECOM';

comment on view v_telecom_may is
  'Một dòng một máy cho thuê wifi cầm tay: tình trạng, cọc, thuê bao đang gắn, và cước gộp';
