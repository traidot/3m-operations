-- Biên bản kiểm kê SIM/cục wifi của bên telecom, nhập từ file Excel có chữ ký.
--
-- File chốt ngày, kế toán và kho ký vào từng cột, nên nó là bản ghi cứng về
-- "ngày đó máy nào đang ở trạng thái nào". Giữ trong kho để đối chiếu với
-- v_telecom_may thay vì mở file mỗi lần.
--
-- Trang Tổng hợp nhập tay chứ không cộng từ trang chi tiết, nên nó tự khép
-- kín kể cả khi bỏ sót — lần này 148 mã U3 nằm trong trang chi tiết mà không
-- vào ô nào. Vì vậy chỉ nhập TRANG CHI TIẾT, còn số của trang Tổng hợp giữ
-- riêng ở bảng `kiem_ke_tong_hop` để soi chính cái lệch đó.

create table if not exists kiem_ke_import (
  id        bigserial primary key,
  ten_file  text not null,
  chot_ngay date,                    -- ngày ghi trên tiêu đề bảng
  sua_luc   timestamptz,
  nhap_luc  timestamptz not null default now(),
  so_dong   int not null,
  dang_dung boolean not null default true
);

comment on column kiem_ke_import.dang_dung is
  'Đúng một dòng true: lần kiểm kê đang nằm trong kiem_ke_may';

create table if not exists kiem_ke_may (
  id          bigserial primary key,
  import_id   bigint not null references kiem_ke_import(id) on delete cascade,
  trang       text not null,         -- tên sheet gốc, để truy ngược
  dong        int  not null,
  trang_thai  text not null,         -- nhãn gọn của cột E..I
  nhom        text,                  -- U20 / MR1 / SB 100GB …
  san_pham    text,
  ma          text not null,         -- IMEI hoặc số sim
  ma_kh       text,
  khach       text,
  ma_dvkh     text,
  ma_don      text,
  nhom_khach  text,                  -- riêng trang cần thu hồi
  phu_trach   text,                  -- riêng trang chờ cố định
  dai_ly      text
);

create index if not exists kiem_ke_may_ma on kiem_ke_may (ma);
create index if not exists kiem_ke_may_tt on kiem_ke_may (import_id, trang_thai);

/** Số của trang Tổng hợp, giữ nguyên như người ta gõ để đối chiếu. */
create table if not exists kiem_ke_tong_hop (
  import_id  bigint not null references kiem_ke_import(id) on delete cascade,
  nhom       text not null,
  cot        text not null,          -- khach_le_ctv / dai_ly / cho_co_dinh / cho_kich_hoat / can_thu_hoi / tong
  so_luong   int  not null,
  primary key (import_id, nhom, cot)
);

/** Trang chi tiết đếm được bao nhiêu, trang Tổng hợp ghi bao nhiêu, lệch đâu. */
create or replace view v_kiem_ke_lech as
with chi_tiet as (
  select m.trang_thai as cot, m.nhom, count(*) as thuc_te
    from kiem_ke_may m
    join kiem_ke_import i on i.id = m.import_id and i.dang_dung
   group by 1, 2
), ghi as (
  select t.cot, t.nhom, t.so_luong
    from kiem_ke_tong_hop t
    join kiem_ke_import i on i.id = t.import_id and i.dang_dung
   where t.cot <> 'tong'
)
select coalesce(c.cot, g.cot)   as cot,
       coalesce(c.nhom, g.nhom) as nhom,
       coalesce(c.thuc_te, 0)   as thuc_te,
       coalesce(g.so_luong, 0)  as ghi_o_tong_hop,
       coalesce(c.thuc_te, 0) - coalesce(g.so_luong, 0) as lech
  from chi_tiet c
  full join ghi g on g.cot = c.cot and g.nhom = c.nhom;
