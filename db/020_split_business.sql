-- Hai mảng kinh doanh khác nhau, không gộp báo cáo:
--
--   WIFI  — Đình Việt và Việt Hoàng chạy ads cho wifi cố định và wifi cầm tay.
--           Khách thuê thiết bị, có cước hàng tháng, nên phễu kéo dài tới thu cước.
--   ESIM  — TECHNO bán eSIM đứt đoạn. Không có cước, phễu dừng ở đơn hàng.
--
-- Gộp hai cái vào một phễu là cộng nhầm: một bên đo thuê bao, một bên đo đơn bán.

create or replace function ads_business(p_owner text)
returns text language sql immutable as $$
  select case p_owner when 'techno' then 'ESIM' else 'WIFI' end;
$$;

create or replace view v_ads_business as
select ads_business(sheet_owner) as mang, * from ads_daily;

/** Phễu mảng wifi: quảng cáo → hợp đồng → thu cước. */
create or replace view v_funnel_wifi as
with ads as (
  select to_char(metric_date, 'YYYY-MM') as thang,
         sum(spend)            filter (where product = 'TONG')           as chi_phi,
         sum(reach)            filter (where product = 'TONG')           as tiep_can,
         sum(clicks)           filter (where product = 'TONG')           as click,
         sum(messages)         filter (where product = 'TONG')           as mess,
         sum(orders)           filter (where product = 'TONG')           as don_khai,
         sum(orders_cancelled) filter (where product = 'TONG')           as don_huy,
         sum(messages)         filter (where product = 'FIXED_INTERNET') as mess_co_dinh,
         sum(orders)           filter (where product = 'FIXED_INTERNET') as don_co_dinh,
         sum(spend)            filter (where product = 'FIXED_INTERNET') as chi_phi_co_dinh,
         sum(install_booked)   filter (where product = 'FIXED_INSTALL')  as lich_lap,
         sum(install_done)     filter (where product = 'FIXED_INSTALL')  as lap_xong
    from v_ads_business where mang = 'WIFI'
   group by 1
),
sale as (
  select to_char(coalesce(o.signed_on, o.created_at_src::date), 'YYYY-MM') as thang,
         count(*) as hop_dong_moi
    from install_order_snapshot o
   where coalesce(o.signed_on, o.created_at_src) is not null
   group by 1
),
cuoc as (
  select ky as thang, sum(phai_thu) as cuoc_phai_thu,
         sum(tien_mien_phi) as cuoc_mien_phi, sum(da_thu) as cuoc_da_thu
    from v_fixed_monthly_billing group by ky
)
select
  coalesce(a.thang, s.thang, c.thang) as thang,
  a.chi_phi, a.tiep_can, a.click, a.mess, a.don_khai, a.don_huy,
  a.chi_phi_co_dinh, a.mess_co_dinh, a.don_co_dinh,
  a.lich_lap, a.lap_xong,
  s.hop_dong_moi,
  c.cuoc_phai_thu, c.cuoc_mien_phi, c.cuoc_da_thu,
  round(100.0 * a.don_co_dinh / nullif(a.mess_co_dinh, 0), 1) as ty_le_mess_ra_don,
  round(100.0 * s.hop_dong_moi / nullif(a.don_co_dinh, 0), 1) as ty_le_don_thanh_hop_dong,
  round(a.chi_phi_co_dinh / nullif(s.hop_dong_moi, 0))        as chi_phi_moi_hop_dong
from ads a
full join sale s on s.thang = a.thang
full join cuoc c on c.thang = coalesce(a.thang, s.thang);

/**
 * Phễu mảng eSIM: dừng ở đơn hàng vì bán đứt, không có cước.
 * Chưa có doanh thu — sheet quảng cáo không ghi tiền bán, nên chưa tính được lãi.
 */
create or replace view v_funnel_esim as
select
  to_char(metric_date, 'YYYY-MM')                         as thang,
  sum(spend)            filter (where product = 'TONG')   as chi_phi,
  sum(reach)            filter (where product = 'TONG')   as tiep_can,
  sum(clicks)           filter (where product = 'TONG')   as click,
  sum(messages)         filter (where product = 'TONG')   as mess,
  sum(orders)           filter (where product = 'TONG')   as don,
  sum(orders_cancelled) filter (where product = 'TONG')   as don_huy,
  sum(spend)            filter (where product = 'ESIM')   as chi_phi_esim,
  sum(messages)         filter (where product = 'ESIM')   as mess_esim,
  sum(orders)           filter (where product = 'ESIM')   as don_esim,
  round(sum(spend) filter (where product = 'TONG')
        / nullif(sum(messages) filter (where product = 'TONG'), 0))  as gia_mess,
  round(sum(spend) filter (where product = 'TONG')
        / nullif(sum(orders) filter (where product = 'TONG'), 0))    as chi_phi_moi_don
from v_ads_business
where mang = 'ESIM'
group by 1;
