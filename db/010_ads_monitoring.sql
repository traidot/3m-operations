-- Đưa số liệu quảng cáo vào bản tin hằng ngày.
-- Kéo về mỗi ngày mà không ai nhìn thì cũng như không.

insert into threshold (key, value, unit, note) values
  ('ads_stale_days', 2, 'ngày', 'Sheet marketing không có số mới quá số ngày này thì báo')
on conflict (key) do nothing;

-- Sheet của ai cập nhật tới ngày nào. Marketing quên nhập thì phải biết ngay,
-- không thì cuối tuần mới phát hiện thiếu cả tuần số liệu.
create or replace view v_ads_freshness as
select
  a.sheet_owner,
  max(a.metric_date)                          as ngay_moi_nhat,
  current_date - max(a.metric_date)           as so_ngay_cham,
  max(a.imported_at)                          as lan_keo_cuoi,
  (select value::int from threshold where key = 'ads_stale_days') as nguong_ngay
from ads_daily a
group by a.sheet_owner;

-- Chi tiêu quảng cáo hôm qua, để đặt cạnh số hồ sơ khách mới trong bản tin.
create or replace view v_ads_yesterday as
select
  sum(spend)    as chi_phi,
  sum(reach)    as tiep_can,
  sum(clicks)   as click,
  sum(messages) as mess,
  sum(orders)   as don_khai
from ads_daily
where product = 'TONG' and metric_date = current_date - 1;

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
    -- Số quảng cáo của ngày hôm trước, cùng nhịp với cash_collected.
    union all
    select p_today, 'ads_' || m.k, m.d, m.v
      from (
        select 'spend' as k, product as d, sum(spend) as v
          from ads_daily where metric_date = p_today - 1 and product <> 'TONG'
         group by product
        union all
        select 'messages', null, sum(messages)
          from ads_daily where metric_date = p_today - 1 and product = 'TONG'
        union all
        select 'orders', null, sum(orders)
          from ads_daily where metric_date = p_today - 1 and product = 'TONG'
      ) m
  ) t
  where t.value is not null
  on conflict (metric_date, metric_key, coalesce(dimension, ''))
  do update set value = excluded.value, computed_at = now();

  get diagnostics v_n = row_count;
  return v_n;
end $$;
