-- Đại lý không có chuyện thu cước, chặn ngay ở chỗ sinh kỳ.
--
-- Hợp đồng do đại lý mở thì đại lý tự thu, 3M không thu đồng nào. Hiện dữ liệu
-- gần như đã tự đúng (đại lý không được đặt giá nên không sinh kỳ), nhưng có
-- đúng 1 hợp đồng đại lý lọt qua với 5 dòng sổ, 4.000 yên. Đặt luật ở gốc thì
-- sau này nhập nhầm giá cho hợp đồng đại lý cũng không đẻ ra nợ ảo.
--
-- Không dùng được v_fixed_contract_owner ở đây: nó đọc v_fixed_contract, mà
-- v_fixed_contract lại đọc v_fixed_expected_fee qua v_fixed_debt — vòng tròn.
-- Nên suy cờ thẳng từ subscription_snapshot.

create or replace view v_fixed_sub_owner as
select s.source_id as subscription_id,
       exists (select 1 from fixed_company_staff cs
                where cs.ten = lower(btrim(coalesce(nv.display_name, s.created_by_src, '')))) as do_cong_ty
  from subscription_snapshot s
  left join staff_snapshot nv
         on nv.source = 'FIXED' and nv.source_id = s.created_by_src
 where s.source = 'FIXED';

comment on view v_fixed_sub_owner is
  'Hợp đồng wifi cố định do công ty phụ trách hay đại lý, suy từ người tạo — dùng được ở tầng dưới v_fixed_contract';

create or replace view v_fixed_expected_fee as
select s.source,
       s.source_id                     as subscription_id,
       s.source_customer_id            as contract_code,
       to_char(thang.thang, 'YYYY-MM') as ky,
       s.monthly_price                 as phai_thu
  from subscription_snapshot s
  join install_order_snapshot o on o.source = 'FIXED' and o.source_id = s.source_id
  -- Đại lý tự thu: không sinh kỳ, không có nợ, không vào danh sách đi thu.
  join v_fixed_sub_owner w on w.subscription_id = s.source_id and w.do_cong_ty
 cross join lateral generate_series(
        date_trunc('month', s.fee_start_on::timestamptz),
        date_trunc('month', least(coalesce(s.fee_end_on, current_date), current_date)::timestamptz),
        '1 mon'::interval) thang(thang)
 where s.source = 'FIXED' and o.status = 'DONE'
   and s.fee_start_on is not null and s.monthly_price > 0;

-- "Có kỳ cước" cũng chỉ đếm phần công ty, cho khớp với cột bên cạnh.
drop view if exists v_fixed_month_chay;
create view v_fixed_month_chay as
with moc as (
  select to_char(d, 'YYYY-MM') as ky, d::date as d1,
         (d + interval '1 month - 1 day')::date as d2
    from generate_series(
           (select min(date_trunc('month', ngay_lap_xong)) from v_fixed_contract
             where ngay_lap_xong is not null),
           date_trunc('month', current_date), '1 mon') d
),
so as (
  select f.period as ky, count(distinct f.subscription_source_id) as co_ky
    from fee_period_snapshot f
    join v_fixed_sub_owner w on w.subscription_id = f.subscription_source_id and w.do_cong_ty
   where f.source = 'FIXED'
   group by 1
)
select m.ky,
       count(c.subscription_id) filter (where o.do_cong_ty)          as cong_ty,
       count(c.subscription_id) filter (where not o.do_cong_ty)      as dai_ly,
       coalesce(so.co_ky, 0)                                         as co_ky_cuoc,
       count(c.subscription_id) filter (
         where o.do_cong_ty
           and (c.cuoc_thang is null or c.cuoc_thang = 0 or c.fee_start_on is null)
       )                                                             as thieu_gia_cuoc,
       count(c.subscription_id) filter (where o.do_cong_ty) - coalesce(so.co_ky, 0) as chenh
  from moc m
  left join v_fixed_contract c
    on c.trang_thai_lap_dat = 'DONE'
   and c.ngay_lap_xong <= m.d2
   and (c.ngay_huy is null or c.ngay_huy >= m.d1)
  left join v_fixed_contract_owner o on o.subscription_id = c.subscription_id
  left join so on so.ky = m.ky
 group by m.ky, so.co_ky;
