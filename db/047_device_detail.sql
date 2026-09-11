-- Mã máy (IMEI) mới chỉ là một chuỗi nằm cạnh tên dịch vụ. Cần biết thêm: máy
-- đang ở trạng thái nào, đặt cọc bao nhiêu, thuê từ bao giờ, đã trả chưa, và
-- thuê bao này đã từng đổi sang máy khác chưa.

alter table device_snapshot
  add column if not exists deposit        numeric(14,2),
  add column if not exists deposit_status text,
  add column if not exists rented_on      date,
  add column if not exists returned_on    date;

comment on column device_snapshot.deposit_status is
  'Trạng thái tiền cọc bên nguồn: PENDING | RETURNED | NOT_RETURNABLE';

/**
 * Lịch sử gắn máy vào thuê bao. Một thuê bao có thể đổi máy giữa chừng, nên
 * mã máy hiện tại trên thuê bao không kể hết chuyện.
 */
create table if not exists subscription_device_snapshot (
  source                 source_system not null,
  source_id              text not null,
  subscription_source_id text not null,
  imei                   text not null,
  started_on             date,
  ended_on               date,
  created_at_src         timestamptz,
  synced_at              timestamptz not null default now(),
  primary key (source, source_id)
);
create index if not exists sub_device_sub on subscription_device_snapshot (source, subscription_source_id);
create index if not exists sub_device_imei on subscription_device_snapshot (source, imei);

/** Máy của một thuê bao, kèm tình trạng thuê và cọc. */
drop view if exists v_telecom_device;
create view v_telecom_device as
select
  sd.subscription_source_id           as subscription_id,
  sd.imei,
  sd.started_on                       as gan_tu,
  sd.ended_on                         as gan_den,
  d.status                            as trang_thai_may,
  d.deposit                           as coc,
  d.deposit_status                    as trang_thai_coc,
  d.rented_on                         as ngay_thue,
  d.returned_on                       as ngay_tra,
  sd.ended_on is null                 as dang_gan
from subscription_device_snapshot sd
-- Một IMEI có thể có nhiều phiếu thuê (thuê lại lần nữa). Lấy phiếu mới nhất,
-- không thì join thẳng sẽ nhân đôi dòng máy của thuê bao.
left join lateral (
  select * from device_snapshot d
   where d.source = sd.source and d.imei = sd.imei
   order by d.rented_on desc nulls last, d.source_id desc
   limit 1
) d on true
where sd.source = 'TELECOM';
