-- Bù hai chỗ trống lớn nhất của bảng đối chiếu: đời máy và khách hàng.
--
-- Trước migration này, đời máy và khách chỉ lấy được từ `v_telecom_may`, tức là
-- từ hồ sơ CHO THUÊ. Máy chưa từng cho thuê thì không có hồ sơ nào — mà đó lại
-- là 1.736 trong 1.910 mã đang nằm trong kho. Kết quả: kho đầy máy mà không
-- biết máy gì.
--
-- Dòng phiếu kho có sẵn `productId`, và phiếu xuất có sẵn khách. Lấy hai cái đó
-- làm nguồn bù:
--   đời máy — ưu tiên hồ sơ cho thuê, không có thì lấy sản phẩm trên phiếu
--   khách   — ưu tiên hồ sơ cho thuê, không có thì lấy khách trên phiếu XUẤT
--             gần nhất (5.117/6.531 dòng phiếu xuất có ghi khách)
--
-- Vẫn ghi rõ số liệu lấy từ đâu ở cột `nguon_khach`: khách trên phiếu xuất là
-- người nhận hàng lúc giao, không chắc còn là người đang giữ máy hôm nay.

-- Sản phẩm ghi ngay trên dòng phiếu — cột này 123 chưa lấy.
alter table stock_move_snapshot
  add column if not exists product_name text,
  add column if not exists product_type text;

comment on column stock_move_snapshot.product_name is
  'Sản phẩm ghi trên dòng phiếu — nguồn DUY NHẤT biết đời máy của máy chưa từng cho thuê';

-- Chèn cột vào giữa nên phải drop; v_kho_doi_chieu đang phụ thuộc nên drop nó
-- trước rồi dựng lại ở dưới.
drop view if exists v_kho_doi_chieu;
drop view if exists v_kho_thieu_o_file;
drop view if exists v_kho_phieu_cuoi;

create view v_kho_phieu_cuoi as
select distinct on (device_code)
       device_code,
       doc_type, business_type, reason_type,
       product_name, product_type,
       warehouse_name, doc_date, doc_code,
       subscription_source_id, party_id, vendor_name
  from stock_move_snapshot
 where source = 'TELECOM' and device_code is not null
 order by device_code, doc_date desc nulls last, source_id desc;

/** Phiếu XUẤT gần nhất — nơi duy nhất biết máy đi tới tay ai. */
create view v_kho_xuat_cuoi as
select distinct on (device_code)
       device_code, party_id, subscription_source_id, doc_date, product_name
  from stock_move_snapshot
 where source = 'TELECOM' and device_code is not null and doc_type = 'INVENTORY_OUT'
 order by device_code, doc_date desc nulls last, source_id desc;

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
