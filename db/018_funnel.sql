-- Phễu theo tháng: quảng cáo → sale → thu cước.
--
-- Không gộp tiền của hai đầu vào một chỗ: chi phí quảng cáo tính bằng VND,
-- cước wifi cố định tính bằng yên. Chừng nào chưa chốt tỉ giá thì mọi phép
-- chi phí trên doanh thu đều sai.

create or replace view v_funnel_monthly as
-- Cột TỔNG của sheet gộp mọi sản phẩm; hợp đồng bên hệ thống chỉ là wifi cố
-- định. So tổng với hợp đồng là so nhầm rổ, nên tách riêng dòng cố định ra.
with ads as (
  select to_char(metric_date, 'YYYY-MM') as thang,
         sum(spend)    filter (where product = 'TONG')           as chi_phi_ads,
         sum(messages) filter (where product = 'TONG')           as mess,
         sum(orders)   filter (where product = 'TONG')           as don_khai,
         sum(spend)    filter (where product = 'FIXED_INTERNET') as chi_phi_co_dinh,
         sum(messages) filter (where product = 'FIXED_INTERNET') as mess_co_dinh,
         sum(orders)   filter (where product = 'FIXED_INTERNET') as don_khai_co_dinh
    from ads_daily
   group by 1
),
-- Đếm theo NGÀY KÝ chứ không theo ngày bắt đầu thu cước: cột feeStartDate chỉ
-- có ở một phần tư hợp đồng nên đếm theo nó sẽ hụt hẳn các tháng cũ, và tỉ lệ
-- chuyển đổi ra số vô lý.
sale as (
  select to_char(coalesce(o.signed_on, o.created_at_src::date), 'YYYY-MM') as thang,
         count(*) as hop_dong_moi
    from install_order_snapshot o
   where coalesce(o.signed_on, o.created_at_src) is not null
   group by 1
),
cuoc as (
  select ky as thang,
         sum(phai_thu)      as cuoc_phai_thu,
         sum(tien_mien_phi) as cuoc_mien_phi,
         sum(da_thu)        as cuoc_da_thu
    from v_fixed_monthly_billing group by ky
)
select
  coalesce(a.thang, s.thang, c.thang)                 as thang,
  a.chi_phi_ads,
  a.mess,
  a.don_khai,
  a.chi_phi_co_dinh,
  a.mess_co_dinh,
  a.don_khai_co_dinh,
  s.hop_dong_moi,
  c.cuoc_phai_thu,
  c.cuoc_mien_phi,
  c.cuoc_da_thu,
  -- Tỉ lệ giữa các bước, không dính đơn vị tiền nên so được.
  round(100.0 * a.don_khai / nullif(a.mess, 0), 1)                 as ty_le_mess_ra_don,
  round(100.0 * a.don_khai_co_dinh / nullif(a.mess_co_dinh, 0), 1) as ty_le_mess_ra_don_co_dinh,
  round(100.0 * s.hop_dong_moi / nullif(a.don_khai_co_dinh, 0), 1) as ty_le_don_thanh_hop_dong,
  round(a.chi_phi_ads / nullif(a.mess, 0))                         as gia_mess,
  round(a.chi_phi_co_dinh / nullif(s.hop_dong_moi, 0))             as chi_phi_moi_hop_dong
from ads a
full join sale s on s.thang = a.thang
full join cuoc c on c.thang = coalesce(a.thang, s.thang);
