-- Loại khách cũng đọc được từ phiếu xuất.
--
-- Ngăn kéo đang hiện "Đại lý Tuấn BĐS" ở cột khách rồi ngay dưới ghi "chưa
-- phân loại" — đọc ra vô lý. Lý do: tên khách đã có ba nguồn (hồ sơ cho thuê →
-- thuê bao → phiếu xuất) nhưng loại khách mới chỉ lấy từ hai nguồn đầu.
--
-- Phiếu xuất có party_id, nối sang party_source là ra loại. Bù được 631 mã.

drop view if exists v_kho_ma;
drop view if exists v_kho_phan_mem;

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
