-- Một kỳ cước chỉ được tính cho MỘT máy.
--
-- v_telecom_may_ky nối kỳ cước với máy theo khoảng gắn. Thuê bao đổi máy giữa
-- tháng thì kỳ đó nằm trong khoảng của cả máy cũ lẫn máy mới, nên cùng một kỳ
-- được cộng vào hai máy. 216 kỳ như vậy, 737.954 yên bị đếm thừa trên màn hình
-- máy cho thuê — ví dụ kỳ 2026-04 của thuê bao 1176 cộng vào cả
-- 861720051148477 lẫn 861720051178235.
--
-- Chọn máy nào: lượt gắn MỚI NHẤT còn phủ kỳ đó — tức máy đang dùng ở thời
-- điểm cuối kỳ. Không chia đôi tiền, vì hoá đơn không chia.
--
-- Khác với cặp thuê bao-kỳ có hai hoá đơn CÙNG đã thu (18 cặp, 141.769 yên):
-- chỗ đó là hai lần thu thật, tiền thật, không phải đếm trùng — giữ nguyên.

-- Cả chuỗi view kho đọc v_telecom_may nên phải gỡ rồi dựng lại y như cũ.
drop view if exists v_kho_ma;
drop view if exists v_kho_phan_mem;
drop view if exists v_kho_doi_chieu;
drop view if exists v_kho_thieu_o_file;
drop view if exists v_telecom_may;
drop view if exists v_telecom_may_ky;

create view v_telecom_may_ky as
select distinct on (f.source_id)
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
   and make_date(f.nam, f.thang, 1) >= coalesce(date_trunc('month', sd.started_on)::date, '1900-01-01')
   and make_date(f.nam, f.thang, 1) <= coalesce(date_trunc('month', sd.ended_on)::date, '2999-12-31')
  left join invoice_snapshot i
    on i.source = 'TELECOM' and i.source_id = f.invoice_source_id
 order by f.source_id, sd.started_on desc nulls last, d.imei;

comment on view v_telecom_may_ky is
  'Kỳ cước của từng máy, mỗi kỳ chỉ tính cho một máy — lượt gắn mới nhất còn phủ kỳ đó';

create view v_telecom_may as
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


-- Dựng lại chuỗi view kho, nguyên văn bản mới nhất.

