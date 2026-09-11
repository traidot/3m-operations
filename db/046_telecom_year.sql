-- Dải 12 tháng cho mảng cầm tay, đọc giống bên wifi cố định: nhìn một dòng là
-- thấy tháng nào thu được, tháng nào còn treo, tháng nào mất trắng.
--
-- Khác bên cố định ở chỗ trạng thái lấy thẳng từ hoá đơn chứ không suy ra.
-- Khoảng hợp đồng là từ ngày kích hoạt tới ngày ngừng.

drop view if exists v_telecom_year_status;
create view v_telecom_year_status as
with nam as (
  select extract(year from current_date)::int             as y,
         make_date(extract(year from current_date)::int, 1, 1)   as dau_nam,
         make_date(extract(year from current_date)::int, 12, 31) as cuoi_nam
),
doan as (
  select
    s.source_id,
    greatest(s.activated_on, n.dau_nam)                              as tu_ngay,
    least(coalesce(s.terminated_on, n.cuoi_nam), n.cuoi_nam)         as den_ngay,
    extract(year from s.activated_on) = n.y                          as co_mo_dau,
    s.terminated_on is not null
      and extract(year from s.terminated_on) = n.y                   as co_ket_thuc
  from subscription_snapshot s, nam n
  where s.source = 'TELECOM'
),
-- Một tháng có thể có nhiều hoá đơn; lấy trạng thái xấu nhất để không giấu nợ.
ky as (
  select
    i.subscription_source_id                                 as sid,
    extract(month from coalesce(i.period_start, i.issued_on))::int as thang,
    case
      when bool_or(i.status = 'UNPAYABLE') then 'MAT'
      when bool_or(i.status = 'ISSUED')    then 'DANG_DOI'
      when bool_or(i.status = 'PAID')      then 'DA_THU'
      else 'NA'
    end                                                      as trang_thai
  from invoice_snapshot i
  where i.source = 'TELECOM' and i.status <> 'VOID'
    and extract(year from coalesce(i.period_start, i.issued_on))
        = (select y from nam)
  group by 1, 2
)
select
  s.source_id                                                as subscription_id,
  (select y from nam)                                        as nam,
  case when d.tu_ngay <= d.den_ngay
       then extract(month from d.tu_ngay)::int end           as tu_thang,
  case when d.tu_ngay <= d.den_ngay
       then extract(month from d.den_ngay)::int end          as den_thang,
  coalesce(d.co_mo_dau, false)                               as co_mo_dau,
  coalesce(d.co_ket_thuc, false)                             as co_ket_thuc,
  array_agg(coalesce(k.trang_thai, 'NA') order by m.thang)   as cac_ky
from subscription_snapshot s
join doan d on d.source_id = s.source_id
cross join generate_series(1, 12) as m(thang)
left join ky k on k.sid = s.source_id and k.thang = m.thang
where s.source = 'TELECOM'
group by s.source_id, d.tu_ngay, d.den_ngay, d.co_mo_dau, d.co_ket_thuc;
