-- Sao kê ngân hàng của wifi cố định, nhập từ file Excel bên ngoài.
--
-- Đối chiếu bằng cách mở file Excel mỗi lần thì chậm và không lặp lại được. Đưa
-- vào kho để so với `v_fixed_dot_thu` bằng SQL.
--
-- Ba trang của file là ba tài khoản, mỗi trang một lược đồ khác nhau — phần đọc
-- nằm ở agent, ở đây chỉ giữ kết quả đã chuẩn hoá.
--
-- Hai chỗ dễ đọc sai, đã tách thành cột riêng:
--   - `noi_bo`: trang Yucho Arai có giao dịch 振込 từ ｶ)ｼ-ｷﾔｽﾄ mang mã "3M" —
--     tiền công ty tự chuyển, KHÔNG phải khách trả. Tháng 6/2026 là 2.668.000
--     trên tổng 2.813.000, bỏ qua cột này là đọc sai gấp gần hai mươi lần.
--   - `ma_hd`: chỉ có ở phần giao dịch kế toán đã dò được; để trống là chưa dò.

create table if not exists bank_import (
  id        bigserial primary key,
  ten_file  text not null,
  sua_luc   timestamptz,          -- ngày sửa của chính file, gần với ngày chốt số
  nhap_luc  timestamptz not null default now(),
  so_dong   int not null,
  dang_dung boolean not null default true
);

comment on column bank_import.dang_dung is
  'Đúng một dòng true: lần nhập đang nằm trong bank_row';

create table if not exists bank_row (
  id         bigserial primary key,
  import_id  bigint not null references bank_import(id) on delete cascade,
  tai_khoan  text not null,        -- đã ánh xạ về đúng tên tài khoản bên CMS
  trang      text not null,        -- tên sheet gốc, để truy ngược
  dong       int  not null,        -- số dòng trong sheet gốc
  ngay       date,
  thang      text,                 -- YYYY-MM, tính sẵn để gom nhanh
  tien_vao   numeric not null default 0,
  ma_hd      text,
  ten_gd     text,                 -- tên người chuyển trên sao kê
  loai_gd    text,                 -- 送金 / 振込 / ことら / combini …
  noi_bo     boolean not null default false
);

create index if not exists bank_row_thang_tk on bank_row (thang, tai_khoan);
create index if not exists bank_row_ma_hd on bank_row (ma_hd);

/** Tiền về theo tháng và tài khoản, đặt cạnh số của phần mềm. */
create or replace view v_sao_ke_thang as
with sk as (
  select r.thang, r.tai_khoan,
         count(*)                                        as so_gd,
         sum(r.tien_vao)                                 as tien_tho,
         sum(r.tien_vao) filter (where r.noi_bo)         as noi_bo,
         sum(r.tien_vao) filter (where not r.noi_bo)     as tien_khach,
         count(*) filter (where r.ma_hd is not null)     as gd_co_ma
    from bank_row r
    join bank_import i on i.id = r.import_id and i.dang_dung
   where r.thang is not null
   group by 1, 2
), pm as (
  select thang_tien_ve as thang, tai_khoan,
         count(*) as so_dot, sum(so_tien) as tien
    from v_fixed_dot_thu
   group by 1, 2
)
select coalesce(sk.thang, pm.thang)         as thang,
       coalesce(sk.tai_khoan, pm.tai_khoan) as tai_khoan,
       coalesce(sk.so_gd, 0)                as so_gd,
       coalesce(sk.tien_tho, 0)             as tien_tho,
       coalesce(sk.noi_bo, 0)               as noi_bo,
       coalesce(sk.tien_khach, 0)           as tien_khach,
       coalesce(sk.gd_co_ma, 0)             as gd_co_ma,
       coalesce(pm.so_dot, 0)               as so_dot_pm,
       coalesce(pm.tien, 0)                 as tien_pm,
       coalesce(sk.tien_khach, 0) - coalesce(pm.tien, 0) as chenh,
       sk.thang is null                     as chi_phan_mem,
       pm.thang is null                     as chi_sao_ke
  from sk
  full join pm on pm.thang = sk.thang and pm.tai_khoan = sk.tai_khoan;
