-- Tổng hợp tình trạng lắp đặt wifi cố định.
--
-- Hai lớp, vì hai câu hỏi khác nhau:
--   1. Tồn hiện tại — đơn nào đang chờ lắp, chờ bao lâu rồi. Đây là việc phải làm.
--   2. Cohort theo THÁNG KÝ — trong số đơn ký tháng đó, bao nhiêu đã lắp, bao
--      nhiêu huỷ trước khi lắp, bao nhiêu còn treo, và mất bao lâu để lắp xong.
--      Gom theo tháng ký chứ không theo tháng lắp: chỉ có cách đó mới thấy được
--      tỉ lệ thành công và thời gian chờ của từng đợt bán.
--
-- Trung vị ký→lắp toàn hệ thống là 37 ngày, p90 59 ngày. Ngưỡng "chờ lắp lâu"
-- trong bảng threshold đang để 60 ngày, khớp với p90 — đơn quá mốc đó là bất
-- thường thật chứ không phải nhịp bình thường.

create or replace view v_fixed_install_month as
select to_char(c.ngay_ky, 'YYYY-MM')                                   as ky_ky,
       c.do_cong_ty,
       count(*)                                                        as so_don,
       count(*) filter (where c.trang_thai_lap_dat = 'DONE')           as lap_xong,
       count(*) filter (where c.trang_thai_lap_dat = 'SURVEY'
                          and c.trang_thai_hop_dong <> 'TERMINATED')   as cho_lap,
       count(*) filter (where c.trang_thai_lap_dat = 'SURVEY'
                          and c.trang_thai_hop_dong = 'TERMINATED')    as huy_truoc_lap,
       count(*) filter (where c.trang_thai_lap_dat = 'FAILED')         as lap_hong,
       count(*) filter (where c.trang_thai_lap_dat = 'DONE'
                          and c.trang_thai_hop_dong = 'TERMINATED')    as lap_roi_huy,
       round(100.0 * count(*) filter (where c.trang_thai_lap_dat = 'DONE')
             / nullif(count(*), 0), 1)                                 as ty_le_lap,
       percentile_cont(0.5) within group (
         order by c.ngay_lap_xong - c.ngay_ky
       ) filter (where c.trang_thai_lap_dat = 'DONE'
                   and c.ngay_lap_xong >= c.ngay_ky)                   as ngay_trung_vi
  from v_fixed_contract c
 where c.ngay_ky is not null
 group by 1, 2;

comment on view v_fixed_install_month is
  'Đơn wifi cố định gom theo tháng ký: đã lắp, còn chờ, huỷ trước khi lắp, và số ngày chờ trung vị';

/** Đơn đang chờ lắp, chia theo đã chờ bao lâu. */
create or replace view v_fixed_install_pending as
select c.do_cong_ty,
       case when current_date - c.ngay_ky <= 7  then '1. dưới 1 tuần'
            when current_date - c.ngay_ky <= 30 then '2. 1–4 tuần'
            when current_date - c.ngay_ky <= 60 then '3. 1–2 tháng'
            else '4. quá 2 tháng' end                                  as nhom_cho,
       count(*)                                                        as so_don,
       min(c.ngay_ky)                                                  as ky_som_nhat
  from v_fixed_contract c
 where c.trang_thai_lap_dat = 'SURVEY'
   and c.trang_thai_hop_dong <> 'TERMINATED'
   and c.ngay_ky is not null
 group by 1, 2;

/** Danh sách đơn của một tháng ký, cho ngăn kéo và tệp Excel. */
create or replace function fixed_install_cohort(p_ky text)
returns table (
  subscription_id text, ma_hop_dong text, dia_chi text, do_cong_ty boolean,
  nguoi_tao text, trang_thai_lap_dat text, trang_thai_hop_dong text,
  ngay_ky date, ngay_lap_xong date, ngay_huy date, so_ngay_cho int,
  ly_do_huy text, nhom_ly_do_huy text, tinh_huong text, link_cms text
) language sql stable as $$
  select c.subscription_id, c.contract_code, c.dia_chi, c.do_cong_ty,
         c.nguoi_nhap, c.trang_thai_lap_dat, c.trang_thai_hop_dong,
         c.ngay_ky, c.ngay_lap_xong, c.ngay_huy,
         coalesce(c.ngay_lap_xong, current_date) - c.ngay_ky,
         c.ly_do_huy, c.nhom_ly_do_huy,
         case when c.trang_thai_lap_dat = 'FAILED'                        then 'LAP_HONG'
              when c.trang_thai_lap_dat = 'DONE'
               and c.trang_thai_hop_dong = 'TERMINATED'                   then 'LAP_ROI_HUY'
              when c.trang_thai_lap_dat = 'DONE'                          then 'DA_LAP'
              when c.trang_thai_hop_dong = 'TERMINATED'                   then 'HUY_TRUOC_LAP'
              else 'CHO_LAP' end,
         contract_url(c.subscription_id)
    from v_fixed_contract c
   where c.ngay_ky is not null and to_char(c.ngay_ky, 'YYYY-MM') = p_ky
$$;
