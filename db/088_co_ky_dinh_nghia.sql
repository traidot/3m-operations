-- Thống nhất "có kỳ cước" = hệ thống sinh được kỳ cho hợp đồng đó.
--
-- Đang có hai con số mang cùng một tên: 719 hợp đồng sinh được kỳ (có giá, có
-- ngày bắt đầu thu, đã lắp) và 574 hợp đồng có dòng thật trong sổ cước. Bảng
-- tháng hiện số đầu, cột chênh và ngăn kéo lại tính theo số sau — nhìn vào thấy
-- 881 − 719 mà chênh ghi 307.
--
-- Chọn nghĩa "sinh được kỳ": câu hỏi vận hành là hợp đồng đang chạy có ra được
-- kỳ để mà thu hay không. Còn đã ghi sổ tới đâu thì cột "còn thiếu" nói rồi.
-- Tháng 9/2026: 881 công ty đang chạy, 719 ra được kỳ, chênh 162.

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
  select ky, count(distinct subscription_id) as co_ky
    from v_fixed_expected_fee group by ky
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

drop function if exists fixed_month_contracts(text);
create function fixed_month_contracts(p_ky text)
returns table (
  subscription_id text, ma_hop_dong text, dia_chi text, trang_thai_hop_dong text,
  ngay_lap_xong date, ngay_huy date, cuoc_thang numeric, bat_dau_thu date,
  dang_chay boolean, co_ky_cuoc boolean, thieu_gia boolean, do_cong_ty boolean,
  nguoi_tao text, trang_thai_ky text, phai_thu numeric, da_thu numeric,
  kho_doi boolean, link_cms text
) language sql stable as $$
  with moc as (
    select to_date(p_ky, 'YYYY-MM') as d1,
           (to_date(p_ky, 'YYYY-MM') + interval '1 month - 1 day')::date as d2
  ),
  so as (
    select distinct subscription_id as sid from v_fixed_expected_fee where ky = p_ky
  )
  select c.subscription_id, c.contract_code, c.dia_chi, c.trang_thai_hop_dong,
         c.ngay_lap_xong, c.ngay_huy, c.cuoc_thang, c.fee_start_on,
         (c.trang_thai_lap_dat = 'DONE' and c.ngay_lap_xong <= m.d2
          and (c.ngay_huy is null or c.ngay_huy >= m.d1))            as dang_chay,
         so.sid is not null                                          as co_ky_cuoc,
         (c.cuoc_thang is null or c.cuoc_thang = 0 or c.fee_start_on is null) as thieu_gia,
         o.do_cong_ty, c.nguoi_nhap,
         p.trang_thai, p.phai_thu, p.tien, c.kho_doi,
         contract_url(c.subscription_id)
    from v_fixed_contract c
    cross join moc m
    join v_fixed_contract_owner o on o.subscription_id = c.subscription_id
    left join so on so.sid = c.subscription_id
    left join v_fixed_contract_period p
           on p.subscription_id = c.subscription_id and p.ky = p_ky
   where so.sid is not null
      or (c.trang_thai_lap_dat = 'DONE' and c.ngay_lap_xong <= m.d2
          and (c.ngay_huy is null or c.ngay_huy >= m.d1))
$$;
