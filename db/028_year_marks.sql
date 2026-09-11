-- Dải 12 ô không cho biết hợp đồng bắt đầu và kết thúc tháng nào, nên ô trống
-- đầu dải với ô trống cuối dải trông giống hệt nhau: một bên là chưa ký, một
-- bên là đã ngừng hoặc chưa tới hạn.
--
-- Trả thêm hai mốc theo tháng trong năm hiện tại, null nếu mốc nằm năm khác.

drop view if exists v_fixed_year_status;
create view v_fixed_year_status as
with nam as (select extract(year from current_date)::int as y)
select
  c.source_id as subscription_id,
  (select y from nam)                                       as nam,
  case when extract(year from c.fee_start_on) = (select y from nam)
       then extract(month from c.fee_start_on)::int end     as thang_bat_dau,
  case when extract(year from c.fee_end_on) = (select y from nam)
       then extract(month from c.fee_end_on)::int end       as thang_ket_thuc,
  array_agg(coalesce(p.trang_thai, 'NA') order by m.thang)  as cac_ky
from subscription_snapshot c
cross join generate_series(1, 12) as m(thang)
left join v_fixed_contract_period p
       on p.subscription_id = c.source_id
      and p.ky = to_char(make_date((select y from nam), m.thang, 1), 'YYYY-MM')
where c.source = 'FIXED'
group by c.source_id, c.fee_start_on, c.fee_end_on;
