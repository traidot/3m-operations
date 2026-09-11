-- Kỳ cước bên nguồn ghi dạng YYYY-MM nên không chia nhỏ hơn tháng được. Nhưng
-- NGÀY THU thì có đủ ở cả 3.140 dòng, nên dòng tiền vào chia theo ngày được.
--
-- Hai câu hỏi khác nhau, đừng lẫn:
--   theo kỳ cước  — tháng đó đáng lẽ thu bao nhiêu, đã xong bao nhiêu
--   theo ngày thu — hôm đó thực sự nhận về bao nhiêu, của kỳ nào cũng tính

drop function if exists fixed_collection_report(text, date, date);
create function fixed_collection_report(
  p_don_vi text default 'ngay',
  p_tu     date default null,
  p_den    date default null
)
returns table (
  ky           text,
  so_ky        bigint,
  ky_duyet     bigint,
  ky_mien_phi  bigint,
  ky_cho_duyet bigint,
  ky_ghi_chu   bigint,
  so_hop_dong  bigint,
  tien_thu     numeric
)
language sql stable as $$
  select
    case when p_don_vi = 'ngay' then to_char(f.paid_at, 'YYYY-MM-DD')
         else to_char(f.paid_at, 'YYYY-MM') end                      as ky,
    count(*)                                                         as so_ky,
    count(*) filter (where f.status = 'APPROVED' and not f.is_free)  as ky_duyet,
    count(*) filter (where f.is_free)                                as ky_mien_phi,
    count(*) filter (where f.status = 'PENDING_APPROVAL')            as ky_cho_duyet,
    count(*) filter (where f.status = 'NOTE_ONLY')                   as ky_ghi_chu,
    count(distinct f.subscription_source_id)                         as so_hop_dong,
    coalesce(sum(f.amount) filter (where not f.is_free), 0)          as tien_thu
  from fee_period_snapshot f
  where f.source = 'FIXED'
    and f.paid_at is not null
    and (p_tu  is null or f.paid_at::date >= p_tu)
    and (p_den is null or f.paid_at::date <= p_den)
  group by 1
  order by 1;
$$;

/** Tiền về theo kênh thu, cho một khoảng ngày. */
drop function if exists fixed_channel_report(date, date);
create function fixed_channel_report(p_tu date default null, p_den date default null)
returns table (kenh text, so_ky bigint, tien numeric)
language sql stable as $$
  select coalesce(nullif(trim(f.channel), ''), 'không ghi kênh') as kenh,
         count(*) as so_ky,
         coalesce(sum(f.amount) filter (where not f.is_free), 0) as tien
  from fee_period_snapshot f
  where f.source = 'FIXED'
    and f.paid_at is not null
    and (p_tu  is null or f.paid_at::date >= p_tu)
    and (p_den is null or f.paid_at::date <= p_den)
  group by 1
  order by tien desc;
$$;
