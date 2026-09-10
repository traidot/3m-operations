-- Sửa mô hình cước sau khi đọc kỹ hệ thống nguồn.
--
-- Sai trước đó: coi contract_fee_payments là sổ thu tiền, rồi suy kỳ phải thu
-- từ ngày kích hoạt. Hai chỗ sai —
--   1. activatedAt null ở toàn bộ hợp đồng đang chạy; mốc đúng là feeStartDate
--   2. Dòng isFree = 1 là tháng được khuyến mãi, đã xử lý xong chứ không phải nợ.
--      Lọc chúng ra làm nợ bị tính dôi.
--
-- Đúng: tháng nào KHÔNG có dòng trong sổ mới là tháng còn nợ.

alter table subscription_snapshot
  add column if not exists fee_start_on date,
  add column if not exists fee_end_on   date;

create table if not exists fee_period_snapshot (
  source                 source_system not null,
  source_id              text not null,
  subscription_source_id text not null,
  period                 text not null,      -- YYYY-MM
  amount                 numeric(14,2),
  is_free                boolean not null default false,
  status                 text,               -- APPROVED | NOTE_ONLY | PENDING_APPROVAL
  paid_at                timestamptz,
  channel                text,
  created_at_src         timestamptz,
  created_by_src         text,
  synced_at              timestamptz not null default now(),
  primary key (source, source_id)
);
create index if not exists fee_period_sub on fee_period_snapshot (source, subscription_source_id, period);
create index if not exists fee_period_ky on fee_period_snapshot (period);

-- Các view cũ đổi cột nên phải bỏ trước khi tạo lại.
drop view if exists v_fixed_monthly_total;
drop view if exists v_fixed_monthly_billing;
drop view if exists v_fixed_arrears;
drop view if exists v_fixed_debt;
drop view if exists v_fixed_expected_fee cascade;

-- Kỳ phải sinh: từ tháng bắt đầu thu tới tháng hiện tại, hoặc tới tháng kết thúc.
create or replace view v_fixed_expected_fee as
select
  s.source,
  s.source_id                          as subscription_id,
  s.source_customer_id                 as contract_code,
  to_char(thang, 'YYYY-MM')            as ky,
  s.monthly_price                      as phai_thu
from subscription_snapshot s
cross join lateral generate_series(
  date_trunc('month', s.fee_start_on),
  date_trunc('month', least(coalesce(s.fee_end_on, current_date), current_date)),
  interval '1 month'
) as thang
where s.source = 'FIXED'
  and s.fee_start_on is not null
  and s.monthly_price > 0;

-- Kỳ đã xử lý: có dòng trong sổ và đã được duyệt. Miễn phí cũng là đã xong.
create or replace view v_fixed_settled_fee as
select
  f.subscription_source_id as subscription_id,
  f.period                 as ky,
  bool_or(f.is_free)       as mien_phi,
  sum(case when f.is_free then 0 else f.amount end) as tien_thu
from fee_period_snapshot f
where f.source = 'FIXED' and f.status = 'APPROVED'
group by 1, 2;

/**
 * Công nợ: kỳ phải sinh mà chưa có dòng đã duyệt nào.
 * Kỳ được miễn phí không tính là nợ.
 */
create or replace view v_fixed_debt as
select
  e.subscription_id,
  e.contract_code,
  count(*)                                                as so_ky,
  count(*) filter (where st.mien_phi)                     as so_ky_mien_phi,
  count(*) filter (where st.ky is null)                   as so_ky_no,
  sum(e.phai_thu) filter (where st.ky is null)            as con_no,
  coalesce(sum(st.tien_thu), 0)                           as tong_da_thu
from v_fixed_expected_fee e
left join v_fixed_settled_fee st
       on st.subscription_id = e.subscription_id and st.ky = e.ky
group by 1, 2;

create or replace view v_fixed_arrears as
select d.subscription_id, d.contract_code, d.so_ky, d.so_ky_mien_phi,
       d.so_ky_no, d.tong_da_thu, d.con_no
from v_fixed_debt d
join subscription_snapshot s
  on s.source = 'FIXED' and s.source_id = d.subscription_id
where s.status = 'ACTIVE'
  and d.so_ky_no >= (select value::int from threshold where key = 'fixed_arrears_periods');

create or replace view v_fixed_billing_coverage as
select
  count(*)                                                     as hop_dong_dang_chay,
  count(*) filter (where monthly_price is null or monthly_price = 0) as thieu_gia_cuoc,
  count(*) filter (where fee_start_on is null)                 as thieu_ngay_bat_dau,
  count(*) filter (where monthly_price > 0 and fee_start_on is not null) as tinh_duoc,
  round(100.0 * count(*) filter (where monthly_price > 0 and fee_start_on is not null)
        / nullif(count(*), 0), 1)                              as ty_le_tinh_duoc
from subscription_snapshot
where source = 'FIXED' and status = 'ACTIVE';

-- Bảng theo tháng, dựng lại trên mô hình đúng.
create or replace view v_fixed_monthly_billing as
select
  e.ky,
  s.status                                                   as trang_thai,
  count(*)                                                   as so_hop_dong,
  sum(e.phai_thu)                                            as phai_thu,
  count(*) filter (where st.mien_phi)                        as so_ky_mien_phi,
  sum(e.phai_thu) filter (where st.mien_phi)                 as tien_mien_phi,
  coalesce(sum(st.tien_thu), 0)                              as da_thu,
  sum(e.phai_thu) filter (where st.ky is null)               as con_thieu,
  round(100.0 * coalesce(sum(st.tien_thu), 0)
        / nullif(sum(e.phai_thu) filter (where not coalesce(st.mien_phi, false)), 0), 1)
                                                             as ty_le_thu
from v_fixed_expected_fee e
join subscription_snapshot s
  on s.source = 'FIXED' and s.source_id = e.subscription_id
left join v_fixed_settled_fee st
       on st.subscription_id = e.subscription_id and st.ky = e.ky
group by 1, 2;

create or replace view v_fixed_monthly_total as
select ky,
       sum(so_hop_dong)   as so_hop_dong,
       sum(phai_thu)      as phai_thu,
       sum(tien_mien_phi) as tien_mien_phi,
       sum(da_thu)        as da_thu,
       sum(con_thieu)     as con_thieu,
       round(100.0 * sum(da_thu) / nullif(sum(phai_thu) - coalesce(sum(tien_mien_phi), 0), 0), 1)
                          as ty_le_thu
from v_fixed_monthly_billing group by ky;

-- Kỳ chưa duyệt hoặc chỉ ghi chú, chưa quyết định là thu hay miễn.
create or replace view v_fixed_fee_pending as
select f.status, count(*) as so_ky, sum(f.amount) as tien
from fee_period_snapshot f
where f.source = 'FIXED' and f.status <> 'APPROVED'
group by f.status;

drop view if exists v_fixed_payment_orphan;
