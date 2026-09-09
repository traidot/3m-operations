-- Kho số liệu gộp. Chỉ nhận dữ liệu từ hai hệ thống nguồn, không ghi ngược.
-- Mọi bảng ảnh chụp giữ nguyên khoá gốc kèm tên nguồn để truy ngược được
-- và để hai hệ thống không đụng số định danh của nhau.

create extension if not exists "pgcrypto";

create type source_system as enum ('TELECOM', 'FIXED');

-- ─── Khách hàng đã gộp ────────────────────────────────────────────────

create table party (
  id            uuid primary key default gen_random_uuid(),
  display_name  text not null,
  phone_norm    text,                 -- đã chuẩn hoá về dạng quốc tế
  email_norm    text,                 -- đã hạ chữ thường
  id_hash       text,                 -- băm giấy tờ định danh, không lưu bản gốc
  created_at    timestamptz not null default now()
);
create index party_phone on party (phone_norm) where phone_norm is not null;
create index party_email on party (email_norm) where email_norm is not null;
create index party_idhash on party (id_hash)   where id_hash    is not null;

create table party_source (
  id                 uuid primary key default gen_random_uuid(),
  party_id           uuid not null references party(id),
  source             source_system not null,
  source_customer_id text not null,
  match_rule         text not null,   -- R1 phone | R2 id_hash | R3 email | R4 manual
  status             text not null default 'AUTO'
                     check (status in ('AUTO','CONFIRMED','REJECTED')),
  reviewed_by        text,
  reviewed_at        timestamptz
);
-- Một hồ sơ gốc chỉ thuộc về một party. Đã bác thì cho phép nối lại chỗ khác.
create unique index party_source_unique
  on party_source (source, source_customer_id)
  where status <> 'REJECTED';

-- ─── Ảnh chụp từ hai hệ thống ─────────────────────────────────────────

create table subscription_snapshot (
  source                 source_system not null,
  source_id              text not null,
  party_id               uuid references party(id),
  source_customer_id     text not null,
  service_type           text,             -- POCKET_WIFI | DATA_SIM | WIMAX | SOFTBANK_SIM | FIXED_INTERNET
  plan_name              text,
  status                 text not null,    -- PENDING | ACTIVE | SUSPENDED | TERMINATED
  monthly_price          numeric(14,2),
  monthly_cost           numeric(14,2),
  activated_on           date,
  terminated_on          date,
  anchor_day             int check (anchor_day between 1 and 31),
  device_ref             text,             -- IMEI nếu có
  sim_ref                text,
  -- Ba cột dưới quyết định đo được kỷ luật nhập liệu hay không.
  -- Nguồn không có thì để null, các view liên quan tự bỏ qua.
  created_at_src         timestamptz,
  updated_at_src         timestamptz,
  created_by_src         text,
  synced_at              timestamptz not null default now(),
  primary key (source, source_id)
);
create index sub_active   on subscription_snapshot (status, service_type);
create index sub_party    on subscription_snapshot (party_id);
create index sub_activated on subscription_snapshot (activated_on);

create table invoice_snapshot (
  source                 source_system not null,
  source_id              text not null,
  party_id               uuid references party(id),
  subscription_source_id text,
  number                 text,
  issued_on              date not null,
  due_on                 date not null,
  period_start           date,
  period_end             date,
  total_amount           numeric(14,2) not null,
  paid_amount            numeric(14,2) not null default 0,
  status                 text not null,   -- ISSUED | PAID | VOID | WRITTEN_OFF
  created_at_src         timestamptz,
  created_by_src         text,
  synced_at              timestamptz not null default now(),
  primary key (source, source_id)
);
create index inv_due    on invoice_snapshot (due_on) where status = 'ISSUED';
create index inv_party  on invoice_snapshot (party_id);
create index inv_sub    on invoice_snapshot (source, subscription_source_id);
create index inv_period on invoice_snapshot (period_start, period_end);

create table payment_snapshot (
  source             source_system not null,
  source_id          text not null,
  party_id           uuid references party(id),
  invoice_source_id  text,              -- null nghĩa là chưa cấn vào hoá đơn nào
  amount             numeric(14,2) not null,
  channel            text,              -- CASH | BANK | CARD | AUTO_DEBIT
  reference          text,              -- mã giao dịch, cần cho đối chiếu sao kê
  paid_at            timestamptz not null,
  created_at_src     timestamptz,
  created_by_src     text,
  synced_at          timestamptz not null default now(),
  primary key (source, source_id)
);
create index pay_paid_at on payment_snapshot (paid_at);
create index pay_party   on payment_snapshot (party_id);

