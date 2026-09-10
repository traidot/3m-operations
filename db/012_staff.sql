-- Nhân sự, để báo cáo hiện tên thay vì UUID.
-- Không mang mật khẩu hay email sang — lớp giám sát chỉ cần biết ai làm gì.

create table if not exists staff_snapshot (
  source          source_system not null,
  source_id       text not null,
  display_name    text not null,
  role            text,
  status          text,
  team_ref        text,
  synced_at       timestamptz not null default now(),
  primary key (source, source_id)
);

-- Độ trễ ghi nhận tiền, đã có tên người thay cho UUID.
create or replace view v_payment_lag_by_staff as
select
  coalesce(s.display_name, p.created_by_src, 'không rõ') as nguoi_nhap,
  count(*)                                               as so_ban_ghi,
  round(100.0 * count(*) filter (
    where p.created_at_src::date = p.paid_at::date) / nullif(count(*), 0), 1)
                                                         as ty_le_trong_ngay,
  percentile_cont(0.5) within group (
    order by p.created_at_src::date - p.paid_at::date)   as tre_trung_vi,
  max(p.created_at_src::date - p.paid_at::date)          as tre_lau_nhat
from payment_snapshot p
left join staff_snapshot s
       on s.source = p.source and s.source_id = p.created_by_src
where p.created_at_src is not null
group by 1;
