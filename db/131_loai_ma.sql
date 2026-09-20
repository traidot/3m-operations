-- Mã thiết bị không cùng một loại định danh. Nhìn một cột số mà tưởng đồng nhất
-- là nguồn của mọi lỗi đối chiếu.
--
-- Bên nguồn, `deviceCode` chứa ba thứ khác nhau tuỳ loại hàng:
--   máy wifi        IMEI 15 số                       5.186 mã
--   SIM Softbank    số điện thoại 10 số, KHÔNG số 0 đầu   (7031593777…)
--   SIM Datacall    số điện thoại 11 số, CÓ số 0 đầu      (07010449138…)
--   một ít SIM      ICCID 19–20 số                      19 mã
-- Máy wifi còn có số điện thoại riêng ở `device_info.msn` (111 mã) — KHÔNG dùng
-- để đối chiếu; đã kiểm, không mã nào trong file trùng với msn nên không lẫn.
--
-- Bản đối chiếu làm tay thì viết SIM luôn 10 số không có số 0 đầu. Vì vậy phải
-- `ltrim(mã,'0')` cả hai phía. Đã kiểm hai điều trước khi tin cách này:
--   • không mã nào có từ hai số 0 đầu trở lên, nên ltrim không cắt quá tay
--   • 8 nhóm bị gộp đều đúng là một số viết hai kiểu (07048168025 ↔ 7048168025)
--
-- Hai chỗ vẫn hở, cột này chỉ làm nó lộ ra chứ không vá được:
--   • 4 mã trong file là ICCID 19 số trong khi phần mềm gọi SIM đó bằng số điện
--     thoại — không có bảng nào nối hai định danh nên không bao giờ khớp
--   • nguồn tự hỏng một ICCID: file ghi 8981200724307099648, nguồn ghi
--     8981200724307100000, năm số cuối thành 0 — dấu hiệu đi qua số thực. Và
--     nguồn còn 88981030000067947629 hai mươi số, gần như chắc gõ thừa số 8.

-- Chèn cột vào giữa nên phải drop.
drop view if exists v_kho_ma;

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
       p.trang_thai_may, p.tinh_trang_cuoc, p.ky_cuoi,
       p.coc, p.trang_thai_coc, p.chua_thu,
       p.khach, p.ma_khach, p.loai_khach, p.nguon_khach,
       p.nha_mang, p.vendor,
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