create view v_kho_phan_mem as
with ma as (
  select distinct ltrim(device_code, '0') as ma_chuan from stock_move_snapshot
   where source = 'TELECOM' and device_code is not null
  union select distinct ltrim(imei, '0') from device_snapshot
   where source = 'TELECOM' and imei is not null
  union select distinct ltrim(imei, '0') from subscription_device_snapshot
   where source = 'TELECOM' and imei is not null
  union select distinct ltrim(device_code, '0') from provider_device_snapshot
   where source = 'TELECOM' and device_code is not null
), p as (
  select distinct on (ltrim(device_code, '0'))
         ltrim(device_code, '0') as ma_chuan, device_code,
         doc_type, reason_type, product_name, warehouse_name, doc_date
    from v_kho_phieu_cuoi
   order by 1, doc_date desc nulls last, device_code
), x as (
  -- Lấy luôn loại khách từ party_source: 631 mã chỉ có phiếu xuất, không thuê
  -- bao, nên nếu chỉ lấy tên thì biết là "Đại lý Tuấn BĐS" mà vẫn ghi "chưa
  -- phân loại" — đọc ra vô lý.
  select distinct on (ltrim(x.device_code, '0'))
         ltrim(x.device_code, '0') as ma_chuan,
         coalesce(pt.display_name, 'khách chưa có tên') as khach_phieu,
         ps.customer_code as ma_khach_phieu,
         ps.customer_type as loai_khach_phieu,
         x.doc_date as ngay_xuat
    from v_kho_xuat_cuoi x
    left join party pt on pt.id = x.party_id
    left join party_source ps
      on ps.source = 'TELECOM' and ps.party_id = x.party_id and ps.status <> 'REJECTED'
   where x.party_id is not null
   order by 1, x.doc_date desc nulls last, x.device_code
), nm as (
  select distinct on (ltrim(device_code, '0'))
         ltrim(device_code, '0') as ma_chuan, state, vendor
    from provider_device_snapshot
   where source = 'TELECOM' and device_code is not null
   order by 1, state
), tb as (
  select * from v_tb_ma
), m as (
  select distinct on (ltrim(imei, '0'))
         ltrim(imei, '0') as ma_chuan, imei, model, trang_thai, tinh_trang_cuoc,
         khach, ma_khach, loai_khach, coc, trang_thai_coc, ky_cuoi, chua_thu
    from v_telecom_may order by 1, imei
)
select ma.ma_chuan,
       coalesce(m.imei, p.device_code, ma.ma_chuan) as ma,
       coalesce(m.model, p.product_name)   as doi_may,
       p.doc_type, p.reason_type, p.warehouse_name, p.doc_date,
       m.trang_thai       as trang_thai_may,
       tb.ma_chuan is not null                      as co_thue_bao,
       tb.subscription_source_id                    as thue_bao,
       -- Ưu tiên hồ sơ cho thuê, không có thì đọc theo thuê bao. SIM không đi
       -- qua rental_device nên thiếu tầng này là mất hẳn 1.120 mã.
       coalesce(m.tinh_trang_cuoc, tb.tinh_trang_cuoc) as tinh_trang_cuoc,
       coalesce(m.ky_cuoi, tb.ky_cuoi)                 as ky_cuoi,
       m.coc, m.trang_thai_coc,
       coalesce(m.chua_thu, tb.chua_thu)               as chua_thu,
       coalesce(m.khach, tb.khach, x.khach_phieu)      as khach,
       coalesce(m.ma_khach, tb.ma_khach, x.ma_khach_phieu)        as ma_khach,
       coalesce(m.loai_khach, tb.loai_khach, x.loai_khach_phieu)  as loai_khach,
       case when m.khach is not null  then 'hồ sơ cho thuê'
            when tb.khach is not null then 'thuê bao ' || tb.subscription_source_id
            when x.khach_phieu is not null then 'phiếu xuất ' || x.ngay_xuat end as nguon_khach,
       n.state as nha_mang, n.vendor,
       -- Thuê bao trước, không có thì trang khách. Xem đầu file vì sao.
       coalesce(telecom_url('thue_bao', tb.subscription_source_id),
                telecom_url('khach', tb.source_customer_id)) as link_cms,
       case
         when p.reason_type = 'ISSUE_FOR_RETURN_VENDOR'   then 'TRA_NCC'
         when p.doc_type = 'INVENTORY_OUT'                then 'O_KHACH'
         when p.doc_type = 'INVENTORY_IN'                 then 'TRONG_KHO'
         when m.trang_thai in ('RENTING', 'NOT_RETURNED') then 'O_KHACH'
         when m.trang_thai = 'RETURNED'                   then 'TRONG_KHO'
         when n.state is not null                         then 'CHI_NHA_MANG'
         else 'KHONG_RO'
       end as cho_dung,
       -- File chỉ là cột bên cạnh, không phải thước đo.
       a.ma is not null   as co_trong_file,
       a.ket_luan         as file_ket_luan,
       a.vi_tri_so        as file_vi_tri_so,
       a.vi_tri_kiem_kho  as file_kiem_kho,
       a.nguoi_giu        as file_nguoi_giu
  from ma
  left join p  on p.ma_chuan  = ma.ma_chuan
  left join x  on x.ma_chuan  = ma.ma_chuan
  left join nm n on n.ma_chuan = ma.ma_chuan
  left join m  on m.ma_chuan  = ma.ma_chuan
  left join tb on tb.ma_chuan = ma.ma_chuan
  left join stock_audit_row a on a.ma_chuan = ma.ma_chuan;

