-- Chạy qua db/test/run.sh. Mỗi khối là một hành vi, hỏng ở đâu dừng ở đó.
\set ON_ERROR_STOP on

-- ── Ánh xạ giả, đứng thay hai hệ thống nguồn ──────────────────────────
create schema src_telecom;
create schema src_fixed;

create table src_telecom.map_customer (
  source_customer_id text, full_name text, phone text, email text,
  id_document text, created_at_src timestamptz, created_by_src text);
create table src_fixed.map_customer (like src_telecom.map_customer);

-- Bốn hồ sơ gốc, hai cặp là cùng một người: T1=F1 theo điện thoại,
-- T2=F2 theo email. Đúng ra phải còn hai người.
insert into src_telecom.map_customer values
  ('T1', 'Nguyễn Văn A', '090-1234-5678', null, 'ID-A', now(), 'nv_a'),
  ('T2', 'Trần Thị B',   '080 9999 1111', 'b@example.com', null, now(), 'nv_a');
insert into src_fixed.map_customer values
  ('F1', 'Nguyen Van A', '09012345678', null, null, now(), 'nv_b'),
  ('F2', 'Lê Văn C',     null, 'b@example.com', null, now(), 'nv_b');

update app_setting set value = '81' where key = 'phone_country_code';

-- ── Chuẩn hoá số điện thoại ───────────────────────────────────────────
do $$ begin
  assert norm_phone('090-1234-5678') = '+819012345678',
    'dấu gạch và số 0 đầu phải bị bỏ: ' || coalesce(norm_phone('090-1234-5678'), 'null');
  assert norm_phone('09012345678') = norm_phone('090 1234 5678'),
    'cùng một số viết khác nhau phải ra cùng kết quả';
  assert norm_phone('') is null, 'chuỗi rỗng phải ra null';
  assert norm_phone(null) is null, 'null phải ra null';
end $$;

-- ── Gộp khách theo điện thoại và email ────────────────────────────────
do $$ begin perform sync_entity('TELECOM', 'customer', 'test'); end $$;
do $$ begin perform sync_entity('FIXED',   'customer', 'test'); end $$;

do $$
declare v_n int;
begin
  select count(*) into v_n from party;
  assert v_n = 2, 'bốn hồ sơ gốc, hai cặp trùng nhau, phải còn 2 party — đang có ' || v_n;

  assert (select party_id from party_source where source_customer_id = 'T1')
       = (select party_id from party_source where source_customer_id = 'F1'),
    'T1 và F1 cùng số điện thoại nên phải chung một party';
  assert (select match_rule from party_source where source_customer_id = 'F1') = 'R1_phone',
    'phải khớp bằng quy tắc điện thoại';

  assert (select party_id from party_source where source_customer_id = 'T2')
       = (select party_id from party_source where source_customer_id = 'F2'),
    'T2 và F2 cùng email nên phải chung một party';
  assert (select match_rule from party_source where source_customer_id = 'F2') = 'R3_email',
    'phải khớp bằng quy tắc email';
end $$;

-- ── Đồng bộ lại không sinh thêm ───────────────────────────────────────
do $$ begin perform sync_entity('TELECOM', 'customer', 'test'); end $$;
do $$ begin perform sync_entity('FIXED',   'customer', 'test'); end $$;

do $$
declare v_n int;
begin
  select count(*) into v_n from party;
  assert v_n = 2, 'chạy lại lần hai vẫn phải là 2 party — đang có ' || v_n;
  select count(*) into v_n from party_source;
  assert v_n = 4, 'mỗi hồ sơ gốc đúng một liên kết — đang có ' || v_n;
  select count(*) into v_n from sync_run where status = 'OK' and table_name = 'customer';
  assert v_n = 4, 'bốn lượt đồng bộ khách phải có bốn dòng OK — đang có ' || v_n;
end $$;

-- ── Hàng đợi duyệt trùng bỏ qua dấu tiếng Việt ────────────────────────
do $$
declare v_n int;
begin
  assert name_key('Nguyễn Văn A') = name_key('nguyen  van a'),
    'bỏ dấu, hạ chữ thường và gộp khoảng trắng phải ra cùng khoá';

  -- Hai người khác nhau, tên viết một bên có dấu một bên không.
  insert into party (display_name, phone_norm) values ('Phạm Thị D', '+81700000001');
  insert into party (display_name, phone_norm) values ('Pham Thi D', '+81700000002');

  select count(*) into v_n from v_merge_candidate
   where ten_a in ('Phạm Thị D','Pham Thi D') and ten_b in ('Phạm Thị D','Pham Thi D');
  assert v_n = 1, 'cặp tên có dấu và không dấu phải vào hàng đợi — đang có ' || v_n;

  delete from party where display_name in ('Phạm Thị D','Pham Thi D');
end $$;

-- ── Bác một cặp gợi ý ─────────────────────────────────────────────────
do $$
declare v_a uuid; v_b uuid; v_n int;
begin
  select party_id into v_a from party_source where source_customer_id = 'T1';
  select party_id into v_b from party_source where source_customer_id = 'T2';
  perform reject_merge(v_a, v_b, 'test');
  perform reject_merge(v_b, v_a, 'test');
  select count(*) into v_n from merge_rejection;
  assert v_n = 1, 'bác một cặp hai lần, đảo thứ tự, vẫn là một dòng — đang có ' || v_n;
end $$;

-- ── Quy tắc sinh phán quyết ───────────────────────────────────────────
insert into subscription_snapshot (source, source_id, source_customer_id, party_id,
  service_type, status, monthly_price, activated_on, anchor_day)
select 'TELECOM', 'S1', 'T1', party_id, 'POCKET_WIFI', 'ACTIVE', 3000,
       current_date - 60, 10
  from party_source where source_customer_id = 'T1';

