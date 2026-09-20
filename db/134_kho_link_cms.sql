-- Nút mở sang CMS cho từng mã thiết bị.
--
-- Chọn màn hình THUÊ BAO làm đích chính vì đó là trang duy nhất gom đủ thứ cần
-- đối chiếu trên một chỗ: trạng thái dịch vụ, trạng thái nhà mạng, khách, mã
-- thiết bị, gói cước. Mã nào không có thuê bao thì rơi về trang khách.
--
-- Không làm link sang phiếu kho: chưa biết dạng URL của màn hình lịch sử
-- nhập/xuất kho bên CMS, đoán bừa thì ra trang lỗi, tệ hơn là không có nút.

-- Chèn cột vào giữa nên phải drop cả chuỗi view phía trên.
drop view if exists v_kho_ma;
drop view if exists v_kho_phan_mem;
drop view if exists v_tb_ma;

create view v_tb_ma as
with gan as (
  select distinct on (ltrim(sd.imei, '0'))
         ltrim(sd.imei, '0') as ma_chuan, sd.subscription_source_id
    from subscription_device_snapshot sd
   where sd.source = 'TELECOM' and sd.imei is not null
   order by 1, sd.started_on desc nulls last, sd.source_id desc
), cuoc as (
  select ma_chuan, max(ky) as ky_cuoi, count(*) as so_ky,
         round(sum(tien) filter (where trang_thai_hd = 'ISSUED')) as chua_thu
    from v_tb_ma_ky group by ma_chuan
)
select g.ma_chuan,
       g.subscription_source_id,
       s.status        as trang_thai_tb,
       s.plan_name     as goi,
       s.monthly_price as gia_thang,
       c.ky_cuoi,
       coalesce(c.chua_thu, 0) as chua_thu,
       coalesce(p.display_name, 'khách chưa có tên') as khach,
       ps.customer_code as ma_khach,
       ps.customer_type as loai_khach,
       ps.source_customer_id,
       case
         when s.status is null                              then 'TB_DA_XOA'
         when s.status <> 'ACTIVE'                          then 'HUY_CHUA_THU_MAY'
         when c.ky_cuoi >= to_char(CURRENT_DATE, 'YYYY-MM') then 'DANG_RA_CUOC'
         else 'HUT_CUOC'
       end as tinh_trang_cuoc
  from gan g
  left join cuoc c on c.ma_chuan = g.ma_chuan
  left join subscription_snapshot s
    on s.source = 'TELECOM' and s.source_id = g.subscription_source_id
  left join party_source ps
    on ps.source = 'TELECOM' and ps.source_customer_id = s.source_customer_id
   and ps.status <> 'REJECTED'
  left join party p on p.id = ps.party_id;


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
  select distinct on (ltrim(x.device_code, '0'))
         ltrim(x.device_code, '0') as ma_chuan,
         coalesce(pt.display_name, 'khách chưa có tên') as khach_phieu, x.doc_date as ngay_xuat
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
       coalesce(m.ma_khach, tb.ma_khach)               as ma_khach,
       coalesce(m.loai_khach, tb.loai_khach)           as loai_khach,
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
)
select ma.ma_chuan,
       coalesce(p.ma, a.ma)          as ma,
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
  left join stock_audit_row a on a.ma_chuan = ma.ma_chuan;

comment on column v_kho_ma.loai_ma is
  'Loại định danh suy từ độ dài: IMEI 15 số (máy wifi), SO_DIEN_THOAI 10-11 số (SIM), ICCID 19-20 số (SIM)';
