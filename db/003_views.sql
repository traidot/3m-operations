-- Nguồn sự thật dùng chung cho Metabase và agent.
-- Metabase vẽ các view này, agent đọc chính các view này.
-- Không nơi nào được tính lại một con số tiền theo cách khác.

-- ─── Sức khoẻ hệ thống ────────────────────────────────────────────────

create or replace view v_sync_freshness as
select
  s.source,
  s.table_name,
  max(s.finished_at) filter (where s.status = 'OK')            as lan_dong_bo_cuoi,
  round(extract(epoch from (
    now() - max(s.finished_at) filter (where s.status = 'OK')
  )) / 3600, 1)                                                as gio_ke_tu_lan_cuoi,
  (select t.value from threshold t where t.key = 'sync_stale_hours') as nguong_gio
from sync_run s
group by s.source, s.table_name;

-- ─── Kế toán ──────────────────────────────────────────────────────────

-- Hoá đơn còn dư tiền. Công nợ là số tính ra từ đây, không lưu thành cột.
create or replace view v_ar_open as
select
  i.source,
  i.source_id,
  i.party_id,
  i.number,
  i.subscription_source_id,
  i.issued_on,
  i.due_on,
  i.total_amount,
  i.paid_amount,
  (i.total_amount - i.paid_amount)                    as con_du,
  greatest(current_date - i.due_on, 0)                as ngay_qua_han
from invoice_snapshot i
where i.status = 'ISSUED'
  and i.total_amount > i.paid_amount;

create or replace view v_ar_by_party as
select
  a.party_id,
  p.display_name,
  p.phone_norm,
  count(*)                    as so_hoa_don,
  sum(a.con_du)               as tong_no,
  max(a.ngay_qua_han)         as qua_han_lau_nhat
from v_ar_open a
left join party p on p.id = a.party_id
group by a.party_id, p.display_name, p.phone_norm;

create or replace view v_ar_aging as
select
  case
    when ngay_qua_han = 0             then 'chua_den_han'
    when ngay_qua_han between 1  and 15 then 'qua_han_1_15'
    when ngay_qua_han between 16 and 30 then 'qua_han_16_30'
    else                                   'qua_han_tren_30'
  end                     as nhom,
  count(*)                as so_hoa_don,
  sum(con_du)             as tong_tien
from v_ar_open
group by 1;

-- Số quan trọng nhất của cả hệ thống: thuê bao đang chạy mà kỳ này chưa có
-- hoá đơn. Khác không nghĩa là đang phục vụ miễn phí.
create or replace view v_missing_invoice as
with grace as (
  select value::int as d from threshold where key = 'invoice_grace_days'
),
last_inv as (
  select
    i.source,
    i.subscription_source_id,
    max(i.period_end) as ky_gan_nhat_den
  from invoice_snapshot i
  where i.status <> 'VOID'
  group by 1, 2
)
select
  s.source,
  s.source_id            as subscription_id,
  s.party_id,
  s.service_type,
  s.plan_name,
  s.monthly_price,
  s.activated_on,
  l.ky_gan_nhat_den,
  coalesce(current_date - l.ky_gan_nhat_den, current_date - s.activated_on) as ngay_khong_co_cuoc
from subscription_snapshot s
left join last_inv l
       on l.source = s.source
      and l.subscription_source_id = s.source_id
cross join grace g
where s.status = 'ACTIVE'
  and s.activated_on is not null
  and coalesce(l.ky_gan_nhat_den, s.activated_on) < current_date - g.d;

-- Độ trễ ghi nhận tiền. Cột created_at_src null thì bản ghi tự loại khỏi phép đo.
create or replace view v_payment_lag as
select
  p.source,
  p.created_by_src                                   as nguoi_nhap,
  date_trunc('week', p.paid_at)::date                as tuan,
  count(*)                                           as so_ban_ghi,
  count(*) filter (
    where p.created_at_src::date = p.paid_at::date)  as ghi_trong_ngay,
  round(100.0 * count(*) filter (
    where p.created_at_src::date = p.paid_at::date) / nullif(count(*), 0), 1)
                                                     as ty_le_trong_ngay,
  percentile_cont(0.5) within group (
    order by p.created_at_src::date - p.paid_at::date) as tre_trung_vi,
  max(p.created_at_src::date - p.paid_at::date)        as tre_lau_nhat
from payment_snapshot p
where p.created_at_src is not null
group by 1, 2, 3;

create or replace view v_payment_unallocated as
select p.source, p.source_id, p.party_id, p.amount, p.channel, p.paid_at
from payment_snapshot p
where p.invoice_source_id is null;

