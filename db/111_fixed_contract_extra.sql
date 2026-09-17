-- Các trường bên nguồn wifi cố định mình chưa kéo về.
--
-- Để riêng một bảng chứ không nhét vào subscription_snapshot: bảng đó dùng
-- chung cho cả hai nguồn, thêm mười cột chỉ có ý nghĩa với wifi cố định vào là
-- làm hỏng ý nghĩa của nó.
--
-- Đáng chú ý trong đám này:
--   contract_type        NORMAL 5.189 / TYPE_1 1.058 / TYPE_2 531 — chưa biết
--                        ba loại thu khác nhau thế nào, giá trung bình thì
--                        gần như nhau (1.988 / 2.000 / 1.993)
--   lich_huy_du_kien     scheduledCutDate, 427 hợp đồng — có thể báo huỷ sớm
--                        hơn cả ngày huỷ thật
--   ma_u                 chính là orderId bên nguồn, nhưng KHÔNG phải mã đơn
--                        hàng: là ô ghi chú tự do, ví dụ "建物名確認" (xác nhận
--                        tên toà nhà), "10月以降エントリー" (đăng ký từ tháng 10)
--   provider_status      trạng thái bên nhà mạng, tiếng Nhật: 工事完了 3.397,
--                        注文取消 1.653, #N/A 885, 工事待ち 621

drop table if exists fixed_contract_extra;
create table fixed_contract_extra (
  -- Cùng khuôn với mọi bảng snapshot khác: khoá (source, source_id), vì bộ
  -- đồng bộ dùng chung một câu insert cho tất cả.
  source               source_system not null,
  source_id            text not null,
  contract_type        text,
  lich_huy_du_kien     date,
  ma_u                 text,
  provider_status      text,
  owner                text,
  caf_number           text,
  billing_number       text,
  designated_account   text,
  so_lan_dang_ky       int,
  ngay_ky_thuat_den    date,
  ngay_gui_thiet_bi    date,
  ly_do_lap_that_bai   text,
  ly_do_chua_lap_xong  text,
  synced_at            timestamptz not null default now(),
  primary key (source, source_id)
);

comment on table fixed_contract_extra is
  'Trường phụ của hợp đồng wifi cố định, kéo nguyên từ contracts bên MySQL — chưa dùng vào luật nào';
comment on column fixed_contract_extra.ma_u is
  'orderId bên nguồn: ô ghi chú tự do chứ không phải mã đơn hàng';

/** Danh mục lý do không thu cước, bên nguồn dùng để đánh dấu hợp đồng chờ huỷ. */
drop table if exists fixed_no_collection_reason;
create table fixed_no_collection_reason (
  source      source_system not null,
  source_id   text not null,
  ten         text not null,
  trang_thai  text,
  gay_cho_huy boolean not null default false,
  synced_at   timestamptz not null default now(),
  primary key (source, source_id)
);

/** Các đợt nộp của một kỳ cước — một phiếu thu có thể chia nhiều đợt. */
drop table if exists fixed_fee_installment;
create table fixed_fee_installment (
  source          source_system not null,
  source_id       text not null,
  fee_period_id   text,
  contract_id     text,
  ky              text,
  amount          numeric,
  paid_at         timestamptz,
  channel         text,
  status          text,
  note            text,
  created_at_src  timestamptz,
  created_by_src  text,
  synced_at       timestamptz not null default now(),
  primary key (source, source_id)
);

create index if not exists fee_installment_ky on fixed_fee_installment (ky);
create index if not exists fee_installment_period on fixed_fee_installment (fee_period_id);

comment on table fixed_fee_installment is
  'Đợt nộp của kỳ cước wifi cố định. Tổng các đợt bám sát amount của phiếu, chênh ở phiếu chờ duyệt ghi 0 mà khách đã nộp';
