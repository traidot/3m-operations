-- Vạch đứng đánh dấu mốc hợp đồng quá mờ, lại không tự nói được đâu là đầu
-- đâu là đuôi. Đổi cách thể hiện: trả về đúng đoạn tháng mà hợp đồng phủ,
-- để vẽ nó thành một khối liền — ngoài khối là ngoài hợp đồng, khỏi cần vạch.
--
--   tu_thang, den_thang  đoạn của năm nay mà hợp đồng phủ, null nếu không phủ
--   co_mo_dau            hợp đồng bắt đầu ngay trong năm nay, bo tròn đầu khối
--   co_ket_thuc          hợp đồng kết thúc ngay trong năm nay, bo tròn đuôi
--
-- Không bo tròn nghĩa là đoạn này chạy tiếp sang năm khác.

drop view if exists v_fixed_year_status;
create view v_fixed_year_status as
with nam as (
  select extract(year from current_date)::int as y,
         make_date(extract(year from current_date)::int, 1, 1)   as dau_nam,
         make_date(extract(year from current_date)::int, 12, 31) as cuoi_nam
),
doan as (
  select
    s.source_id,
    greatest(s.fee_start_on, n.dau_nam)                        as tu_ngay,
    least(coalesce(s.fee_end_on, n.cuoi_nam), n.cuoi_nam)      as den_ngay,
    extract(year from s.fee_start_on) = n.y                    as co_mo_dau,
    s.fee_end_on is not null
      and extract(year from s.fee_end_on) = n.y                as co_ket_thuc
  from subscription_snapshot s, nam n
  where s.source = 'FIXED'
)
select
  c.source_id as subscription_id,
  (select y from nam)                                          as nam,
  case when d.tu_ngay <= d.den_ngay
       then extract(month from d.tu_ngay)::int end             as tu_thang,
  case when d.tu_ngay <= d.den_ngay
       then extract(month from d.den_ngay)::int end            as den_thang,
  coalesce(d.co_mo_dau, false)                                 as co_mo_dau,
  coalesce(d.co_ket_thuc, false)                               as co_ket_thuc,
  array_agg(coalesce(p.trang_thai, 'NA') order by m.thang)     as cac_ky
from subscription_snapshot c
join doan d on d.source_id = c.source_id
cross join generate_series(1, 12) as m(thang)
left join v_fixed_contract_period p
       on p.subscription_id = c.source_id
      and p.ky = to_char(make_date((select y from nam), m.thang, 1), 'YYYY-MM')
where c.source = 'FIXED'
group by c.source_id, d.tu_ngay, d.den_ngay, d.co_mo_dau, d.co_ket_thuc;
