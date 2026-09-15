-- Wifi cố định: so hợp đồng đang chạy với hợp đồng thật sự có kỳ cước trong sổ.
--
-- Giống cách làm bên cầm tay, nhưng chiều tách khác: mảng cố định chỉ có một
-- gói (ONE_YEAR, 6.686 hợp đồng) nên tách theo gói vô nghĩa. Cái đáng nhìn là
-- khoảng hụt giữa số hợp đồng đang chạy và số hợp đồng ra được kỳ cước.
--
-- "Đang chạy trong tháng" = đã lắp xong trước hết tháng và chưa huỷ trước đầu
-- tháng. Không dùng ngày bắt đầu thu, vì hợp đồng thiếu giá cước thì không có
-- ngày đó — mà đó chính là nhóm cần thấy.
--
-- Tháng 9/2026: 3.091 đã lắp chưa huỷ, 574 có kỳ trong sổ, 2.315 thiếu giá cước.

create or replace view v_fixed_month_chay as
with moc as (
  select to_char(d, 'YYYY-MM') as ky, d::date as d1,
         (d + interval '1 month - 1 day')::date as d2
    from generate_series(
           (select min(date_trunc('month', ngay_lap_xong)) from v_fixed_contract
             where ngay_lap_xong is not null),
           date_trunc('month', current_date), '1 mon') d
),
so as (
  select period as ky, count(distinct subscription_source_id) as co_ky
    from fee_period_snapshot where source = 'FIXED' group by 1
)
select m.ky,
       count(c.subscription_id)                                   as da_lap_chua_huy,
       count(c.subscription_id) filter (
         where c.cuoc_thang is null or c.cuoc_thang = 0 or c.fee_start_on is null
       )                                                          as thieu_gia_cuoc,
       coalesce(so.co_ky, 0)                                      as co_ky_cuoc,
       count(c.subscription_id) - coalesce(so.co_ky, 0)           as chenh
  from moc m
  left join v_fixed_contract c
    on c.trang_thai_lap_dat = 'DONE'
   and c.ngay_lap_xong <= m.d2
   and (c.ngay_huy is null or c.ngay_huy >= m.d1)
  left join so on so.ky = m.ky
 group by m.ky, so.co_ky;

comment on view v_fixed_month_chay is
  'Hợp đồng wifi cố định đang chạy từng tháng, so với số có kỳ cước trong sổ';

/** Danh sách hợp đồng của một tháng, cho ngăn kéo và tệp Excel. */
create or replace function fixed_month_contracts(p_ky text)
returns table (
  subscription_id text, ma_hop_dong text, dia_chi text, trang_thai_hop_dong text,
  ngay_lap_xong date, ngay_huy date, cuoc_thang numeric, bat_dau_thu date,
  dang_chay boolean, co_ky_cuoc boolean, thieu_gia boolean,
  trang_thai_ky text, phai_thu numeric, da_thu numeric, kho_doi boolean, link_cms text
) language sql stable as $$
  with moc as (
    select to_date(p_ky, 'YYYY-MM') as d1,
           (to_date(p_ky, 'YYYY-MM') + interval '1 month - 1 day')::date as d2
  ),
  so as (
    select distinct subscription_source_id as sid
      from fee_period_snapshot where source = 'FIXED' and period = p_ky
  )
  select c.subscription_id, c.contract_code, c.dia_chi, c.trang_thai_hop_dong,
         c.ngay_lap_xong, c.ngay_huy, c.cuoc_thang, c.fee_start_on,
         (c.trang_thai_lap_dat = 'DONE' and c.ngay_lap_xong <= m.d2
          and (c.ngay_huy is null or c.ngay_huy >= m.d1))            as dang_chay,
         so.sid is not null                                          as co_ky_cuoc,
         (c.cuoc_thang is null or c.cuoc_thang = 0 or c.fee_start_on is null) as thieu_gia,
         p.trang_thai, p.phai_thu, p.tien, c.kho_doi,
         contract_url(c.subscription_id)
    from v_fixed_contract c
    cross join moc m
    left join so on so.sid = c.subscription_id
    left join v_fixed_contract_period p
           on p.subscription_id = c.subscription_id and p.ky = p_ky
   where so.sid is not null
      or (c.trang_thai_lap_dat = 'DONE' and c.ngay_lap_xong <= m.d2
          and (c.ngay_huy is null or c.ngay_huy >= m.d1))
$$;
