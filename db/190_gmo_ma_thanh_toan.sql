-- Mã thanh toán combini qua GMO.
--
-- Luồng: nhân viên tạo mã → khách cầm mã ra combini trả → GMO báo về → CMS
-- sinh phiếu cọc PENDING → người phân bổ vào từng tháng cước. Kho mới có từ
-- khúc phiếu cọc trở đi, nên không thấy hai chỗ rò rỉ ở đầu luồng:
--   · mã hết hạn mà khách không ra trả — tạo rồi coi như xong, không ai biết,
--   · mã đang chờ, tức tiền đã hẹn nhưng chưa về.
--
-- Mỗi lần bấm "Tạo mã thanh toán" sinh BỐN dòng, mỗi chuỗi combini một dòng,
-- cùng số tiền và cùng batch_id. Khách chỉ trả ở một chỗ nên chỉ một dòng
-- thành PAYSUCCESS. Cộng thẳng cột tiền của bảng này là nhân bốn số thật —
-- luôn gộp theo batch trước (xem v_fixed_gmo_lan).

create table if not exists gmo_payment_snapshot (
  source      source_system not null,
  source_id   text          not null,
  batch_id    text,
  contract_id text,
  store_code  text,
  amount      numeric(14,2),
  status      text,
  loai        integer,
  ky_cuoc     text,
  han_tra     timestamptz,
  phieu_coc_id text,
  ghi_chu     text,
  created_at_src timestamptz,
  updated_at_src timestamptz,
  created_by_src text,
  synced_at   timestamptz not null default now(),
  primary key (source, source_id)
);

create index if not exists gmo_batch on gmo_payment_snapshot (batch_id);
create index if not exists gmo_status on gmo_payment_snapshot (status);

comment on table gmo_payment_snapshot is
  'Mã thanh toán combini qua GMO — bốn dòng một lần tạo, gộp theo batch_id trước khi cộng tiền';
comment on column gmo_payment_snapshot.loai is
  '1 = thanh toán cước, 2 = cọc (ô "Loại" lúc tạo mã)';
