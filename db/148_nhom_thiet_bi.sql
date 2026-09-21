-- Phân loại thiết bị: máy wifi hay SIM.
--
-- Việc phải làm khác hẳn nhau. Máy wifi ở khách mà dịch vụ dừng thì PHẢI ĐÒI VỀ
-- — nó là tài sản, có cọc. SIM thì huỷ ở nhà mạng là xong, không ai đi đòi cái
-- sim về. Nên mọi con số về thu hồi mà không tách hai loại này là đọc sai.
--
-- Nguồn phân loại, theo thứ tự tin cậy:
--   1. product_type trên phiếu kho   phủ 5.698 mã
--   2. tên sản phẩm ("Wifi…" / "Sim…")
--   3. nhóm hàng ở file              U20/MR1/WIMAX là máy, SB/Datacall là sim
--   4. độ dài mã                     15 số là IMEI nên là máy, 10-11 số là sim

drop view if exists v_kho_ma;

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
