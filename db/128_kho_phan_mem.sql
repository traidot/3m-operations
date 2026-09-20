-- Hiện trạng kho theo PHẦN MỀM, không lệ thuộc file đối chiếu.
--
-- v_kho_doi_chieu lấy file làm gốc: mỗi dòng là một mã trong file, phần mềm chỉ
-- là cột phụ. Đọc như vậy thành ra mặc định file đúng — mà file là bản tổng hợp
-- làm tay ở ngoài, chưa ai chứng minh nó đúng.
--
-- View này đảo lại: mỗi dòng là một mã PHẦN MỀM biết, trạng thái đọc từ chứng
-- từ của chính phần mềm, còn file chỉ là một cột bên cạnh. Hai view dùng cùng
-- một luật suy trạng thái nên số hai bên so được với nhau.

create or replace view v_kho_phan_mem as
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
       m.tinh_trang_cuoc,
       m.ky_cuoi,
       m.coc, m.trang_thai_coc, m.chua_thu,
       coalesce(m.khach, x.khach_phieu) as khach,
       m.ma_khach, m.loai_khach,
       case when m.khach is not null then 'hồ sơ cho thuê'
            when x.khach_phieu is not null then 'phiếu xuất ' || x.ngay_xuat end as nguon_khach,
       n.state as nha_mang, n.vendor,
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
  left join stock_audit_row a on a.ma_chuan = ma.ma_chuan;

comment on view v_kho_phan_mem is
  'Hiện trạng từng mã thiết bị theo chứng từ của PHẦN MỀM; file đối chiếu chỉ là cột bên cạnh';
