-- Tiền khách nộp qua GMO (thanh toán ở combini) cho wifi cố định.
--
-- Bảng `deposit_allocations` bên nguồn là tính năng mới, dòng đầu tiên
-- 27/08/2026. Một phiếu là một lần khách nộp tiền, rồi được phân bổ vào từng
-- tháng cước qua `allocationsJson` — dạng [{"month":"2026-09","amount":2000}].
--
-- Phiếu đã duyệt sẽ sinh dòng trong contract_fee_payments nên kho đã đếm rồi.
-- Phiếu CHỜ DUYỆT thì tiền đã vào tài khoản mà kỳ cước vẫn đang bị coi là chưa
-- thu — đó là chỗ công nợ của mình đang thổi lên.

create table if not exists deposit_allocation_snapshot (
  source                 source_system  not null,
  source_id              text           not null,
  subscription_source_id text           not null,
  contract_code          text,
  amount                 numeric(14,2),
  -- Giữ nguyên mảng phân bổ; rỗng nghĩa là tiền đã nhận mà chưa gán vào tháng nào.
  allocations            jsonb          not null default '[]'::jsonb,
  status                 text,
  channel                text,
  collection_account     text,
  paid_at                timestamptz,
  approved_at            timestamptz,
  note                   text,
  created_at_src         timestamptz,
  created_by_src         text,
  synced_at              timestamptz    not null default now(),
  primary key (source, source_id)
);

create index if not exists deposit_alloc_sub
  on deposit_allocation_snapshot (source, subscription_source_id);
create index if not exists deposit_alloc_status
  on deposit_allocation_snapshot (source, status);

comment on table deposit_allocation_snapshot is
  'Phiếu tiền khách nộp trước cho wifi cố định, kèm cách phân bổ vào từng tháng cước';
comment on column deposit_allocation_snapshot.allocations is
  'Mảng [{"month":"YYYY-MM","amount":n}]; rỗng là chưa gán vào tháng nào';
