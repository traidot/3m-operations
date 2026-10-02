-- Bảng tổng hợp theo ngày rút từ 30 xuống 7 ngày.
--
-- Mỗi dòng có 14 cột số, nên 30 dòng là một bức tường số: muốn so hôm nay với
-- hôm qua phải lia mắt qua cả màn hình. Hình dạng cả tháng đã có biểu đồ ở mục
-- trên lo, bảng này chỉ cần phần đọc kỹ.

create or replace view v_bao_cao_tong_hop_ngay as
with ngay as (
  select generate_series(current_date - 6, current_date, interval '1 day')::date as ngay
),
hd as (
  select io.signed_on                        as ngay,
         coalesce(s.is_renewal, false)       as dang_ky_lai,
         s.status = 'TERMINATED'             as huy,
         s.cancel_timing                     as moc_huy,
         io.status                           as lap,
         io.scheduled_at is not null         as co_lich
    from install_order_snapshot io
    join subscription_snapshot s
      on s.source = io.source and s.source_id = io.source_id
   where io.source = 'FIXED'
     and io.signed_on >= current_date - 6
),
-- Chưa huỷ thì xếp vào đúng một ô theo tình trạng lắp.
cho as (
  select h.*,
         not h.huy and h.lap = 'DONE'                                as xong,
         not h.huy and h.lap = 'FAILED'                              as that_bai,
         not h.huy and h.lap not in ('DONE', 'FAILED') and h.co_lich as cho_lap,
         not h.huy and h.lap not in ('DONE', 'FAILED') and not h.co_lich as chua_hen
    from hd h
)
select n.ngay,
       count(c.*) filter (where not c.dang_ky_lai)                   as lan_dau,
       count(c.*) filter (where c.dang_ky_lai)                       as dang_ky_lai,
       count(c.*)                                                    as tong_dang_ky,
       count(c.*) filter (where c.huy and c.moc_huy is distinct from 'AFTER_SCHEDULE')
                                                                     as huy_truoc_lich,
       count(c.*) filter (where c.huy and c.moc_huy = 'AFTER_SCHEDULE' and c.lap <> 'DONE')
                                                                     as huy_sau_lich,
       count(c.*) filter (where c.huy and c.moc_huy = 'AFTER_SCHEDULE' and c.lap = 'DONE')
                                                                     as huy_sau_lap,
       count(c.*) filter (where c.huy)                               as tong_huy,
       count(c.*) filter (where not c.huy)                           as con_lai,
       count(c.*) filter (where c.that_bai or c.cho_lap)             as co_lich_lap,
       count(c.*) filter (where c.chua_hen)                          as chua_co_lich,
       count(c.*) filter (where c.xong)                              as lap_xong,
       count(c.*) filter (where c.cho_lap)                           as co_lich_chua_lap,
       count(c.*) filter (where c.that_bai)                          as that_bai
  from ngay n
  left join cho c on c.ngay = n.ngay
 group by n.ngay;

comment on view v_bao_cao_tong_hop_ngay is
  'Báo cáo tổng hợp của CMS (/report/contracts) vỡ theo ngày, 7 ngày gần nhất';
