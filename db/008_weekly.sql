-- Báo cáo tuần: xu hướng, không phải việc phải làm.
-- Bản tin sáng trả lời hôm nay làm gì; báo cáo tuần trả lời đang tốt lên hay xấu đi.

-- Đơn lắp đặt, chỉ có ở hệ thống wifi cố định. Cần cho hai chỉ số:
-- thời gian chờ thi công, và đơn treo quá lịch hẹn.
create table if not exists install_order_snapshot (
  source                 source_system not null,
  source_id              text not null,
  source_customer_id     text,
  party_id               uuid references party(id),
  address                text,
  status                 text not null,   -- SURVEY | SCHEDULED | INSTALLING | DONE | CANCELLED
  signed_on              date,
  scheduled_at           timestamptz,
  completed_on           date,
  technician_ref         text,
  created_at_src         timestamptz,
  updated_at_src         timestamptz,
  created_by_src         text,
  synced_at              timestamptz not null default now(),
  primary key (source, source_id)
);
create index if not exists install_status on install_order_snapshot (status);
create index if not exists install_signed on install_order_snapshot (signed_on);

-- ─── Số của một tuần ──────────────────────────────────────────────────
-- Dạng dài: mỗi dòng một chỉ số. Thêm chỉ số mới không phải đổi cấu trúc.
-- Tuần tính từ thứ hai, p_week là ngày thứ hai đầu tuần.

create or replace function weekly_metric_raw(p_week date)
returns table (metric_key text, dimension text, value numeric)
language sql stable as $$
  with bounds as (
    select p_week as tu, p_week + 7 as den
  ),

  -- Chốt số tồn kho bằng ảnh chụp cuối cùng trong tuần. Công nợ là số tại
  -- thời điểm, tính lại từ dữ liệu hôm nay sẽ ra số khác.
  snap as (
    select distinct on (m.metric_key, m.dimension)
           m.metric_key, m.dimension, m.value
      from daily_metric m, bounds b
     where m.metric_date >= b.tu and m.metric_date < b.den
     order by m.metric_key, m.dimension, m.metric_date desc
  )

  select 'cash_collected', null, coalesce(sum(p.amount), 0)
    from payment_snapshot p, bounds b
   where p.paid_at >= b.tu and p.paid_at < b.den

  union all
  select 'invoiced_amount', null, coalesce(sum(i.total_amount), 0)
    from invoice_snapshot i, bounds b
   where i.due_on >= b.tu and i.due_on < b.den and i.status <> 'VOID'

  union all
  select 'collection_rate', null,
         round(100.0 * coalesce((select sum(p.amount) from payment_snapshot p, bounds b
                                  where p.paid_at >= b.tu and p.paid_at < b.den), 0)
               / nullif((select sum(i.total_amount) from invoice_snapshot i, bounds b
                          where i.due_on >= b.tu and i.due_on < b.den
                            and i.status <> 'VOID'), 0), 1)

  union all
  select 'new_subscription', s.service_type, count(*)::numeric
    from subscription_snapshot s, bounds b
   where s.activated_on >= b.tu and s.activated_on < b.den
   group by s.service_type

  union all
  select 'churned_subscription', s.service_type, count(*)::numeric
    from subscription_snapshot s, bounds b
   where s.terminated_on >= b.tu and s.terminated_on < b.den
   group by s.service_type

  -- Đang chạy tính tại cuối tuần, suy từ ngày kích hoạt và ngày chấm dứt.
  union all
  select 'active_at_end', s.service_type, count(*)::numeric
    from subscription_snapshot s, bounds b
   where s.activated_on < b.den
     and (s.terminated_on is null or s.terminated_on >= b.den)
   group by s.service_type

  -- Biên lãi gộp của những thuê bao còn chạy cuối tuần.
  union all
  select 'gross_margin', s.service_type,
         coalesce(sum(s.monthly_price - coalesce(s.monthly_cost, 0)), 0)
    from subscription_snapshot s, bounds b
   where s.activated_on < b.den
     and (s.terminated_on is null or s.terminated_on >= b.den)
   group by s.service_type

  -- Tỉ lệ máy sinh cước. Trần doanh thu nhánh thiết bị nằm ở đây, không
  -- nằm ở số khách. Máy mất không tính vào mẫu số.
  union all
  select 'device_earning_rate', null,
         round(100.0 * count(*) filter (where d.status = 'ASSIGNED')
               / nullif(count(*) filter (where d.status <> 'LOST'), 0), 1)
    from device_snapshot d

  union all
  select 'loan_days_median', null,
         percentile_cont(0.5) within group (order by l.returned_on - l.issued_on)::numeric
    from loan_record l, bounds b
   where l.returned_on >= b.tu and l.returned_on < b.den

  union all
  select 'install_lead_days_median', null,
         percentile_cont(0.5) within group (order by o.completed_on - o.signed_on)::numeric
    from install_order_snapshot o, bounds b
   where o.completed_on >= b.tu and o.completed_on < b.den
     and o.signed_on is not null

  union all
  select s.metric_key, s.dimension, s.value from snap s
   where s.metric_key in ('ar_total', 'ar_aging', 'missing_invoice', 'loan_overdue');
