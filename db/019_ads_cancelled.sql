-- Marketing báo "Đơn hàng" là đơn đã chốt thành công, và có hàng "Số đơn hủy"
-- riêng. Thiếu đơn huỷ thì con số đơn không phải số thật.
--
-- Thêm cả khối THỐNG KÊ WIFI CỐ ĐỊNH: số lịch lắp, lắp thành công, và ba lý do
-- huỷ. Khối này để thành sản phẩm riêng FIXED_INSTALL, không trộn vào khối
-- chi phí quảng cáo.

alter table ads_daily
  add column if not exists orders_cancelled numeric(14,0),
  add column if not exists install_booked   numeric(14,0),
  add column if not exists install_done     numeric(14,0),
  add column if not exists cancel_customer  numeric(14,0),
  add column if not exists cancel_carrier   numeric(14,0),
  add column if not exists cancel_duplicate numeric(14,0),
  -- Tab nào ghi ra dòng này. Hai tab cùng phủ một khoảng ngày thì tab sau đè
  -- tab trước, không có cột này là không phát hiện được.
  add column if not exists source_tab text;

drop view if exists v_ads_derived;
create view v_ads_derived as
select
  a.sheet_owner, a.metric_date, a.product, a.source_tab,
  a.spend, a.reach, a.clicks, a.messages,
  a.orders, a.orders_cancelled,
  coalesce(a.orders, 0) - coalesce(a.orders_cancelled, 0)        as don_thuc,
  round(a.spend / nullif(a.clicks, 0), 0)                        as gia_click,
  round(100.0 * a.clicks / nullif(a.reach, 0), 2)                as ctr,
  round(a.spend / nullif(a.messages, 0), 0)                      as gia_mess,
  round(a.spend / nullif(a.orders, 0), 0)                        as chi_phi_moi_don,
  round(100.0 * a.orders / nullif(a.messages, 0), 2)             as ty_le_chot,
  round(100.0 * a.orders_cancelled / nullif(a.orders, 0), 2)     as ty_le_huy
from ads_daily a;

/** Hai tab khác nhau cùng ghi vào một ngày và một sản phẩm. */
create or replace view v_ads_tab_collision as
select sheet_owner, metric_date, product,
       count(distinct source_tab) as so_tab,
       string_agg(distinct source_tab, ' | ') as cac_tab
  from ads_daily where source_tab is not null
 group by 1, 2, 3 having count(distinct source_tab) > 1;
