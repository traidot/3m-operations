-- Dựng lại màn hình lắp đặt theo đúng cách chia của báo cáo tổng hợp bên CMS,
-- để hai bên đọc ra cùng một con số.
--
-- CMS chia một đơn thành đúng bảy tình huống loại trừ nhau:
--   huỷ trước khi có lịch lắp · huỷ sau khi có lịch · huỷ sau khi lắp xong
--   còn lại: có lịch lắp · chưa có lịch lắp · lắp đặt thành công · lắp đặt thất bại
-- "Còn lại sau khi trừ huỷ" là tổng bốn tình huống sau.
--
-- Cách chia huỷ giống hệt fixed_register_report (033) — cùng một nguồn, cùng một
-- quy tắc, khác mỗi chỗ view này còn tách công ty / đại lý và đo số ngày chờ.
-- Sửa quy tắc thì phải sửa cả hai chỗ.

/** Bảy tình huống của một đơn lắp. Một chỗ duy nhất, cho view và cho danh sách. */
create or replace function fixed_install_tinh_huong(
  p_huy boolean, p_cancel_timing text, p_status text,
  p_co_lich boolean, p_da_lap_xong boolean
) returns text language sql immutable as $$
  select case
    when p_huy and p_cancel_timing is distinct from 'AFTER_SCHEDULE' then 'HUY_TRUOC_LICH'
    when p_huy and not p_da_lap_xong                                 then 'HUY_SAU_LICH'
    when p_huy                                                       then 'HUY_SAU_LAP'
    when p_status = 'DONE'                                           then 'LAP_XONG'
    when p_status = 'FAILED'                                         then 'LAP_HONG'
    when p_co_lich                                                   then 'CO_LICH'
    else 'CHUA_CO_LICH' end;
$$;

/** Đơn lắp đã gắn chủ (công ty / đại lý) và đã phân loại tình huống. */
create or replace view v_fixed_install_don as
select o.source_id                                     as subscription_id,
       o.signed_on                                     as ngay_ky,
       o.scheduled_at::date                            as ngay_hen,
       o.completed_on                                  as ngay_lap_xong,
       coalesce(ow.do_cong_ty, false)                  as do_cong_ty,
       coalesce(s.is_renewal, false)                   as dang_ky_lai,
       fixed_install_tinh_huong(
         s.status = 'TERMINATED', s.cancel_timing, o.status,
         o.scheduled_at is not null, o.completed_on is not null)     as tinh_huong
  from install_order_snapshot o
  join subscription_snapshot s
    on s.source = 'FIXED' and s.source_id = o.source_id
  left join v_fixed_sub_owner ow on ow.subscription_id = o.source_id
 where o.source = 'FIXED'
   and o.signed_on is not null;

comment on view v_fixed_install_don is
  'Đơn lắp wifi cố định, mỗi đơn một tình huống theo cách chia của báo cáo tổng hợp CMS';

/** Cohort theo tháng ký, cột giống báo cáo tổng hợp CMS. */
drop view if exists v_fixed_install_month;
create view v_fixed_install_month as
select to_char(d.ngay_ky, 'YYYY-MM')                              as ky_ky,
       d.do_cong_ty,
       count(*) filter (where not d.dang_ky_lai)                  as dang_ky_lan_dau,
       count(*) filter (where d.dang_ky_lai)                      as dang_ky_lai,
       count(*)                                                   as so_don,
       count(*) filter (where d.tinh_huong = 'HUY_TRUOC_LICH')    as huy_truoc_lich,
       count(*) filter (where d.tinh_huong = 'HUY_SAU_LICH')      as huy_sau_lich,
       count(*) filter (where d.tinh_huong = 'HUY_SAU_LAP')       as huy_sau_lap,
       count(*) filter (where d.tinh_huong like 'HUY\_%')         as huy,
       round(100.0 * count(*) filter (where d.tinh_huong like 'HUY\_%')
             / nullif(count(*), 0), 1)                            as ty_le_huy,
       count(*) filter (where d.tinh_huong not like 'HUY\_%')     as con_lai,
       count(*) filter (where d.tinh_huong = 'CO_LICH')           as co_lich,
       count(*) filter (where d.tinh_huong = 'CHUA_CO_LICH')      as chua_co_lich,
       count(*) filter (where d.tinh_huong = 'LAP_XONG')          as lap_xong,
       count(*) filter (where d.tinh_huong = 'LAP_HONG')          as lap_hong,
       percentile_cont(0.5) within group (
         order by d.ngay_lap_xong - d.ngay_ky
       ) filter (where d.ngay_lap_xong >= d.ngay_ky)              as ngay_trung_vi
  from v_fixed_install_don d
 group by 1, 2;

