-- Cọc đang giữ đang có bốn con số khác nhau cho cùng một túi tiền. Cả hai chỗ
-- tính đều sai, mỗi chỗ sai một kiểu.
--
--   8.168.303  v_telecom_may      cộng cọc của MỌI lượt thuê của một máy
--   5.696.048  v_telecom_deposit  nhân lên theo số lượt gắn thuê bao
--   6.103.662  đúng: cọc của lượt thuê MỚI NHẤT, khi lượt đó còn PENDING
--
-- Vì sao lượt cũ không tính: IMEI 355185373693308 có ba lượt, cả ba đều
-- RENTING, cả ba đều chưa ghi ngày trả, mỗi lượt cọc 4.000 — thuê 01/05, 25/08
-- rồi 15/09/2026. Một cái máy không cho ba người thuê cùng lúc; đó là bản ghi
-- cũ không được đóng, đúng như ghi chú ở db/119 về việc lượt cũ vẫn để RENTING.
-- Toàn hệ có 568 lượt như vậy, tương đương 2.064.641 yên cọc ma.
--
-- Và không có lượt PENDING nào đã ghi ngày trả, nên "lượt mới nhất còn PENDING"
-- đọc ra đúng 2.418 máy — khớp số máy còn ở ngoài.

create or replace view v_telecom_may as
with luot as (
  select distinct on (imei)
         imei, source_id as may_id, status, deposit, deposit_status,
         rented_on, returned_on, subscription_source_id
    from device_snapshot
   where source = 'TELECOM' and imei is not null
   order by imei, rented_on desc nulls last, source_id desc
), doi_may as (
  select distinct on (imei) imei, model, device_type
    from device_snapshot
   where source = 'TELECOM' and imei is not null and model is not null
   order by imei, rented_on desc nulls last, source_id desc
), tong_luot as (
  -- Chỉ đếm số lượt và ngày thuê lần đầu ở đây. Cọc thì lấy từ `luot`, vì cộng
  -- cọc của mọi lượt là cộng cả cọc của lượt đã bị thay thế.
  select imei,
         count(*)       as so_luot_thue,
         min(rented_on) as thue_lan_dau
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
), gan_cuoi as (
  select distinct on (sd.imei)
         sd.imei, sd.subscription_source_id, sd.started_on,
         s.status as trang_thai_tb, s.monthly_price
    from subscription_device_snapshot sd
    left join subscription_snapshot s
      on s.source = 'TELECOM' and s.source_id = sd.subscription_source_id
   where sd.source = 'TELECOM'
   order by sd.imei, sd.started_on desc nulls last, sd.source_id desc
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
), nen as (
  select l.imei, l.status as trang_thai, c.ky_cuoi, gc.trang_thai_tb,
         gc.monthly_price, gc.started_on, coalesce(g.so_lan_gan, 0) as co_gan,
         coalesce(to_date(c.ky_cuoi, 'YYYY-MM') + interval '1 mon',
                  date_trunc('month', gc.started_on))::date as tu_thang
    from luot l
    left join cuoc c on c.imei = l.imei
    left join gan  g  on g.imei  = l.imei
    left join gan_cuoi gc on gc.imei = l.imei
), xep as (
  select n.*,
         case
           when n.trang_thai = 'RETURNED'                     then 'DA_TRA'
           when n.co_gan = 0                                  then 'CHUA_GAN'
           when n.trang_thai_tb is null                       then 'TB_DA_XOA'
           when n.trang_thai_tb <> 'ACTIVE'                   then 'HUY_CHUA_THU_MAY'
           when n.ky_cuoi >= to_char(CURRENT_DATE, 'YYYY-MM') then 'DANG_RA_CUOC'
           else 'HUT_CUOC'
         end as tinh_trang_cuoc,
         greatest(0, (extract(year  from age(date_trunc('month', CURRENT_DATE), n.tu_thang)) * 12
                    + extract(month from age(date_trunc('month', CURRENT_DATE), n.tu_thang)))::int + 1)
           as thang_ho
    from nen n
)
select l.imei,
       l.may_id                          as luot_moi_nhat_id,
       dm.model,
       dm.device_type                    as nhom_may,
       l.status                          as trang_thai,
       -- Cọc của chính lượt mới nhất, không cộng lượt cũ.
       case when l.deposit_status = 'PENDING' then round(l.deposit) else 0 end as coc,
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
       l.status <> 'RETURNED' and coalesce(c.so_ky, 0) = 0 as chua_ra_cuoc,
       telecom_url('thue_bao', l.subscription_source_id) as link_cms,
       x.tinh_trang_cuoc,
       gc.subscription_source_id         as thue_bao_gan_cuoi,
       x.trang_thai_tb                   as trang_thai_tb_gan_cuoi,
       case when x.tinh_trang_cuoc in ('DANG_RA_CUOC', 'DA_TRA')
            then 0 else x.thang_ho end   as thang_hut,
       case when x.tinh_trang_cuoc = 'HUT_CUOC'
            then round(coalesce(x.monthly_price, 0) * x.thang_ho) else 0 end as tien_hut_uoc
  from luot l
  join tong_luot t on t.imei = l.imei
  join xep x on x.imei = l.imei
  left join gan  g on g.imei = l.imei
  left join gan_cuoi gc on gc.imei = l.imei
  left join doi_may dm on dm.imei = l.imei
  left join cuoc c on c.imei = l.imei
  left join subscription_snapshot s
    on s.source = 'TELECOM' and s.source_id = l.subscription_source_id
  left join party_source ps
    on ps.source = 'TELECOM' and ps.source_customer_id = s.source_customer_id
   and ps.status <> 'REJECTED'
  left join party p on p.id = ps.party_id;

/** Một dòng một MÁY, không phải một dòng một lượt gắn thuê bao. */
drop view if exists v_telecom_deposit_summary;
drop view if exists v_telecom_deposit;

create view v_telecom_deposit as
select distinct on (sd.imei)
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
    when d.status = 'NOT_RETURNED' and d.deposit_status = 'PENDING' then 'CHUA_TRA'
    when d.deposit_status = 'PENDING' and s.status = 'TERMINATED'   then 'NGUNG_CHUA_CHOT'
    when d.imei is null and sd.ended_on is null                     then 'KHONG_CO_PHIEU'
    when d.deposit_status = 'PENDING'                               then 'DANG_THUE'
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
where sd.source = 'TELECOM' and sd.ended_on is null
order by sd.imei, sd.started_on desc nulls last, sd.source_id desc;

create view v_telecom_deposit_summary as
select nhom,
       count(*)                        as so_may,
       round(coalesce(sum(coc), 0))    as tien,
       max(so_ngay_treo)               as treo_lau_nhat
from v_telecom_deposit group by nhom;
