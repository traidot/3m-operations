-- Một bảng cho MỌI mã thiết bị, hai phía đặt cạnh nhau.
--
-- Trước đây có hai view lệch gốc quy chiếu: v_kho_doi_chieu đi từ file (6.852
-- mã), v_kho_phan_mem đi từ phần mềm (5.744 mã). Nhìn bảng nào cũng thấy thiếu
-- một mảng, và mọi con số đếm được ở màn hình tổng quan lại không bấm sang được
-- danh sách vì hai bên khác tập.
--
-- Gộp thành hợp của hai phía: 8.272 mã. Mỗi dòng nói rõ phần mềm biết gì và
-- file nói gì, không bên nào là thước đo của bên nào — file là bản tổng hợp làm
-- tay ở ngoài, chưa ai chứng minh nó đúng.

create or replace view v_kho_ma as
with ma as (
  select ma_chuan from v_kho_phan_mem
  union select ma_chuan from stock_audit_row
)
select ma.ma_chuan,
       coalesce(p.ma, a.ma)          as ma,
       -- Phía phần mềm
       p.ma_chuan is not null        as pm_co,
       coalesce(p.cho_dung, 'PM_KHONG_CO') as cho_dung,
       p.doi_may, p.doc_type, p.reason_type, p.warehouse_name, p.doc_date,
       p.trang_thai_may, p.tinh_trang_cuoc, p.ky_cuoi,
       p.coc, p.trang_thai_coc, p.chua_thu,
       p.khach, p.ma_khach, p.loai_khach, p.nguon_khach,
       p.nha_mang, p.vendor,
       -- Phía file
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

comment on view v_kho_ma is
  'Hợp của mọi mã thiết bị hai phía biết: phần mềm và bản đối chiếu làm tay, không bên nào làm chuẩn';
