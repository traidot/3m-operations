-- Sửa luật "đang ra cước": phải xét trạng thái thuê bao TRƯỚC kỳ cuối.
--
-- Luật cũ xếp DANG_RA_CUOC chỉ dựa vào `ky_cuoi >= tháng này`, đặt trên cả
-- nhánh kiểm tra thuê bao. Thuê bao huỷ giữa tháng thì kỳ cuối vẫn rơi vào
-- tháng này, nên máy đọc ra thành "đang ra cước" trong khi dịch vụ đã dừng.
--
-- Ví dụ David bắt được — IMEI 352470206966615:
--   thuê bao 3248 TERMINATED, huỷ 01/09/2026
--   máy đã nhập lại kho Takadanobaba 10/09/2026, lý do "nhận về do huỷ thuê bao"
--   kỳ 2026-09 là hoá đơn UNPAYABLE, tức không thu được, không phải đang đòi
-- vậy mà màn hình ghi "đang ra cước".
--
-- Sai 114 máy. Đưa nhánh trạng thái thuê bao lên trước: huỷ thì là huỷ, bất kể
-- kỳ cuối rơi vào tháng nào.

-- Chỉ đổi biểu thức CASE, danh sách cột giữ nguyên, nên replace được. Quan
-- trọng: KHÔNG drop, vì bốn view kho đang đọc v_telecom_may, drop là chúng đi
-- theo và migration sau đó gãy.
create or replace view v_telecom_may as
with luot as (
  select distinct on (imei)
         imei, source_id as may_id, status, deposit, deposit_status,
         rented_on, returned_on, subscription_source_id
    from device_snapshot
   where source = 'TELECOM' and imei is not null
   order by imei, rented_on desc nulls last, source_id desc
), doi_may as (
  -- Lượt gần nhất CÓ ghi sản phẩm mới cho biết đây là máy gì.
  select distinct on (imei) imei, model, device_type
    from device_snapshot
   where source = 'TELECOM' and imei is not null and model is not null
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
), gan_cuoi as (
  -- Lượt gắn mới nhất: thuê bao đang (hoặc vừa) dùng máy này. LEFT JOIN vì thuê
  -- bao có thể đã bị xoá ở nguồn, mất nó thì máy trông như chưa bao giờ gắn.
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
         -- Tháng đầu tiên lẽ ra phải có cước mà không có.
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
           -- Thuê bao đã dừng thì là dừng, kể cả khi kỳ cuối rơi vào tháng này.
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
       l.status <> 'RETURNED' and coalesce(c.so_ky, 0) = 0 as chua_ra_cuoc,
       telecom_url('thue_bao', l.subscription_source_id) as link_cms,
       -- Bốn nhóm loại trừ nhau, phủ hết mọi máy.
       x.tinh_trang_cuoc,
       gc.subscription_source_id         as thue_bao_gan_cuoi,
       x.trang_thai_tb                   as trang_thai_tb_gan_cuoi,
       -- Số tháng máy nằm ngoài mà không ra cước, tính tới tháng này.
       case when x.tinh_trang_cuoc = 'DANG_RA_CUOC' or x.tinh_trang_cuoc = 'DA_TRA'
            then 0 else x.thang_ho end   as thang_hut,
       -- Ước tính, không phải số sổ: tháng hụt × giá gói của thuê bao gắn cuối.
       -- Chỉ tính cho nhóm HUT_CUOC vì hai nhóm kia không còn dịch vụ để thu.
       case when x.tinh_trang_cuoc = 'HUT_CUOC'
            then round(coalesce(x.monthly_price, 0) * x.thang_ho) else 0 end as tien_hut_uoc
  from luot l
  join tong_luot t on t.imei = l.imei
  join xep x on x.imei = l.imei
  left join doi_may dm on dm.imei = l.imei
  left join gan  g on g.imei = l.imei
  left join gan_cuoi gc on gc.imei = l.imei
  left join cuoc c on c.imei = l.imei
  left join subscription_snapshot s
    on s.source = 'TELECOM' and s.source_id = l.subscription_source_id
  left join party_source ps
    on ps.source = 'TELECOM' and ps.source_customer_id = s.source_customer_id
   and ps.status <> 'REJECTED'
  left join party p on p.id = ps.party_id;