insert into invoice_snapshot (source, source_id, party_id, subscription_source_id,
  issued_on, due_on, period_start, period_end, total_amount, paid_amount, status)
select 'TELECOM', 'I1', party_id, 'S1', current_date - 40, current_date - 33,
       current_date - 40, current_date - 10, 3000, 500, 'ISSUED'
  from party_source where source_customer_id = 'T1';

insert into loan_record (device_imei, issued_on, due_on, entered_by)
values ('35000000000001', current_date - 30, current_date - 10, 'test');

update threshold set value = 1000 where key = 'ar_suspend_amount';

do $$ begin perform run_rules(); end $$;
do $$ begin perform run_rules(); end $$;

do $$
declare v_n int; v_times int;
begin
  select count(*) into v_n from finding where status = 'OPEN';
  assert v_n = 3,
    'thiếu hoá đơn, nợ vượt ngưỡng, máy quá hạn — đúng 3 phán quyết, đang có ' || v_n;

  select times_reported into v_times from finding where rule_key = 'R_MISSING_INVOICE';
  assert v_times = 2, 'chạy hai lượt thì đếm 2 chứ không sinh dòng mới — đang là ' || v_times;
end $$;

-- ── Vấn đề hết thì tự đóng ────────────────────────────────────────────
update loan_record set returned_on = current_date;
do $$ begin perform run_rules(); end $$;

do $$ begin
  assert (select status from finding where rule_key = 'R_LOAN_OVERDUE') = 'RESOLVED',
    'trả máy rồi thì phán quyết phải tự đóng';
end $$;

-- ── Bỏ qua vĩnh viễn thì không báo lại ────────────────────────────────
update finding set status = 'IGNORED' where rule_key = 'R_AR_OVER_LIMIT';
do $$ begin perform run_rules(); end $$;

do $$
declare v_n int;
begin
  select count(*) into v_n from finding where rule_key = 'R_AR_OVER_LIMIT';
  assert v_n = 1, 'đã bỏ qua thì không được sinh dòng mới — đang có ' || v_n;
  assert (select status from finding where rule_key = 'R_AR_OVER_LIMIT') = 'IGNORED',
    'trạng thái bỏ qua phải giữ nguyên';
end $$;

-- ── Chụp số cuối ngày ─────────────────────────────────────────────────
do $$
declare v_n int; v_ar numeric;
begin
  perform snapshot_daily();
  perform snapshot_daily();

  select count(*) into v_n from daily_metric where metric_key = 'ar_total';
  assert v_n = 1, 'chụp hai lần trong ngày vẫn một dòng — đang có ' || v_n;

  select value into v_ar from daily_metric where metric_key = 'ar_total';
  assert v_ar = 2500, 'công nợ phải là 3000 trừ 500 — đang là ' || v_ar;
end $$;

-- ── Gộp tay hai party ─────────────────────────────────────────────────
do $$
declare v_keep uuid; v_drop uuid; v_n int;
begin
  select party_id into v_keep from party_source where source_customer_id = 'T1';
  select party_id into v_drop from party_source where source_customer_id = 'T2';

  perform merge_parties(v_keep, v_drop, 'test');

  select count(*) into v_n from party;
  assert v_n = 1, 'gộp xong còn 1 party — đang có ' || v_n;
  select count(*) into v_n from party_source where party_id = v_keep;
  assert v_n = 4, 'liên kết phải chuyển hết sang party được giữ — đang có ' || v_n;
  select count(*) into v_n from subscription_snapshot where party_id = v_keep;
  assert v_n = 1, 'thuê bao phải theo party được giữ';
end $$;

-- ── Báo cáo tuần ──────────────────────────────────────────────────────
do $$
declare
  w date := (date_trunc('week', current_date) - interval '7 days')::date;
  v numeric;
begin
  insert into subscription_snapshot (source, source_id, source_customer_id,
    service_type, status, monthly_price, monthly_cost, activated_on, terminated_on)
  values ('FIXED','W1','CW','FIXED_INTERNET','TERMINATED', 5000, 2000, w + 1, w + 3),
         ('FIXED','W2','CW','FIXED_INTERNET','ACTIVE',     5000, 2000, w + 1, null);

  select value into v from weekly_metric_raw(w)
   where metric_key = 'new_subscription' and dimension = 'FIXED_INTERNET';
  assert v = 2, 'hai thuê bao kích hoạt trong tuần — đang là ' || coalesce(v::text, 'null');

  select value into v from weekly_metric_raw(w)
   where metric_key = 'churned_subscription' and dimension = 'FIXED_INTERNET';
  assert v = 1, 'một thuê bao chấm dứt trong tuần — đang là ' || coalesce(v::text, 'null');

  select value into v from weekly_metric_raw(w)
   where metric_key = 'active_at_end' and dimension = 'FIXED_INTERNET';
  assert v = 1, 'cuối tuần còn một thuê bao chạy — đang là ' || coalesce(v::text, 'null');

  -- Biên lãi chỉ tính thuê bao còn chạy: 5000 trừ 2000.
  select value into v from weekly_metric_raw(w)
   where metric_key = 'gross_margin' and dimension = 'FIXED_INTERNET';
  assert v = 3000, 'biên lãi phải là 3000 — đang là ' || coalesce(v::text, 'null');

  -- Tuần trước đó chưa có gì, nên phải có cột so sánh rỗng chứ không mất dòng.
  select tuan_nay into v from weekly_report(w)
   where metric_key = 'new_subscription' and dimension = 'FIXED_INTERNET';
  assert v = 2, 'weekly_report phải giữ lại số của tuần này — đang là ' || coalesce(v::text, 'null');
end $$;

\echo 'TẤT CẢ TEST ĐỀU QUA'
