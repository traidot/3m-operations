-- Trí nhớ của lớp phán.
-- Không có bảng này thì sáng nào agent cũng báo lại đúng những việc cũ,
-- và sau một tuần bản tin bị bỏ đọc.

create extension if not exists "pgcrypto";

create table finding (
  id              uuid primary key default gen_random_uuid(),

  -- Khoá ổn định để nhận ra "cùng một vấn đề" qua nhiều ngày.
  -- Quy ước: rule_key || ':' || coalesce(subject_id, 'global')
  fingerprint     text        not null,

  rule_key        text        not null,   -- view hoặc quy tắc sinh ra phán quyết này
  subject_type    text        not null,   -- subscription | invoice | customer | device | loan | global
  subject_id      text,                   -- null khi phán quyết ở mức toàn công ty

  severity        text        not null check (severity in ('CRITICAL','WARN','INFO')),
  title           text        not null,   -- một câu, nêu chuyện gì
  evidence        jsonb       not null,   -- số liệu chứng minh, do SQL sinh ra chứ không do agent bịa
  action          text,                   -- việc cần làm, null nếu chỉ để biết
  metabase_url    text,                   -- link xem sâu

  status          text        not null default 'OPEN'
                  check (status in ('OPEN','ACKNOWLEDGED','RESOLVED','IGNORED')),

  first_seen_on   date        not null,
  last_seen_on    date        not null,
  times_reported  int         not null default 1,
  resolved_on     date,
  note            text,                   -- lý do bỏ qua, hoặc ghi chú người xử

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Một vấn đề đang mở chỉ tồn tại một dòng. Đã xử hoặc bỏ qua rồi thì
-- cho phép mở lại thành dòng mới nếu nó tái diễn.
create unique index finding_open_unique
  on finding (fingerprint)
  where status in ('OPEN','ACKNOWLEDGED');

create index finding_status_severity on finding (status, severity, last_seen_on desc);
create index finding_subject         on finding (subject_type, subject_id);

-- Ghi nhận một phán quyết. Gặp lại vấn đề cũ thì chỉ cập nhật, không sinh dòng mới.
-- Vấn đề đã đánh IGNORED thì im lặng bỏ qua, không báo lại.
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
  on conflict (fingerprint) where status in ('OPEN','ACKNOWLEDGED')
  do update set
    last_seen_on   = excluded.last_seen_on,
    times_reported = finding.times_reported + 1,
    severity       = excluded.severity,
    evidence       = excluded.evidence,
    title          = excluded.title,
    action         = excluded.action,
    updated_at     = now()
  returning id into v_id;

  return v_id;
end $$;

-- Vấn đề đã tự hết thì đóng lại, đừng bắt người vào đóng tay.
-- Gọi sau mỗi lượt chạy, truyền vào danh sách fingerprint còn thấy hôm nay.
create or replace function auto_resolve_findings(
  p_rule_key text,
  p_still_open text[],
  p_today date default current_date
) returns int language sql as $$
  with closed as (
    update finding
       set status = 'RESOLVED', resolved_on = p_today, updated_at = now()
     where rule_key = p_rule_key
       and status in ('OPEN','ACKNOWLEDGED')
       and not (fingerprint = any (p_still_open))
    returning 1
  )
  select count(*)::int from closed;
$$;

-- Đầu vào của bản tin sáng: cái mới hôm nay, và cái đã nhắc mà chưa ai làm.
create or replace view finding_digest as
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
