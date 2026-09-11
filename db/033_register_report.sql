-- Báo cáo tổng hợp đăng ký, dựng lại đúng cách chia của CMS nguồn để hai bên
-- đối chiếu được. Nhóm theo ngày hay theo tháng đều dùng chung một hàm.
--
-- Cách chia huỷ, đã đối chiếu khớp từng tháng với báo cáo bên CMS:
--   trước khi có lịch  cancel_timing = BEFORE_SCHEDULE, hoặc không ghi mốc
--   sau khi có lịch    AFTER_SCHEDULE mà chưa từng lắp xong
--   sau khi lắp xong   AFTER_SCHEDULE và đã có ngày lắp xong
--
-- Mốc thời gian là NGÀY KÝ (entryDate), nên một hợp đồng ký tháng 3 huỷ tháng
-- 7 vẫn nằm ở dòng tháng 3 — đây là báo cáo theo lứa đăng ký, không phải theo
-- ngày xảy ra sự việc.

drop function if exists fixed_register_report(text, date, date);
create function fixed_register_report(
  p_don_vi text default 'thang',   -- 'ngay' hoặc 'thang'
  p_tu     date default null,
  p_den    date default null
)
returns table (
  ky              text,
  dang_ky_lan_dau bigint,
  dang_ky_lai     bigint,
  dang_ky         bigint,
  huy_truoc_lich  bigint,
  huy_sau_lich    bigint,
  huy_sau_lap     bigint,
  huy             bigint,
  ty_le_huy       numeric,
  con_lai         bigint,
  co_lich_lap     bigint,
  chua_co_lich    bigint,
  lap_xong        bigint,
  lap_that_bai    bigint
)
language sql stable as $$
  select
    case when p_don_vi = 'ngay' then to_char(o.signed_on, 'YYYY-MM-DD')
         else to_char(o.signed_on, 'YYYY-MM') end                         as ky,
    count(*) filter (where not coalesce(s.is_renewal, false))             as dang_ky_lan_dau,
    count(*) filter (where s.is_renewal)                                  as dang_ky_lai,
    count(*)                                                              as dang_ky,
    count(*) filter (where huy and s.cancel_timing is distinct from 'AFTER_SCHEDULE')
                                                                          as huy_truoc_lich,
    count(*) filter (where huy and s.cancel_timing = 'AFTER_SCHEDULE'
                           and o.completed_on is null)                    as huy_sau_lich,
    count(*) filter (where huy and s.cancel_timing = 'AFTER_SCHEDULE'
                           and o.completed_on is not null)                as huy_sau_lap,
    count(*) filter (where huy)                                           as huy,
    round(100.0 * count(*) filter (where huy) / nullif(count(*), 0), 2)   as ty_le_huy,
    count(*) filter (where not huy)                                       as con_lai,
    count(*) filter (where not huy and o.status = 'SURVEY'
                           and o.scheduled_at is not null)                as co_lich_lap,
    count(*) filter (where not huy and o.status = 'SURVEY'
                           and o.scheduled_at is null)                    as chua_co_lich,
    count(*) filter (where not huy and o.status = 'DONE')                 as lap_xong,
    count(*) filter (where not huy and o.status = 'FAILED')               as lap_that_bai
  from install_order_snapshot o
  join subscription_snapshot s
    on s.source = 'FIXED' and s.source_id = o.source_id
  cross join lateral (select s.status = 'TERMINATED' as huy) t
  where o.source = 'FIXED'
    and o.signed_on is not null
    and (p_tu  is null or o.signed_on >= p_tu)
    and (p_den is null or o.signed_on <= p_den)
  group by 1
  order by 1;
$$;
