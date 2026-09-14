-- Hoá đơn của đơn hàng cũng là chứng cứ đã thu tiền cho thuê bao.
--
-- Gói SIM năm và các gói trả trước được thu MỘT LẦN qua đơn hàng: hoá đơn mang
-- invoiceType='ORDER', orderId trỏ về đơn, còn subscriptionId để trống. Quy tắc
-- THIEU_HOA_DON chỉ tìm hoá đơn có subscriptionId nên thấy số 0 và kêu "đang
-- chạy mà không có hoá đơn" — 446 thuê bao bị báo oan, chỉ 13 cái là thật.
--
-- Kéo orderId về để nối được. 3.854/3.893 đơn hàng sinh đúng một thuê bao nên
-- quan hệ gần như một-một, nhưng 39 đơn sinh nhiều thuê bao, nên liên kết này
-- CHỈ dùng để trả lời "có chứng cứ thu tiền không", KHÔNG dùng để cộng tiền —
-- cộng thì một hoá đơn bị đếm nhiều lần cho nhiều thuê bao.

alter table invoice_snapshot   add column if not exists order_id text;
alter table subscription_snapshot add column if not exists order_ref text;

comment on column invoice_snapshot.order_id is
  'Đơn hàng bên nguồn; hoá đơn loại ORDER gắn vào đây thay vì vào thuê bao';
comment on column subscription_snapshot.order_ref is
  'Đơn hàng sinh ra thuê bao này, để nối với hoá đơn loại ORDER';

create index if not exists invoice_don_hang on invoice_snapshot (source, order_id)
  where order_id is not null;
create index if not exists subscription_don_hang on subscription_snapshot (source, order_ref)
  where order_ref is not null;
