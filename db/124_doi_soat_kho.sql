-- Bản đối chiếu kho làm tay bên ngoài (file Excel "Doi_soat_TONG_va_CHI_TIET
-- theo muc"). Nhập vào đây để so thẳng với phần mềm thay vì so bằng mắt.
--
-- Hai bảng vì file có hai phía:
--   stock_audit_row  — 6.855 mã NHẬP VỀ theo file của nhà cung cấp, mỗi mã một
--                      dòng, kèm kết luận người làm file đã chốt.
--   stock_audit_book — "sổ quản lý" (Google Sheets), 3.443 dòng. Một mã có thể
--                      nằm ở nhiều danh sách nên không khoá theo mã.
--
-- `ma_chuan` = mã đã bỏ số 0 đầu. Bắt buộc phải có cột này: kho phần mềm có 68
-- mã SIM bắt đầu bằng 0 còn file thì không mã nào, nối thẳng theo `ma` thì
-- Datacall vật lý khớp 0/332 thay vì 68 — đủ để kết luận nhầm là phần mềm
-- không quản lý loại hàng đó.

create table if not exists stock_audit_row (
  ma                 text primary key,
  ma_chuan           text not null,
  nhom_hang          text,
  ghi_chu_nhap       text,
  ket_luan           text,
  vi_tri_so          text,
  ds_chua            text,
  khach_theo_so      text,
  vi_tri_kiem_kho    text,
  nguoi_giu          text,
  trang_thai_sim     text,
  ngay_thue_gan_nhat date,
  coc                numeric(14,2),
  tt_thu_hoi         text,
  tt_hoan_coc        text,
  nhap_luc           timestamptz not null default now()
);
create index if not exists audit_row_chuan on stock_audit_row (ma_chuan);

create table if not exists stock_audit_book (
  id        bigserial primary key,
  danh_sach text,
  dong_goc  int,
  ma        text not null,
  ma_chuan  text not null,
  san_pham  text,
  khach     text,
  trang_thai text,
  nhom_cot  text,
  nhap_luc  timestamptz not null default now()
);
create index if not exists audit_book_chuan on stock_audit_book (ma_chuan);

comment on table stock_audit_row is
  'Bản đối chiếu kho làm tay ngoài phần mềm — một dòng một mã nhập về';
comment on column stock_audit_row.ma_chuan is
  'Mã đã bỏ số 0 đầu; chỉ dùng cột này để nối sang dữ liệu phần mềm';
