-- So bản đối chiếu làm tay với những gì phần mềm đang ghi.
--
-- Cố ý KHÔNG tự chấm "khớp / không khớp". Hai bên đang trả lời hai câu hỏi hơi
-- khác nhau — file hỏi "mã này nằm ở đâu theo sổ và theo lần kiểm kho 15/09",
-- phần mềm trả lời "phiếu kho gần nhất của mã này là phiếu gì" — nên tự đặt ra
-- luật khớp thì chỉ là mình tự chấm bài mình. Ở đây dựng hai cột kết luận song
-- song, còn chỗ nào lệch thì để người đọc bảng chéo tự thấy.
--
-- Phiếu kho gần nhất mới quyết định máy đang ở đâu: một mã đi qua nhiều phiếu
-- (xuất cho khách → nhận về → xuất cho khách khác), 13.327 dòng phiếu trên
-- 5.706 mã.

create or replace view v_kho_phieu_cuoi as
select distinct on (device_code)
       device_code,
       doc_type, business_type, reason_type,
       warehouse_name, doc_date, doc_code,
       subscription_source_id, party_id, vendor_name
  from stock_move_snapshot
 where source = 'TELECOM' and device_code is not null
 order by device_code, doc_date desc nulls last, source_id desc;

comment on view v_kho_phieu_cuoi is
  'Phiếu nhập/xuất gần nhất của từng mã thiết bị — quyết định máy đang ở đâu';

drop view if exists v_kho_doi_chieu;

create view v_kho_doi_chieu as
with pm as (
  -- Gom theo mã đã bỏ số 0 đầu để nối được với file. Phải distinct lần nữa chứ
  -- không mượn được v_kho_phieu_cuoi: nguồn ghi cùng một SIM dưới hai cách viết
  -- ('07036…' và '7036…'), bỏ số 0 xong thì trùng và mã đó nhân đôi dòng.
  select distinct on (ltrim(p.device_code, '0'))
         ltrim(p.device_code, '0')     as ma_chuan,
         p.doc_type, p.reason_type, p.warehouse_name, p.doc_date,
         p.subscription_source_id
    from v_kho_phieu_cuoi p
   order by 1, p.doc_date desc nulls last, p.device_code
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
       -- Phía phần mềm
       m.imei            as pm_imei,
       m.model           as pm_doi_may,
       m.trang_thai      as pm_trang_thai_may,
       m.tinh_trang_cuoc as pm_tinh_trang_cuoc,
       m.khach           as pm_khach,
       m.ma_khach        as pm_ma_khach,
       p.doc_type        as pm_phieu,
       p.reason_type     as pm_ly_do,
       p.warehouse_name  as pm_kho,
       p.doc_date        as pm_ngay_phieu,
       n.state           as pm_nha_mang,
       n.vendor          as pm_vendor,
       -- Kết luận của phần mềm, đọc từ phiếu kho gần nhất. Hồ sơ cho thuê chỉ
       -- dùng để bù khi mã không có phiếu nào.
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
  left join pm  p on p.ma_chuan = a.ma_chuan
  left join nm  n on n.ma_chuan = a.ma_chuan
  left join may m on m.ma_chuan = a.ma_chuan
  left join so  s on s.ma_chuan = a.ma_chuan;

comment on view v_kho_doi_chieu is
  'Từng mã ở bản đối chiếu làm tay, đặt cạnh những gì phần mềm đang ghi';

/** Mã phần mềm có mà bản đối chiếu không nhắc tới. */
create or replace view v_kho_thieu_o_file as
select p.device_code, p.doc_type, p.reason_type, p.warehouse_name, p.doc_date,
       m.model, m.trang_thai, m.tinh_trang_cuoc, m.khach
  from v_kho_phieu_cuoi p
  left join v_telecom_may m on ltrim(m.imei, '0') = ltrim(p.device_code, '0')
 where not exists (
   select 1 from stock_audit_row a where a.ma_chuan = ltrim(p.device_code, '0'));
