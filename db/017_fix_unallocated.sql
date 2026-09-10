-- Cùng lỗi với v_missing_invoice: quy tắc giả định nguồn nào cũng có hoá đơn.
-- Nhánh wifi cố định không có, nên cả 2.357 khoản thu đều bị coi là "chưa cấn"
-- và gộp thành một phán quyết vô nghĩa trị giá 4.467.053.
create or replace view v_payment_unallocated as
select p.source, p.source_id, p.party_id, p.amount, p.channel, p.paid_at
from payment_snapshot p
where p.invoice_source_id is null
  and exists (select 1 from invoice_snapshot i where i.source = p.source);
