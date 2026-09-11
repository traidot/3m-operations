-- Mỗi người chạy ads một sheet riêng. Trước đây báo cáo wifi cộng gộp cả hai,
-- nên không biết ai tiêu tiền vào đâu. Tách ra để theo dõi riêng từng người,
-- vẫn giữ bản cộng gộp cho bức tranh chung.

create or replace function ads_person(p_owner text)
returns text language sql immutable as $$
  select case p_owner
           when 'dinh_viet'  then 'Đình Việt'
           when 'viet_hoang' then 'Việt Hoàng'
           when 'techno'     then 'TECHNO'
           else p_owner
         end;
$$;

/**
 * Phễu wifi tách theo người chạy ads.
 *
 * Dừng ở "lắp xong" vì đó là bậc cuối mà sheet quảng cáo còn ghi. Hợp đồng
 * trong hệ thống và cước thu được KHÔNG gắn với người chạy ads — không có
 * trường nguồn khách — nên hai bậc đó chỉ có ở bản cộng gộp v_funnel_wifi.
 */
drop view if exists v_funnel_wifi_nguoi;
create view v_funnel_wifi_nguoi as
select
  sheet_owner                                             as nguoi_key,
  ads_person(sheet_owner)                                 as nguoi,
  to_char(metric_date, 'YYYY-MM')                         as thang,
  sum(spend)            filter (where product = 'TONG')           as chi_phi,
  sum(reach)            filter (where product = 'TONG')           as tiep_can,
  sum(clicks)           filter (where product = 'TONG')           as click,
  sum(messages)         filter (where product = 'TONG')           as mess,
  sum(orders)           filter (where product = 'TONG')           as don_khai,
  sum(orders_cancelled) filter (where product = 'TONG')           as don_huy,
  sum(spend)            filter (where product = 'FIXED_INTERNET') as chi_phi_co_dinh,
  sum(messages)         filter (where product = 'FIXED_INTERNET') as mess_co_dinh,
  sum(orders)           filter (where product = 'FIXED_INTERNET') as don_co_dinh,
  sum(spend)            filter (where product = 'POCKET_WIFI')    as chi_phi_cam_tay,
  sum(messages)         filter (where product = 'POCKET_WIFI')    as mess_cam_tay,
  sum(orders)           filter (where product = 'POCKET_WIFI')    as don_cam_tay,
  sum(spend)            filter (where product = 'WIMAX')          as chi_phi_wimax,
  sum(messages)         filter (where product = 'WIMAX')          as mess_wimax,
  sum(orders)           filter (where product = 'WIMAX')          as don_wimax,
  sum(install_booked)   filter (where product = 'FIXED_INSTALL')  as lich_lap,
  sum(install_done)     filter (where product = 'FIXED_INSTALL')  as lap_xong,
  round(sum(spend)    filter (where product = 'TONG')
        / nullif(sum(messages) filter (where product = 'TONG'), 0)) as gia_mess,
  round(sum(spend)    filter (where product = 'TONG')
        / nullif(sum(orders)   filter (where product = 'TONG'), 0)) as chi_phi_moi_don
from v_ads_business
where mang = 'WIFI'
group by 1, 2, 3;
