-- Hai lỗ hổng của lớp phán:
--
--  1. Bấm "đã xử lý" mà vấn đề còn thì lượt sau nó quay lại thành DÒNG MỚI —
--     first_seen_on về hôm nay, times_reported về 1. Bấm mỗi ngày thì việc nào
--     cũng trông như mới phát sinh, và cột "nhắc lại nhiều lần" thành vô dụng.
--
--  2. "Bỏ qua vĩnh viễn" không gỡ được, bấm nhầm là phải vào sửa bằng SQL.
--
-- Cách sửa: mỗi vấn đề chỉ một dòng suốt đời. Đóng rồi mở lại là đổi trạng
-- thái trên chính dòng đó, giữ nguyên ngày phát hiện đầu tiên.

alter table finding
  add column if not exists reopened_count   int  not null default 0,
  add column if not exists last_resolved_on date;

-- Gộp các dòng trùng fingerprint đã sinh ra trước khi sửa: giữ dòng cũ nhất,
-- cộng dồn số lần nhắc, lấy trạng thái của dòng mới nhất.
with xep as (
  select id, fingerprint,
         row_number() over (partition by fingerprint order by first_seen_on, created_at) as thu_tu,
         count(*)      over (partition by fingerprint) as so_dong,
         sum(times_reported) over (partition by fingerprint) as tong_nhac,
         first_value(status)       over (partition by fingerprint order by created_at desc) as trang_thai_moi,
         max(last_seen_on)  over (partition by fingerprint) as thay_lan_cuoi
    from finding
),
giu as (
  select * from xep where thu_tu = 1 and so_dong > 1
)
update finding f
   set times_reported = g.tong_nhac,
       status         = g.trang_thai_moi,
       last_seen_on   = g.thay_lan_cuoi,
       reopened_count = g.so_dong - 1
  from giu g where f.id = g.id;

delete from finding f
 using (
   select id, row_number() over (partition by fingerprint order by first_seen_on, created_at) as thu_tu
     from finding
 ) x
 where x.id = f.id and x.thu_tu > 1;

drop index if exists finding_open_unique;
create unique index if not exists finding_fingerprint_unique on finding (fingerprint);

/**
 * Ghi nhận một phán quyết. Một vấn đề chỉ một dòng suốt đời.
 * Vấn đề đã đóng mà tái diễn thì mở lại chính dòng đó, giữ nguyên ngày phát
 * hiện đầu tiên — nhờ vậy bấm "đã xử lý" không xoá được tuổi của nó.
 * Vấn đề đã đánh bỏ qua thì im lặng, không báo lại.
 */
create or replace function upsert_finding(
  p_rule_key     text,
  p_subject_type text,
  p_subject_id   text,
  p_severity     text,
  p_title        text,
  p_evidence     jsonb,
  p_action       text,
  p_metabase_url text,
  p_today        date default current_date
) returns uuid language plpgsql as $$
declare
  v_fp text := p_rule_key || ':' || coalesce(p_subject_id, 'global');
  v_id uuid;
begin
  if exists (select 1 from finding where fingerprint = v_fp and status = 'IGNORED') then
    return null;
  end if;

  insert into finding (fingerprint, rule_key, subject_type, subject_id, severity,
                       title, evidence, action, metabase_url,
                       first_seen_on, last_seen_on)
  values (v_fp, p_rule_key, p_subject_type, p_subject_id, p_severity,
          p_title, p_evidence, p_action, p_metabase_url,
          p_today, p_today)
  on conflict (fingerprint) do update set
    last_seen_on   = excluded.last_seen_on,
    times_reported = finding.times_reported + 1,
    severity       = excluded.severity,
    evidence       = excluded.evidence,
    title          = excluded.title,
    action         = excluded.action,
    -- Đóng rồi mà thấy lại thì mở lại, đếm số lần tái diễn.
    reopened_count = finding.reopened_count
                     + case when finding.status = 'RESOLVED' then 1 else 0 end,
    status         = case when finding.status = 'RESOLVED' then 'OPEN' else finding.status end,
    resolved_on    = case when finding.status = 'RESOLVED' then null else finding.resolved_on end,
    updated_at     = now()
  returning id into v_id;

  return v_id;
end $$;

create or replace function auto_resolve_findings(
  p_rule_key text,
  p_still_open text[],
  p_today date default current_date
) returns int language sql as $$
  with closed as (
    update finding
       set status = 'RESOLVED', resolved_on = p_today,
           last_resolved_on = p_today, updated_at = now()
     where rule_key = p_rule_key
       and status in ('OPEN','ACKNOWLEDGED')
       and not (fingerprint = any (p_still_open))
    returning 1
  )
  select count(*)::int from closed;
$$;

/** Gỡ đánh dấu bỏ qua. Trả về RESOLVED để lượt chạy sau tự quyết định. */
create or replace function unignore_finding(p_id uuid)
returns void language sql as $$
  update finding
     set status = 'RESOLVED', resolved_on = current_date, note = null, updated_at = now()
   where id = p_id and status = 'IGNORED';
$$;

drop view if exists finding_digest;
create view finding_digest as
select
  f.*,
  (f.first_seen_on = current_date)                          as la_moi,
  (current_date - f.first_seen_on)                          as so_ngay_ton,
  case
    when f.first_seen_on = current_date then 'moi'
    when f.times_reported >= 3          then 'nhac_lai_nhieu_lan'
    else 'dang_ton'
  end                                                        as nhom
from finding f
where f.status in ('OPEN','ACKNOWLEDGED')
order by
  case f.severity when 'CRITICAL' then 1 when 'WARN' then 2 else 3 end,
  f.first_seen_on;
