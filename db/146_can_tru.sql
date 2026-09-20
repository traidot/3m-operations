-- Cấn trừ là quan hệ NHIỀU-NHIỀU, không nhét vừa một cột.
--
-- `payment_snapshot.invoice_source_id` chỉ giữ được MỘT hoá đơn cho mỗi lượt
-- thu, trong khi 1.800 lượt thu bên nguồn cấn vào từ hai hoá đơn trở lên. Chọn
-- một cái là mất phần còn lại, và trước đây còn chọn nhầm sang hoá đơn đã xoá.
--
-- Bảng riêng giữ đủ: 31.272 dòng cấn trừ, trong đó 2.726 dòng đã xoá ở nguồn.

create table if not exists payment_reconcile_snapshot (
  source             source_system not null,
  source_id          text not null,
  -- 13 dòng cấn trừ không có lượt thu: ghi giảm cho hoá đơn mà không kèm tiền
  -- vào. Giữ lại chứ không lọc, vì chúng vẫn làm thay đổi số nợ của hoá đơn.
  payment_source_id  text,
  invoice_source_id  text,
  amount             numeric(14,2),
  created_at_src     timestamptz,
  created_by_src     text,
  synced_at          timestamptz not null default now(),
  primary key (source, source_id)
);
create index if not exists can_tru_payment on payment_reconcile_snapshot (source, payment_source_id);
create index if not exists can_tru_invoice on payment_reconcile_snapshot (source, invoice_source_id);

comment on table payment_reconcile_snapshot is
  'Cấn trừ lượt thu với hoá đơn — quan hệ nhiều-nhiều, giữ đủ mọi dòng';

/** Lượt thu chưa gán được vào hoá đơn nào: tiền đã vào mà chưa biết của kỳ nào. */
create or replace view v_telecom_thu_chua_can_tru as
select p.source_id                        as payment_id,
       p.party_id,
       p.amount,
       p.channel,
       p.reference,
       p.paid_at,
       -- Kho chỉ giữ dòng cấn trừ CÒN HIỆU LỰC nên không phân biệt được "chưa
       -- cấn trừ bao giờ" với "cấn trừ rồi lại huỷ". Đếm thẳng bên nguồn thì
       -- 1.033 lượt chưa cấn trừ lần nào và 213 lượt đã huỷ hết cấn trừ.
       case
         when exists (select 1 from payment_reconcile_snapshot r
                       where r.source = 'TELECOM' and r.payment_source_id = p.source_id)
           then 'cấn trừ còn hiệu lực nhưng hoá đơn đã xoá'
         else 'không có cấn trừ nào còn hiệu lực'
       end                                as ly_do
  from payment_snapshot p
 where p.source = 'TELECOM'
   and not exists (
     select 1 from payment_reconcile_snapshot r
       join invoice_snapshot i on i.source = 'TELECOM' and i.source_id = r.invoice_source_id
      where r.source = 'TELECOM' and r.payment_source_id = p.source_id);

comment on view v_telecom_thu_chua_can_tru is
  'Lượt thu cầm tay chưa nối được vào hoá đơn nào còn sống';
