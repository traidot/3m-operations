-- Nhìn danh sách phải thấy ngay hợp đồng nào hổng tháng nào, không phải bấm
-- vào từng cái. Mỗi hợp đồng một dải 12 ô cho 12 tháng của năm hiện tại.

/**
 * Trạng thái 12 kỳ của năm nay, theo đúng thứ tự tháng 1 đến tháng 12.
 * 'NA' là tháng nằm ngoài khoảng hợp đồng phải đóng — để trống chứ không
 * phải nợ.
 */
drop view if exists v_fixed_year_status;
create view v_fixed_year_status as
select
  c.source_id as subscription_id,
  array_agg(coalesce(p.trang_thai, 'NA') order by m.thang) as cac_ky
from subscription_snapshot c
cross join generate_series(1, 12) as m(thang)
left join v_fixed_contract_period p
       on p.subscription_id = c.source_id
      and p.ky = to_char(make_date(extract(year from current_date)::int, m.thang, 1), 'YYYY-MM')
where c.source = 'FIXED'
group by 1;