$$;

/**
 * Báo cáo tuần: số tuần này, tuần trước, và trung bình bốn tuần trước đó.
 * Không có mốc so sánh thì agent chỉ đọc lại con số bằng lời.
 */
create or replace function weekly_report(p_week date default (date_trunc('week', current_date) - interval '7 days')::date)
returns table (
  metric_key  text,
  dimension   text,
  tuan_nay    numeric,
  tuan_truoc  numeric,
  tb_4_tuan   numeric
) language sql stable as $$
  with nay as (select * from weekly_metric_raw(p_week)),
       truoc as (select * from weekly_metric_raw(p_week - 7)),
       truoc_4 as (
         select r.metric_key, r.dimension, avg(r.value) as tb
           from generate_series(1, 4) g
           cross join lateral weekly_metric_raw(p_week - g * 7) r
          group by r.metric_key, r.dimension
       )
  select
    coalesce(n.metric_key, t.metric_key, a.metric_key),
    coalesce(n.dimension,  t.dimension,  a.dimension),
    n.value,
    t.value,
    round(a.tb, 2)
  from nay n
  full join truoc t
    on t.metric_key = n.metric_key
   and t.dimension is not distinct from n.dimension
  full join truoc_4 a
    on a.metric_key = coalesce(n.metric_key, t.metric_key)
   and a.dimension is not distinct from coalesce(n.dimension, t.dimension)
  order by 1, 2 nulls first;
$$;

-- Chụp thêm tỉ lệ máy sinh cước và đơn lắp treo vào ảnh chụp hằng ngày,
-- để tuần sau còn so được.
create or replace function snapshot_daily(p_today date default current_date)
returns int language plpgsql as $$
declare v_n int := 0;
begin
  -- Chỉ số không tính được thì bỏ hẳn dòng, đừng ghi 0 — tỉ lệ máy sinh cước
  -- bằng 0 và không có máy nào là hai chuyện khác nhau.
  insert into daily_metric (metric_date, metric_key, dimension, value)
  select t.metric_date, t.metric_key, t.dimension, t.value
  from (
    select p_today as metric_date, 'ar_total' as metric_key,
           null::text as dimension, coalesce(sum(con_du), 0) as value
      from v_ar_open
    union all
    select p_today, 'ar_aging', nhom, tong_tien from v_ar_aging
    union all
    select p_today, 'cash_collected', null, coalesce(sum(amount), 0)
      from payment_snapshot where paid_at::date = p_today - 1
    union all
    select p_today, 'active_subscriptions', service_type, count(*)
      from subscription_snapshot where status = 'ACTIVE' group by service_type
    union all
    select p_today, 'missing_invoice', null, count(*) from v_missing_invoice
    union all
    select p_today, 'loan_overdue', null, count(*) from v_loan_overdue
    union all
    select p_today, 'device_earning_rate', null,
           round(100.0 * count(*) filter (where status = 'ASSIGNED')
                 / nullif(count(*) filter (where status <> 'LOST'), 0), 1)
      from device_snapshot
    union all
    select p_today, 'install_overdue', null, count(*)
      from install_order_snapshot
     where status in ('SURVEY','SCHEDULED','INSTALLING')
       and scheduled_at::date < p_today
           - (select value::int from threshold where key = 'install_overdue_days')
  ) t
  where t.value is not null
  on conflict (metric_date, metric_key, coalesce(dimension, ''))
  do update set value = excluded.value, computed_at = now();

  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Đơn lắp treo quá lịch hẹn, để bản tin sáng gọi tên từng đơn.
create or replace view v_install_overdue as
select o.source, o.source_id, o.party_id, o.address, o.status,
       o.scheduled_at::date as ngay_hen,
       current_date - o.scheduled_at::date as ngay_qua_han
  from install_order_snapshot o
 where o.status in ('SURVEY','SCHEDULED','INSTALLING')
   and o.scheduled_at is not null
   and o.scheduled_at::date < current_date
       - (select value::int from threshold where key = 'install_overdue_days');
