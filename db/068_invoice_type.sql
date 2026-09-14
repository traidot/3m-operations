-- Loại hoá đơn bên nguồn, và tách hoàn tiền ra khỏi công nợ.
--
-- invoiceType bên nguồn có bốn giá trị:
--   SUBSCRIPTION  cước hàng tháng, luôn gắn thuê bao      23.708
--   ORDER         hoá đơn của một đơn hàng, gắn orderId    3.295
--   OTHER         khoản thu khác                             592
--   REFUND        hoàn tiền cho khách khi đổi thiết bị        12
--
-- REFUND mang SỐ ÂM — ghi chú đều là "Phiếu đổi thiết bị: DTB…". Đó là khoản
-- 3M NỢ KHÁCH, nhưng trạng thái vẫn UNPAID nên kho đang cộng nó vào công nợ
-- như một khoản phải đòi. Hậu quả: 11 khách hiện nợ âm, tổng −26.500 yên, và
-- 28.500 yên hoàn tiền đang trừ ngược vào con số nợ toàn hệ thống.

alter table invoice_snapshot add column if not exists invoice_type text;

comment on column invoice_snapshot.invoice_type is
  'SUBSCRIPTION cước tháng | ORDER đơn hàng | OTHER thu khác | REFUND hoàn tiền (số âm)';

create index if not exists invoice_loai on invoice_snapshot (source, invoice_type);
