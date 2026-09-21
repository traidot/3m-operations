-- Màn hình máy cho thuê chỉ đọc khách từ hồ sơ cho thuê, nên 221 máy không
-- biết khách là ai — trong đó có cả máy đang nằm ở đại lý.
--
-- Dùng đúng chuỗi dự phòng của bên đối chiếu kho: hồ sơ cho thuê → thuê bao →
-- khách trên phiếu xuất gần nhất. Sau khi sửa, cả 2.428 máy đều biết loại
-- khách: 2.309 khách lẻ, 94 cộng tác viên, 25 đại lý.

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
), kx as (
  -- Khách trên phiếu xuất gần nhất: chỗ cuối cùng còn biết máy đi tới tay ai.
  select distinct on (ltrim(xc.device_code, '0'))
         ltrim(xc.device_code, '0') as ma_chuan,
         coalesce(pt.display_name, 'khách chưa có tên') as khach,
         ps.customer_code as ma_khach, ps.customer_type as loai_khach
    from v_kho_xuat_cuoi xc
    left join party pt on pt.id = xc.party_id
    left join party_source ps
      on ps.source = 'TELECOM' and ps.party_id = xc.party_id and ps.status <> 'REJECTED'
   where xc.party_id is not null
   order by 1, xc.doc_date desc nulls last, xc.device_code
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
       -- Cùng thứ tự ưu tiên với bên đối chiếu kho: hồ sơ cho thuê → thuê bao
       -- → khách trên phiếu xuất. Chỉ đọc hồ sơ cho thuê thì 221 máy không biết
       -- khách là ai, trong đó có cả máy đang nằm ở đại lý.
       coalesce(p.display_name, tb.khach, kx.khach, 'khách chưa có tên') as khach,
       coalesce(ps.customer_code, tb.ma_khach, kx.ma_khach)   as ma_khach,
       coalesce(ps.customer_type, tb.loai_khach, kx.loai_khach) as loai_khach,
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
  left join v_tb_ma tb on tb.ma_chuan = ltrim(l.imei, '0')
  left join kx on kx.ma_chuan = ltrim(l.imei, '0')
  left join cuoc c on c.imei = l.imei
  left join subscription_snapshot s
    on s.source = 'TELECOM' and s.source_id = l.subscription_source_id
  left join party_source ps
    on ps.source = 'TELECOM' and ps.source_customer_id = s.source_customer_id
   and ps.status <> 'REJECTED'
  left join party p on p.id = ps.party_id;

