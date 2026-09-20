-- Ghi lại từng lần nhập file đối chiếu. Không có cột này thì nhìn con số trên
-- màn hình không biết nó là bản kiểm kho hôm nào — mà bản đối chiếu kho thì chỉ
-- đúng tại thời điểm chốt, để lâu là sai.
--
-- Giữ lịch sử các lần nhập dù mỗi lần nhập đều thay hẳn dữ liệu dòng: biết lần
-- trước nhập hôm nào, file tên gì, ra bao nhiêu mã là đủ để đối chiếu lại.

create table if not exists stock_audit_import (
  id          bigserial primary key,
  ten_file    text not null,
  sua_luc     timestamptz,     -- ngày sửa của chính file, thường là ngày chốt số
  nhap_luc    timestamptz not null default now(),
  so_ma       int not null,
  so_dong_so  int not null,
  so_ma_trung int not null default 0,
  dang_dung   boolean not null default true
);

comment on column stock_audit_import.sua_luc is
  'Ngày sửa file .xlsx — gần với ngày chốt số hơn là ngày bấm nhập';
comment on column stock_audit_import.dang_dung is
  'Đúng một dòng true: lần nhập đang nằm trong stock_audit_row';

alter table stock_audit_row
  add column if not exists import_id bigint references stock_audit_import(id);
alter table stock_audit_book
  add column if not exists import_id bigint references stock_audit_import(id);

/** Lần nhập đang dùng, cho màn hình ghi rõ số này là của bản kiểm kho nào. */
create or replace view v_kho_lan_nhap as
select id, ten_file, sua_luc, nhap_luc, so_ma, so_dong_so, so_ma_trung
  from stock_audit_import
 where dang_dung
 order by nhap_luc desc
 limit 1;