create or replace view v_payment_missing_reference as
select p.source, p.source_id, p.party_id, p.amount, p.paid_at
from payment_snapshot p
where p.channel in ('BANK', 'CARD', 'AUTO_DEBIT')
  and (p.reference is null or btrim(p.reference) = '');

-- Tỉ lệ thu theo tuần: tiền thực thu chia tiền đến hạn trong tuần đó.
create or replace view v_collection_rate_weekly as
with due as (
  select date_trunc('week', due_on)::date as tuan, sum(total_amount) as phai_thu
  from invoice_snapshot where status <> 'VOID' group by 1
),
paid as (
  select date_trunc('week', paid_at)::date as tuan, sum(amount) as thuc_thu
  from payment_snapshot group by 1
)
select
  coalesce(d.tuan, p.tuan)                                   as tuan,
  coalesce(d.phai_thu, 0)                                    as phai_thu,
  coalesce(p.thuc_thu, 0)                                    as thuc_thu,
  round(100.0 * coalesce(p.thuc_thu, 0)
        / nullif(d.phai_thu, 0), 1)                          as ty_le_thu
from due d full join paid p on p.tuan = d.tuan;

-- ─── Sale ─────────────────────────────────────────────────────────────

create or replace view v_new_subscription_daily as
select
  s.activated_on                as ngay,
  s.source,
  s.service_type,
  count(*)                      as so_thue_bao,
  sum(s.monthly_price)          as cuoc_thang_tang_them
from subscription_snapshot s
where s.activated_on is not null
group by 1, 2, 3;

create or replace view v_churn_daily as
select s.terminated_on as ngay, s.source, s.service_type, count(*) as so_thue_bao
from subscription_snapshot s
where s.terminated_on is not null
group by 1, 2, 3;

-- Hồ sơ khách tạo rồi bỏ đó: tiền quảng cáo đã tiêu mà không ai chăm.
create or replace view v_party_stale as
select
  ps.source,
  ps.source_customer_id,
  p.id            as party_id,
  p.display_name,
  p.created_at::date as ngay_tao,
  current_date - p.created_at::date as so_ngay
from party p
join party_source ps on ps.party_id = p.id and ps.status <> 'REJECTED'
where not exists (
  select 1 from subscription_snapshot s where s.party_id = p.id
)
  and p.created_at::date < current_date
      - (select value::int from threshold where key = 'party_stale_days');

create or replace view v_activation_lag as
select
  s.source,
  s.service_type,
  date_trunc('week', s.activated_on)::date            as tuan,
  count(*)                                            as so_thue_bao,
  percentile_cont(0.5) within group (
    order by s.activated_on - s.created_at_src::date)  as ngay_cho_trung_vi
from subscription_snapshot s
where s.activated_on is not null and s.created_at_src is not null
group by 1, 2, 3;

-- ─── Thiết bị và máy cho mượn ─────────────────────────────────────────

create or replace view v_loan_overdue as
select
  l.id, l.party_id, l.device_imei, l.install_ref,
  l.issued_on, l.due_on,
  current_date - l.due_on as ngay_qua_han,
  l.entered_by
from loan_record l
where l.returned_on is null
  and l.due_on < current_date
      - (select value::int from threshold where key = 'loan_overdue_days');

-- Thuê bao đã ngừng nhưng máy chưa về kho.
create or replace view v_device_stuck as
select d.source, d.source_id, d.imei, d.model, d.status,
       d.subscription_source_id, s.terminated_on
from device_snapshot d
join subscription_snapshot s
  on s.source = d.source and s.source_id = d.subscription_source_id
where s.status = 'TERMINATED'
  and d.status = 'ASSIGNED';

-- ─── Kỷ luật nhập liệu ────────────────────────────────────────────────

create or replace view v_completeness_party as
select
  count(*)                                                          as tong,
  count(*) filter (where phone_norm is null)                        as thieu_dien_thoai,
  count(*) filter (where id_hash    is null)                        as thieu_giay_to,
  round(100.0 * count(*) filter (where phone_norm is not null)
        / nullif(count(*), 0), 1)                                   as ty_le_co_dien_thoai
from party;

create or replace view v_completeness_subscription as
select
  s.source,
  s.service_type,
  count(*)                                                        as tong,
  count(*) filter (where s.activated_on is null
                     and s.status = 'ACTIVE')                     as thieu_ngay_kich_hoat,
  count(*) filter (where s.device_ref is null
                     and s.sim_ref    is null)                    as thieu_thiet_bi_va_sim
from subscription_snapshot s
group by 1, 2;

-- Khách trùng: cùng số điện thoại nhưng đang là nhiều party khác nhau.
create or replace view v_duplicate_party as
select phone_norm, count(*) as so_ho_so, array_agg(id) as party_ids
from party
where phone_norm is not null
group by phone_norm
having count(*) > 1;
