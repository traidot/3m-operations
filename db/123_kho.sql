-- Phần mềm wifi cầm tay CÓ module kho, dự án mình trước giờ chưa đọc tới:
-- 4 kho (Takadanobaba, Văn phòng V1-A02, Technopark, Ibaraki), 6.451 phiếu
-- nhập/xuất, 14.130 dòng phiếu trên 5.706 mã thiết bị. `rental_device` chỉ ghi
-- lúc máy nằm ở tay khách, không kể hết vòng đời máy.
--
-- Gộp phiếu với dòng phiếu làm một bảng: dòng phiếu không có nghĩa gì nếu tách
-- khỏi phiếu, mà bảng phiếu thì chỉ có 4 kho nên nhân tên kho vào không tốn gì.
--
-- Hai cột bên nguồn luôn rỗng nên không lấy: `msn` và `deviceRecallStatus` đều
-- null ở cả 13.327 dòng. `deviceStatus` thì luôn là GOOD — có cột nhưng không ai
-- dùng, đừng đọc nó thành "máy còn tốt".

create table if not exists stock_move_snapshot (
  source                 source_system not null,
  source_id              text not null,     -- id dòng phiếu
  doc_source_id          text not null,
  doc_code               text,
  device_code            text,
  doc_type               text,              -- INVENTORY_IN | INVENTORY_OUT
  business_type          text,              -- CUSTOMER | VENDOR
  reason_type            text,              -- ISSUE_FOR_ORDER, RECEIPT_FOR_PURCHASE…
  warehouse_code         text,
  warehouse_name         text,
  doc_date               date,
  subscription_source_id text,
  source_customer_id     text,
  -- Bảng nào giữ mã khách bên nguồn thì syncEntity tự nối về party, nên phải có
  -- sẵn cột này chứ không phải thêm cho đẹp.
  party_id               uuid references party(id),
  vendor_name            text,
  synced_at              timestamptz not null default now(),
  primary key (source, source_id)
);
create index if not exists stock_move_device on stock_move_snapshot (source, device_code);
create index if not exists stock_move_date   on stock_move_snapshot (source, doc_date);

comment on table stock_move_snapshot is
  'Dòng phiếu nhập/xuất kho bên nguồn, đã nhân sẵn thông tin phiếu và tên kho';

/** Trạng thái máy ở phía nhà mạng (UCLOUDLINK, SIM4) — bật hay đã tắt. */
create table if not exists provider_device_snapshot (
  source      source_system not null,
  source_id   text not null,
  device_code text,
  state       text,           -- enable | disable
  vendor      text,           -- UCLOUDLINK | SIM4
  synced_at   timestamptz not null default now(),
  primary key (source, source_id)
);
create index if not exists provider_device_code on provider_device_snapshot (source, device_code);
