-- Nhánh wifi cố định không có khách hàng cuối. 3M chỉ quản hợp đồng và địa chỉ
-- lắp; bảy dòng trong `customers` bên nguồn là nhân viên đứng tên đăng ký với
-- nhà mạng. Nên party_id để trống cho nguồn FIXED, và mọi thứ quy về hợp đồng.

-- Thanh toán phải nối được về hợp đồng. Bên nguồn không có hoá đơn nên
-- invoice_source_id luôn trống.
alter table payment_snapshot
  add column if not exists subscription_source_id text;

create index if not exists pay_sub
  on payment_snapshot (source, subscription_source_id);

-- Địa chỉ Nhật viết tự do, lẫn chữ số nửa rộng và nửa hẹp. Chuẩn hoá để so
-- sánh; hiển thị vẫn dùng bản gốc.
create or replace function address_key(p_raw text)
returns text language sql immutable as $$
  select nullif(
    regexp_replace(
      translate(
        lower(coalesce(p_raw, '')),
        '０１２３４５６７８９－ー−―‐　',
        '0123456789------ '),
      '[[:space:]]+', '', 'g'),
    '');
$$;

/**
 * Kỳ cước phải thu, suy ra vì bên nguồn không có bảng hoá đơn.
 * Sinh từng tháng từ feeStartDate tới tháng hiện tại hoặc tới ngày chấm dứt.
 */
create or replace view v_fixed_expected_fee as
-- Bên nguồn thiếu feeStartDate ở 75% hợp đồng nên tạm neo vào ngày kích hoạt.
-- Khi nào dữ liệu đầy đủ thì đổi sang feeStartDate cho đúng nghiệp vụ.
select
  s.source,
  s.source_id                                as subscription_id,
  s.source_customer_id                       as contract_code,
  to_char(thang, 'YYYY-MM')                  as ky,
  s.monthly_price                            as phai_thu
from subscription_snapshot s
cross join lateral generate_series(
  date_trunc('month', s.activated_on),
  date_trunc('month', least(coalesce(s.terminated_on, current_date), current_date)),
  interval '1 month'
) as thang
where s.source = 'FIXED'
  and s.monthly_price is not null
  and s.activated_on is not null;

/**
 * Công nợ theo hợp đồng: phải thu trừ đã thu.
 * Chỉ tính được cho hợp đồng có đủ monthly_price và ngày bắt đầu.
 */
create or replace view v_fixed_debt as
with phai_thu as (
  select subscription_id, contract_code, count(*) as so_ky, sum(phai_thu) as tong_phai_thu
    from v_fixed_expected_fee group by 1, 2
),
da_thu as (
  select subscription_source_id as subscription_id, sum(amount) as tong_da_thu
    from payment_snapshot where source = 'FIXED' group by 1
)
select
  p.subscription_id,
  p.contract_code,
  p.so_ky,
  p.tong_phai_thu,
  coalesce(d.tong_da_thu, 0)                       as tong_da_thu,
  p.tong_phai_thu - coalesce(d.tong_da_thu, 0)     as con_no
from phai_thu p
left join da_thu d on d.subscription_id = p.subscription_id;

/**
 * Bao nhiêu hợp đồng đang chạy mà không tính được cước.
 * Đây là số phải nhìn trước khi tin bất kỳ con số công nợ nào.
 */
create or replace view v_fixed_billing_coverage as
select
  count(*)                                                        as hop_dong_dang_chay,
  count(*) filter (where monthly_price is null or monthly_price = 0) as thieu_gia_cuoc,
  count(*) filter (where activated_on is null)                    as thieu_ngay_bat_dau,
  count(*) filter (where monthly_price is not null and monthly_price > 0
                     and activated_on is not null)                as tinh_duoc,
  round(100.0 * count(*) filter (where monthly_price is not null and monthly_price > 0
                                   and activated_on is not null)
        / nullif(count(*), 0), 1)                                 as ty_le_tinh_duoc
from subscription_snapshot
where source = 'FIXED' and status = 'ACTIVE';

-- Đối chiếu marketing giờ so với hợp đồng mới, không phải hồ sơ khách mới.
create or replace view v_ads_vs_contract as
with khai as (
  select metric_date, sum(orders) as don_khai
    from ads_daily where product = 'TONG' group by metric_date
),
thuc as (
  select activated_on as metric_date, count(*) as hop_dong_moi
    from subscription_snapshot where activated_on is not null group by 1
)
select
  coalesce(k.metric_date, t.metric_date)                 as ngay,
  coalesce(k.don_khai, 0)                                as don_marketing_khai,
  coalesce(t.hop_dong_moi, 0)                            as hop_dong_moi,
  coalesce(t.hop_dong_moi, 0) - coalesce(k.don_khai, 0)  as chenh_lech
from khai k
full join thuc t on t.metric_date = k.metric_date;
