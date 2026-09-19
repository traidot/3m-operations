-- Đơn vị của bảng máy là IMEI, không phải bản ghi rental_device.
--
-- 118 lấy mỗi dòng rental_device làm một máy. Sai: bảng đó ghi từng LƯỢT cho
-- thuê, cùng một máy cho thuê lại thì sinh bản ghi mới. 3.048 bản ghi nhưng chỉ
-- 2.428 IMEI — có máy 6 lượt (861720051147735: thuê 01/2026, 03, trả 04, thuê
-- lại 05, 07, 09).
--
-- Hậu quả: nối cước theo IMEI rồi gộp theo bản ghi thì mỗi kỳ cước bị đếm lại
-- theo số lượt. Phải thu đọc ra 64.005.565 trong khi số thật là 54.202.372 —
-- thổi phồng 9.803.193 yên.
--
-- Trạng thái máy lấy theo lượt MỚI NHẤT. Lưu ý dữ liệu nguồn: nhiều lượt cũ vẫn
-- để RENTING dù máy đã cho thuê lại chỗ khác, nên đừng đếm trạng thái theo bản
-- ghi mà phải theo lượt mới nhất của từng máy.

drop view if exists v_telecom_may;
drop view if exists v_telecom_may_ky;

/** Kỳ cước gắn với một MÁY, đã loại trùng do máy có nhiều lượt thuê. */
create view v_telecom_may_ky as
select distinct
       d.imei,
       sd.subscription_source_id         as subscription_id,
       to_char(make_date(f.nam, f.thang, 1), 'YYYY-MM') as ky,
       f.source_id                       as fee_line_id,
       f.amount                          as tien,
       i.status                          as trang_thai_hd,
       i.number                          as so_hoa_don
  from (select distinct imei from device_snapshot where source = 'TELECOM' and imei is not null) d
  join subscription_device_snapshot sd
    on sd.source = 'TELECOM' and sd.imei = d.imei
  join fee_line_snapshot f
    on f.source = 'TELECOM'
   and f.subscription_source_id = sd.subscription_source_id
   -- Khoảng gắn máy tính theo THÁNG: kỳ cước không có ngày, chỉ có năm tháng.
   and make_date(f.nam, f.thang, 1) >= coalesce(date_trunc('month', sd.started_on)::date, '1900-01-01')
   and make_date(f.nam, f.thang, 1) <= coalesce(date_trunc('month', sd.ended_on)::date, '2999-12-31')
  left join invoice_snapshot i
    on i.source = 'TELECOM' and i.source_id = f.invoice_source_id;

comment on view v_telecom_may_ky is
  'Kỳ cước của từng máy wifi cầm tay theo IMEI, đã loại trùng do nhiều lượt thuê';

/** Một dòng một máy. */
create view v_telecom_may as
with luot as (
  -- Lượt mới nhất quyết định tình trạng hiện tại của máy.
  select distinct on (imei)
         imei, source_id as may_id, status, deposit, deposit_status,
         rented_on, returned_on, subscription_source_id, model
    from device_snapshot
   where source = 'TELECOM' and imei is not null
   order by imei, rented_on desc nulls last, source_id desc
), tong_luot as (
  select imei,
         count(*)                                             as so_luot_thue,
         min(rented_on)                                       as thue_lan_dau,
         round(sum(deposit) filter (where deposit_status = 'PENDING')) as coc_dang_giu
    from device_snapshot
   where source = 'TELECOM' and imei is not null
   group by imei
), gan as (
  select sd.imei,
         count(*)                                  as so_lan_gan,
         count(distinct sd.subscription_source_id) as so_thue_bao
    from subscription_device_snapshot sd
   where sd.source = 'TELECOM'
   group by sd.imei
), cuoc as (
  select imei,
         count(*)                                                   as so_ky,
         min(ky)                                                    as ky_dau,
         max(ky)                                                    as ky_cuoi,
         round(sum(tien))                                           as phai_thu,
         round(sum(tien) filter (where trang_thai_hd = 'PAID'))      as da_thu,
         round(sum(tien) filter (where trang_thai_hd = 'ISSUED'))    as chua_thu,
         round(sum(tien) filter (where trang_thai_hd = 'UNPAYABLE')) as mat_trang
    from v_telecom_may_ky
   group by imei
)
select l.imei,
       l.may_id                          as luot_moi_nhat_id,
       l.model,
       l.status                          as trang_thai,
       t.coc_dang_giu                    as coc,
       l.deposit_status                  as trang_thai_coc,
       t.thue_lan_dau                    as ngay_thue,
       l.returned_on                     as ngay_tra,
       t.so_luot_thue,
       l.subscription_source_id          as thue_bao_hien_tai,
       s.service_type                    as dich_vu,
       s.plan_name                       as goi,
       s.status                          as trang_thai_thue_bao,
       coalesce(p.display_name, 'khách chưa có tên') as khach,
       ps.customer_code                  as ma_khach,
       ps.customer_type                  as loai_khach,
       coalesce(g.so_lan_gan, 0)         as so_lan_gan,
       coalesce(g.so_thue_bao, 0)        as so_thue_bao,
       coalesce(c.so_ky, 0)              as so_ky,
       c.ky_dau,
       c.ky_cuoi,
       coalesce(c.phai_thu, 0)           as phai_thu,
       coalesce(c.da_thu, 0)             as da_thu,
       coalesce(c.chua_thu, 0)           as chua_thu,
       coalesce(c.mat_trang, 0)          as mat_trang,
       -- Máy còn ở ngoài mà không ra kỳ cước nào là chỗ đáng xem nhất: hoặc
       -- chưa gắn thuê bao, hoặc gắn rồi mà không ai xuất cước.
       l.status <> 'RETURNED' and coalesce(c.so_ky, 0) = 0 as chua_ra_cuoc,
       telecom_url('thue_bao', l.subscription_source_id) as link_cms
  from luot l
  join tong_luot t on t.imei = l.imei
  left join gan  g on g.imei = l.imei
  left join cuoc c on c.imei = l.imei
  left join subscription_snapshot s
    on s.source = 'TELECOM' and s.source_id = l.subscription_source_id
  left join party_source ps
    on ps.source = 'TELECOM' and ps.source_customer_id = s.source_customer_id
   and ps.status <> 'REJECTED'
  left join party p on p.id = ps.party_id;

comment on view v_telecom_may is
  'Một dòng một máy wifi cầm tay theo IMEI: tình trạng lượt mới nhất, cọc đang giữ, và cước gộp';