comment on view v_fixed_install_month is
  'Đơn wifi cố định gom theo tháng ký, chia cột như báo cáo tổng hợp CMS';

/** Mã nhóm chờ. Dưới 2 tháng chia theo tuần, từ 2 tháng trở đi chia theo tháng —
    đuôi chờ lâu mới là phần phải xử lý nên không dồn chung một rổ. */
create or replace function fixed_install_nhom_cho(p_ngay int)
returns text language sql immutable as $$
  select case when p_ngay <= 7   then '01'
              when p_ngay <= 30  then '02'
              when p_ngay <= 60  then '03'
              when p_ngay >  360 then '14'
              else to_char(ceil(p_ngay / 30.0) + 1, 'FM00') end;
$$;

create or replace function fixed_install_ten_nhom(p_ma text)
returns text language sql immutable as $$
  select case p_ma when '01' then 'dưới 1 tuần'
                   when '02' then '1–4 tuần'
                   when '03' then '1–2 tháng'
                   when '14' then 'quá 1 năm'
                   else format('%s–%s tháng', p_ma::int - 2, p_ma::int - 1) end;
$$;

/** Đơn chưa lắp và chưa huỷ, chia theo đã có lịch chưa và đã chờ bao lâu. */
drop view if exists v_fixed_install_pending;
create view v_fixed_install_pending as
select d.do_cong_ty,
       d.tinh_huong = 'CO_LICH'                                   as co_lich,
       fixed_install_nhom_cho((current_date - d.ngay_ky)::int)     as ma_nhom,
       count(*)                                                   as so_don,
       min(d.ngay_ky)                                             as ky_som_nhat
  from v_fixed_install_don d
 where d.tinh_huong in ('CO_LICH', 'CHUA_CO_LICH')
 group by 1, 2, 3;

comment on view v_fixed_install_pending is
  'Đơn wifi cố định đang chờ lắp, chia theo có lịch lắp chưa và đã chờ bao lâu';

/** Danh sách đơn của một tháng ký, cho ngăn kéo và tệp Excel. */
drop function if exists fixed_install_cohort(text);
create function fixed_install_cohort(p_ky text)
returns table (
  subscription_id text, ma_hop_dong text, dia_chi text, do_cong_ty boolean,
  nguoi_tao text, trang_thai_lap_dat text, trang_thai_hop_dong text,
  ngay_ky date, ngay_hen date, ngay_lap_xong date, ngay_huy date, so_ngay_cho int,
  ly_do_huy text, nhom_ly_do_huy text, tinh_huong text, link_cms text
) language sql stable as $$
  select c.subscription_id, c.contract_code, c.dia_chi, d.do_cong_ty,
         c.nguoi_nhap, c.trang_thai_lap_dat, c.trang_thai_hop_dong,
         d.ngay_ky, d.ngay_hen, d.ngay_lap_xong, c.ngay_huy,
         (coalesce(d.ngay_lap_xong, current_date) - d.ngay_ky)::int,
         c.ly_do_huy, c.nhom_ly_do_huy, d.tinh_huong,
         contract_url(c.subscription_id)
    from v_fixed_install_don d
    join v_fixed_contract c on c.subscription_id = d.subscription_id
   where to_char(d.ngay_ky, 'YYYY-MM') = p_ky
$$;

/** Danh sách đơn đang chờ lắp; p_nhom rỗng là lấy tất cả. */
drop function if exists fixed_install_pending_list(text);
create function fixed_install_pending_list(p_nhom text)
returns table (
  subscription_id text, ma_hop_dong text, dia_chi text, do_cong_ty boolean,
  nguoi_tao text, trang_thai_lap_dat text, trang_thai_hop_dong text,
  ngay_ky date, ngay_hen date, ngay_lap_xong date, ngay_huy date, so_ngay_cho int,
  ly_do_huy text, nhom_ly_do_huy text, tinh_huong text, link_cms text
) language sql stable as $$
  select c.subscription_id, c.contract_code, c.dia_chi, d.do_cong_ty,
         c.nguoi_nhap, c.trang_thai_lap_dat, c.trang_thai_hop_dong,
         d.ngay_ky, d.ngay_hen, d.ngay_lap_xong, c.ngay_huy,
         (current_date - d.ngay_ky)::int,
         c.ly_do_huy, c.nhom_ly_do_huy, d.tinh_huong,
         contract_url(c.subscription_id)
    from v_fixed_install_don d
    join v_fixed_contract c on c.subscription_id = d.subscription_id
   where d.tinh_huong in ('CO_LICH', 'CHUA_CO_LICH')
     and (p_nhom = ''
          or fixed_install_nhom_cho((current_date - d.ngay_ky)::int) = p_nhom)
$$;