comment on view v_kho_phan_mem is
  'Hiện trạng từng mã thiết bị theo chứng từ của PHẦN MỀM; file đối chiếu chỉ là cột bên cạnh';







create view v_kho_ma as
with ma as (
  select ma_chuan from v_kho_phan_mem
  union select ma_chuan from stock_audit_row
), loai as (
  -- Sản phẩm trên phiếu kho gần nhất: nguồn phân loại tin cậy nhất.
  select distinct on (ltrim(device_code, '0'))
         ltrim(device_code, '0') as ma_chuan, product_type
    from v_kho_phieu_cuoi
   order by 1, doc_date desc nulls last, device_code
)
select ma.ma_chuan,
       coalesce(p.ma, a.ma)          as ma,
       -- Máy wifi phải đòi về, SIM thì huỷ là xong — hai việc khác nhau nên
       -- phải phân loại được. Ưu tiên sản phẩm ghi trên phiếu kho; không có
       -- phiếu thì suy từ tên sản phẩm, rồi nhóm hàng ở file, cuối cùng là độ
       -- dài mã.
       case
         when l.product_type = 'WIFI_DEVICE'                       then 'MAY_WIFI'
         when l.product_type like '%SIM%'                          then 'SIM'
         when p.doi_may ilike 'Wifi%'                              then 'MAY_WIFI'
         when p.doi_may ilike 'Sim%'                               then 'SIM'
         when a.nhom_hang in ('U20', 'MR1', 'WIMAX')               then 'MAY_WIFI'
         when a.nhom_hang like 'SB%' or a.nhom_hang like 'Datacall%' then 'SIM'
         when length(ma.ma_chuan) = 15                             then 'MAY_WIFI'
         when length(ma.ma_chuan) between 9 and 11                 then 'SIM'
         else 'KHONG_RO'
       end                           as nhom_tb,
       case
         when length(ma.ma_chuan) = 15                   then 'IMEI'
         when length(ma.ma_chuan) between 9 and 11        then 'SO_DIEN_THOAI'
         when length(ma.ma_chuan) >= 18                   then 'ICCID'
         else 'KHAC'
       end                           as loai_ma,
       p.ma_chuan is not null        as pm_co,
       coalesce(p.cho_dung, 'PM_KHONG_CO') as cho_dung,
       p.doi_may, p.doc_type, p.reason_type, p.warehouse_name, p.doc_date,
       p.trang_thai_may, p.co_thue_bao, p.thue_bao,
       p.tinh_trang_cuoc, p.ky_cuoi,
       p.coc, p.trang_thai_coc, p.chua_thu,
       p.khach, p.ma_khach, p.loai_khach, p.nguon_khach,
       p.nha_mang, p.vendor, p.link_cms,
       a.ma is not null              as file_co,
       a.nhom_hang                   as file_nhom_hang,
       a.ket_luan                    as file_ket_luan,
       a.vi_tri_so                   as file_vi_tri_so,
       a.vi_tri_kiem_kho             as file_kiem_kho,
       a.nguoi_giu                   as file_nguoi_giu,
       a.coc                         as file_coc
  from ma
  left join v_kho_phan_mem p on p.ma_chuan = ma.ma_chuan
  left join loai l on l.ma_chuan = ma.ma_chuan
  left join stock_audit_row a on a.ma_chuan = ma.ma_chuan;

comment on column v_kho_ma.loai_ma is
  'Loại định danh suy từ độ dài: IMEI 15 số (máy wifi), SO_DIEN_THOAI 10-11 số (SIM), ICCID 19-20 số (SIM)';

