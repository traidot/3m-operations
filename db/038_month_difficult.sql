-- Bảng cước theo kỳ thiếu cột khách khó đòi, trong khi báo cáo bên CMS có.
-- Đếm theo hợp đồng chứ không theo kỳ: một hợp đồng khó đòi chỉ tính một lần
-- trong tháng dù có mấy dòng cước.

drop view if exists v_fixed_month;
drop view if exists v_fixed_month_fee;
create view v_fixed_month_fee as
select
  p.ky,
  count(*)                                                as so_ky,
  count(*) filter (where p.trang_thai = 'DA_THU')         as ky_da_thu,
  count(*) filter (where p.trang_thai = 'MIEN_PHI')       as ky_mien_phi,
  count(*) filter (where p.trang_thai = 'CHO_DUYET')      as ky_cho_duyet,
  count(*) filter (where p.trang_thai = 'GHI_CHU')        as ky_ghi_chu,
  count(*) filter (where p.trang_thai = 'NO')             as ky_chua_thu,
  count(distinct p.subscription_id) filter (where s.is_difficult_debt) as hop_dong_kho_doi,
  sum(p.phai_thu)                                         as tien_phai_thu,
  sum(p.tien)                                             as tien_da_thu,
  sum(p.phai_thu) filter (where p.trang_thai = 'NO')      as tien_chua_thu,
  round(100.0 * count(*) filter (where p.trang_thai in ('DA_THU', 'MIEN_PHI'))
        / nullif(count(*), 0), 1)                         as ty_le_ky_xong
from v_fixed_contract_period p
join subscription_snapshot s
  on s.source = 'FIXED' and s.source_id = p.subscription_id
where not p.ngoai_ky_tinh
group by p.ky;

create view v_fixed_month as
select
  coalesce(f.ky, c.ky)                as ky,
  coalesce(f.ky_moi, 0)               as ky_moi,
  coalesce(f.lap_xong, 0)             as lap_xong,
  coalesce(f.huy, 0)                  as huy,
  coalesce(f.luy_ke_chua_huy, 0)      as luy_ke_chua_huy,
  c.so_ky, c.ky_da_thu, c.ky_mien_phi, c.ky_cho_duyet, c.ky_ghi_chu,
  c.ky_chua_thu, c.hop_dong_kho_doi,
  c.tien_phai_thu, c.tien_da_thu, c.tien_chua_thu,
  c.ty_le_ky_xong
from v_fixed_month_flow f
full join v_fixed_month_fee c on c.ky = f.ky;