create table device_snapshot (
  source                 source_system not null,
  source_id              text not null,
  imei                   text,
  model                  text,
  status                 text,          -- IN_STOCK | ASSIGNED | ON_LOAN | IN_REPAIR | LOST
  subscription_source_id text,
  location               text,
  updated_at_src         timestamptz,
  synced_at              timestamptz not null default now(),
  primary key (source, source_id)
);
create index dev_imei   on device_snapshot (imei);
create index dev_status on device_snapshot (status);

-- ─── Bảng duy nhất được nhập tay ──────────────────────────────────────
-- Chỉ dùng khi hai hệ thống chưa ghi việc cho mượn máy pocket.
-- Nếu thấy người ta bắt đầu nhập thứ khác vào đây thì đó là tín hiệu
-- phải đưa phần đó về hệ thống vận hành thật.

create table loan_record (
  id           uuid primary key default gen_random_uuid(),
  party_id     uuid references party(id),
  device_imei  text not null,
  install_ref  text,                 -- mã đơn lắp đặt bên hệ thống wifi cố định
  issued_on    date not null,
  due_on       date not null,
  returned_on  date,
  note         text,
  entered_by   text not null,
  created_at   timestamptz not null default now()
);
create unique index loan_open_per_device
  on loan_record (device_imei) where returned_on is null;
create index loan_due on loan_record (due_on) where returned_on is null;

-- ─── Ảnh chụp số liệu theo ngày ───────────────────────────────────────
-- Công nợ và tồn kho là số tại thời điểm: hôm nay không lưu thì tuần sau
-- không dựng lại được.

create table daily_metric (
  id           uuid primary key default gen_random_uuid(),
  metric_date  date not null,
  metric_key   text not null,
  dimension    text,                 -- null là tổng
  value        numeric(18,4) not null,
  computed_at  timestamptz not null default now()
);
create unique index daily_metric_unique
  on daily_metric (metric_date, metric_key, coalesce(dimension, ''));
create index daily_metric_key on daily_metric (metric_key, metric_date desc);

-- ─── Nhật ký đồng bộ ──────────────────────────────────────────────────
-- Đồng bộ chết âm thầm nguy hiểm hơn đồng bộ lỗi: bản tin vẫn ra đều,
-- vẫn có số, chỉ là số của hôm kia.

create table sync_run (
  id           uuid primary key default gen_random_uuid(),
  source       source_system not null,
  table_name   text not null,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  rows_read    int,
  rows_written int,
  status       text not null default 'RUNNING'
               check (status in ('RUNNING','OK','FAILED')),
  error        text,
  triggered_by text not null default 'schedule'   -- schedule | manual
);
create index sync_run_latest on sync_run (source, table_name, started_at desc);

-- ─── Ngưỡng do người đặt ──────────────────────────────────────────────
-- Agent đọc bảng này, không tự chọn ngưỡng.

create table threshold (
  key        text primary key,
  value      numeric not null,
  unit       text not null,
  note       text,
  updated_at timestamptz not null default now()
);

-- Giá trị khởi tạo là phỏng đoán, phải chỉnh theo thực tế của 3M.
insert into threshold (key, value, unit, note) values
  ('sync_stale_hours',        30, 'giờ',   'Quá số giờ này không có lần đồng bộ OK thì báo CRITICAL'),
  ('ar_overdue_days',         30, 'ngày',  'Quá hạn hơn số ngày này thì vào nhóm nợ xấu'),
  ('ar_suspend_amount',        0, 'tiền',  'CHƯA ĐẶT — nợ vượt mức này thì đề xuất khoá dịch vụ'),
  ('payment_lag_days',         0, 'ngày',  'Độ trễ ghi nhận tiền chấp nhận được, mặc định là trong ngày'),
  ('invoice_grace_days',       3, 'ngày',  'Ân hạn trước khi coi là thuê bao chạy mà thiếu hoá đơn'),
  ('party_stale_days',         7, 'ngày',  'Hồ sơ khách tạo rồi không có thuê bao nào sau số ngày này'),
  ('install_overdue_days',     2, 'ngày',  'Quá ngày hẹn thi công bao lâu thì báo'),
  ('loan_overdue_days',        0, 'ngày',  'Quá hạn thu hồi máy mượn bao lâu thì báo');