create view v_kho_doi_chieu as
with pm as (
  select distinct on (ltrim(p.device_code, '0'))
         ltrim(p.device_code, '0')     as ma_chuan,
         p.doc_type, p.reason_type, p.warehouse_name, p.doc_date,
         p.product_name, p.subscription_source_id
    from v_kho_phieu_cuoi p
   order by 1, p.doc_date desc nulls last, p.device_code
), xuat as (
  select distinct on (ltrim(x.device_code, '0'))
         ltrim(x.device_code, '0') as ma_chuan,
         coalesce(pt.display_name, 'khách chưa có tên') as khach_phieu,
         x.doc_date as ngay_xuat
    from v_kho_xuat_cuoi x
    left join party pt on pt.id = x.party_id
   where x.party_id is not null
   order by 1, x.doc_date desc nulls last, x.device_code
), nm as (
  select distinct on (ltrim(device_code, '0'))
         ltrim(device_code, '0') as ma_chuan, state, vendor
    from provider_device_snapshot
   where source = 'TELECOM' and device_code is not null
   order by 1, state
), may as (
  select distinct on (ltrim(imei, '0'))
         ltrim(imei, '0') as ma_chuan, imei, model, trang_thai,
         tinh_trang_cuoc, khach, ma_khach, coc as coc_pm, trang_thai_coc
    from v_telecom_may
   order by 1, imei
), so as (
  select ma_chuan, count(*) as so_dong_so,
         string_agg(distinct danh_sach, ' · ') as danh_sach_so
    from stock_audit_book group by ma_chuan
)
select a.ma,
       a.ma_chuan,
       a.nhom_hang,
       a.ket_luan,
       a.vi_tri_so,
       a.vi_tri_kiem_kho,
       a.nguoi_giu,
       a.coc,
       s.so_dong_so,
       s.danh_sach_so,
       m.imei            as pm_imei,
       -- Đời máy: hồ sơ cho thuê trước, không có thì lấy sản phẩm trên phiếu.
       coalesce(m.model, p.product_name) as pm_doi_may,
       m.model is null and p.product_name is not null as doi_may_tu_phieu,
       m.trang_thai      as pm_trang_thai_may,
       m.tinh_trang_cuoc as pm_tinh_trang_cuoc,
       coalesce(m.khach, x.khach_phieu) as pm_khach,
       m.ma_khach        as pm_ma_khach,
       case when m.khach is not null then 'hồ sơ cho thuê'
            when x.khach_phieu is not null then 'phiếu xuất ' || x.ngay_xuat
       end               as nguon_khach,
       p.doc_type        as pm_phieu,
       p.reason_type     as pm_ly_do,
       p.warehouse_name  as pm_kho,
       p.doc_date        as pm_ngay_phieu,
       n.state           as pm_nha_mang,
       n.vendor          as pm_vendor,
       case
         when p.reason_type = 'ISSUE_FOR_RETURN_VENDOR'      then 'TRA_NCC'
         when p.doc_type = 'INVENTORY_OUT'                   then 'O_KHACH'
         when p.doc_type = 'INVENTORY_IN'                    then 'TRONG_KHO'
         when m.trang_thai in ('RENTING', 'NOT_RETURNED')    then 'O_KHACH'
         when m.trang_thai = 'RETURNED'                      then 'TRONG_KHO'
         when n.state is not null                            then 'CHI_NHA_MANG'
         else 'PM_KHONG_BIET'
       end as pm_ket_luan
  from stock_audit_row a
  left join pm   p on p.ma_chuan = a.ma_chuan
  left join xuat x on x.ma_chuan = a.ma_chuan
  left join nm   n on n.ma_chuan = a.ma_chuan
  left join may  m on m.ma_chuan = a.ma_chuan
  left join so   s on s.ma_chuan = a.ma_chuan;

create view v_kho_thieu_o_file as
select p.device_code, p.doc_type, p.reason_type, p.warehouse_name, p.doc_date,
       coalesce(m.model, p.product_name) as model,
       m.trang_thai, m.tinh_trang_cuoc, m.khach
  from v_kho_phieu_cuoi p
  left join v_telecom_may m on ltrim(m.imei, '0') = ltrim(p.device_code, '0')
 where not exists (
   select 1 from stock_audit_row a where a.ma_chuan = ltrim(p.device_code, '0'));
