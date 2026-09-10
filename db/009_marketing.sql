-- Số liệu quảng cáo từ hai Google Sheets của bên marketing.
--
-- Chỉ nhập năm số gốc. Giá click, CTR, giá mess, chi phí trên đơn đều tính
-- lại ở đây — trong sheet mấy hàng đó dùng dấu phẩy thập phân nên xuất ra
-- là vỡ cột, và tính lại thì luôn khớp với số gốc.

create table ads_daily (
  sheet_owner  text not null,        -- ai chạy quảng cáo, mỗi người một file
  metric_date  date not null,
  product      text not null,        -- TONG | POCKET_WIFI | WIMAX | ESIM | FIXED_INTERNET | DATA_SIM
  spend        numeric(14,2),
  reach        numeric(14,0),
  clicks       numeric(14,0),
  messages     numeric(14,0),
  orders       numeric(14,0),
  imported_at  timestamptz not null default now(),
  primary key (sheet_owner, metric_date, product)
);
create index ads_daily_date on ads_daily (metric_date);

-- Số dẫn xuất. Chia cho 0 thì để null chứ đừng ra 0 — không có click và
-- giá click bằng 0 là hai chuyện khác nhau.
create or replace view v_ads_derived as
select
  a.sheet_owner,
  a.metric_date,
  a.product,
  a.spend, a.reach, a.clicks, a.messages, a.orders,
  round(a.spend / nullif(a.clicks, 0), 0)                        as gia_click,
  round(100.0 * a.clicks / nullif(a.reach, 0), 2)                as ctr,
  round(a.spend / nullif(a.messages, 0), 0)                      as gia_mess,
  round(a.spend / nullif(a.orders, 0), 0)                        as chi_phi_moi_don,
  round(100.0 * a.orders / nullif(a.messages, 0), 2)             as ty_le_chot
from ads_daily a;

create or replace view v_ads_weekly as
select
  date_trunc('week', metric_date)::date as tuan,
  sheet_owner,
  product,
  sum(spend)    as spend,
  sum(reach)    as reach,
  sum(clicks)   as clicks,
  sum(messages) as messages,
  sum(orders)   as orders,
  round(sum(spend) / nullif(sum(messages), 0), 0) as gia_mess,
  round(sum(spend) / nullif(sum(orders), 0), 0)   as chi_phi_moi_don
from ads_daily
where product <> 'TONG'
group by 1, 2, 3;

/**
 * Đối chiếu mức 1: số đơn marketing tự khai so với số hồ sơ khách thật sự
 * được tạo trong phần mềm, theo ngày.
 *
 * Không cần đổi gì ở hai hệ thống nguồn. Chưa biết được đơn nào từ quảng cáo
 * nào — muốn vậy phải thêm trường nguồn khách, và chỉ nên làm khi bảng này
 * cho thấy lệch thật.
 */
create or replace view v_ads_vs_party as
with khai as (
  select metric_date, sum(orders) as don_khai
    from ads_daily where product = 'TONG'
   group by metric_date
),
thuc as (
  select p.created_at::date as metric_date, count(*) as ho_so_moi
    from party p group by 1
)
select
  coalesce(k.metric_date, t.metric_date)          as ngay,
  coalesce(k.don_khai, 0)                         as don_marketing_khai,
  coalesce(t.ho_so_moi, 0)                        as ho_so_tao_moi,
  coalesce(t.ho_so_moi, 0) - coalesce(k.don_khai, 0) as chenh_lech
from khai k
full join thuc t on t.metric_date = k.metric_date;

-- Nhật ký nhập sheet, để biết số liệu quảng cáo cũ tới đâu.
create table ads_import_run (
  id           uuid primary key default gen_random_uuid(),
  sheet_owner  text not null,
  tab_name     text not null,
  started_at   timestamptz not null default now(),
  rows_written int,
  status       text not null default 'RUNNING' check (status in ('RUNNING','OK','FAILED')),
  error        text
);
