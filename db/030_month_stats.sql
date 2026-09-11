-- Trang hợp đồng chỉ trả lời "hợp đồng này thế nào". Còn câu "tháng này thế
-- nào" — ký được bao nhiêu, huỷ bao nhiêu, thu được mấy kỳ — chưa ở đâu trả
-- lời. Hai view dưới đây dựng theo tháng, rồi gộp lại thành một bảng.

/**
 * Vòng đời hợp đồng theo tháng.
 *
 * Dùng signed_on và terminated_on chứ không dùng fee_start_on/fee_end_on:
 * hai cột phí chỉ có ở 894 và 2618 hợp đồng, còn ngày ký có ở 6631/6634 và
 * ngày huỷ ở 2593 — lấy cột phí thì bảng theo tháng rỗng gần hết.
 */
-- Bỏ view gộp trước vì nó dựng trên hai view kia.
drop view if exists v_fixed_month;
drop view if exists v_fixed_month_flow;
create view v_fixed_month_flow as
with thang as (
  select distinct to_char(d, 'YYYY-MM') as ky, d as dau_thang,
         (d + interval '1 month - 1 day')::date as cuoi_thang
    from generate_series(
      (select date_trunc('month', min(signed_on))::date from install_order_snapshot where source = 'FIXED'),
      date_trunc('month', current_date)::date,
      interval '1 month') as d
)
select
  t.ky,
  count(*) filter (where o.signed_on between t.dau_thang and t.cuoi_thang)      as ky_moi,
  count(*) filter (where o.completed_on between t.dau_thang and t.cuoi_thang)   as lap_xong,
  count(*) filter (where s.terminated_on between t.dau_thang and t.cuoi_thang)  as huy,
  count(*) filter (
    where o.signed_on <= t.cuoi_thang
      and (s.terminated_on is null or s.terminated_on > t.cuoi_thang)
  )                                                                             as luy_ke_chua_huy
from thang t
cross join subscription_snapshot s
left join install_order_snapshot o
       on o.source = 'FIXED' and o.source_id = s.source_id
where s.source = 'FIXED'
group by t.ky;

/** Kỳ cước theo tháng: đếm kỳ chứ không chỉ đếm tiền như v_fixed_monthly_total. */
drop view if exists v_fixed_month_fee;
create view v_fixed_month_fee as
select
  ky,
  count(*)                                              as so_ky,
  count(*) filter (where trang_thai = 'DA_THU')         as ky_da_thu,
  count(*) filter (where trang_thai = 'MIEN_PHI')       as ky_mien_phi,
  count(*) filter (where trang_thai = 'CHO_DUYET')      as ky_cho_duyet,
  count(*) filter (where trang_thai = 'GHI_CHU')        as ky_ghi_chu,
  count(*) filter (where trang_thai = 'NO')             as ky_chua_thu,
  sum(phai_thu)                                         as tien_phai_thu,
  sum(tien)                                             as tien_da_thu,
  sum(phai_thu) filter (where trang_thai = 'NO')        as tien_chua_thu,
  round(100.0 * count(*) filter (where trang_thai in ('DA_THU', 'MIEN_PHI'))
        / nullif(count(*), 0), 1)                       as ty_le_ky_xong
from v_fixed_contract_period
where not ngoai_ky_tinh
group by ky;

/** Một dòng một tháng, ghép vòng đời với cước. */
create view v_fixed_month as
select
  coalesce(f.ky, c.ky)                as ky,
  coalesce(f.ky_moi, 0)               as ky_moi,
  coalesce(f.lap_xong, 0)             as lap_xong,
  coalesce(f.huy, 0)                  as huy,
  coalesce(f.luy_ke_chua_huy, 0) as luy_ke_chua_huy,
  c.so_ky, c.ky_da_thu, c.ky_mien_phi, c.ky_cho_duyet, c.ky_ghi_chu,
  c.ky_chua_thu, c.tien_phai_thu, c.tien_da_thu, c.tien_chua_thu,
  c.ty_le_ky_xong
from v_fixed_month_flow f
full join v_fixed_month_fee c on c.ky = f.ky;
