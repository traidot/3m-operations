-- Hệ telecom có khách hàng thật, khác hệ wifi cố định. Hoá đơn và khoản thu
-- phải nối được về party, mà hai bảng đó chỉ có party_id chứ không giữ mã
-- khách bên nguồn — không có mã thì lúc đồng bộ không biết nối vào đâu.

alter table invoice_snapshot add column if not exists source_customer_id text;
alter table payment_snapshot add column if not exists source_customer_id text;

create index if not exists inv_src_customer on invoice_snapshot (source, source_customer_id);
create index if not exists pay_src_customer on payment_snapshot (source, source_customer_id);
