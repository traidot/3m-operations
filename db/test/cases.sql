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

-- ── Số liệu quảng cáo ─────────────────────────────────────────────────
do $$
declare v numeric;
begin
  insert into ads_daily (sheet_owner, metric_date, product, spend, reach, clicks, messages, orders)
  values ('test', current_date - 1, 'TONG',        1000000, 5000, 200, 10, 2),
         ('test', current_date - 1, 'POCKET_WIFI',  400000, 2000,   0,  0, 0);

  select gia_click into v from v_ads_derived
   where product = 'TONG' and metric_date = current_date - 1;
  assert v = 5000, 'giá click phải là 1000000/200 — đang là ' || coalesce(v::text, 'null');

  select ty_le_chot into v from v_ads_derived
   where product = 'TONG' and metric_date = current_date - 1;
  assert v = 20.00, 'tỉ lệ chốt phải là 2/10 — đang là ' || coalesce(v::text, 'null');

  -- Không có click thì giá click là null, không phải 0. Hai chuyện khác nhau.
  select gia_click into v from v_ads_derived
   where product = 'POCKET_WIFI' and metric_date = current_date - 1;
  assert v is null, 'chia cho 0 phải ra null — đang là ' || coalesce(v::text, 'null');

  -- Đối chiếu mức 1: marketing khai 2 đơn, trong phần mềm có 1 hồ sơ tạo hôm qua.
  insert into party (display_name, created_at) values ('Khách hôm qua', now() - interval '1 day');
  select chenh_lech into v from v_ads_vs_party where ngay = current_date - 1;
  assert v = -1, 'khai 2 mà chỉ có 1 hồ sơ thì lệch -1 — đang là ' || coalesce(v::text, 'null');

  -- Số quảng cáo hôm qua phải vào ảnh chụp để tuần sau còn so được.
  perform snapshot_daily();
  select value into v from daily_metric
   where metric_date = current_date and metric_key = 'ads_orders';
  assert v = 2, 'ảnh chụp phải có số đơn khai của hôm qua — đang là ' || coalesce(v::text, 'null');
end $$;

-- ── Sheet marketing chậm cập nhật ─────────────────────────────────────
do $$
declare v_n int;
begin
  -- Số mới nhất là hôm qua, ngưỡng 2 ngày nên chưa báo.
  perform run_rules();
  select count(*) into v_n from finding where rule_key = 'R_ADS_STALE' and status = 'OPEN';
  assert v_n = 0, 'mới chậm 1 ngày thì chưa báo — đang có ' || v_n;

  -- Đẩy lùi số liệu về 5 ngày trước.
  update ads_daily set metric_date = current_date - 5 where sheet_owner = 'test';
  perform run_rules();
  select count(*) into v_n from finding where rule_key = 'R_ADS_STALE' and status = 'OPEN';
  assert v_n = 1, 'chậm 5 ngày thì phải báo — đang có ' || v_n;
end $$;

-- ── Quy tắc nợ cước wifi cố định ──────────────────────────────────────
-- Thân vòng lặp phải được chạy thật, không thì đổi cột ở view mà quy tắc
-- vẫn tham chiếu tên cũ sẽ lọt lưới cho tới lúc chạy production.
do $$
declare v_n int; v_ev jsonb;
begin
  insert into subscription_snapshot (source, source_id, source_customer_id,
    service_type, status, monthly_price, fee_start_on, created_at_src)
  values ('FIXED', 'C1', 'HD_TEST', 'FIXED_INTERNET', 'ACTIVE', 2000,
          current_date - interval '6 months', now());

  -- Một kỳ đã thu, một kỳ được miễn; bốn kỳ còn lại là nợ.
  insert into fee_period_snapshot (source, source_id, subscription_source_id,
    period, amount, is_free, status)
  values ('FIXED','F1','C1', to_char(current_date - interval '6 months','YYYY-MM'), 2000, false, 'APPROVED'),
         ('FIXED','F2','C1', to_char(current_date - interval '5 months','YYYY-MM'),    0, true,  'APPROVED');

  perform run_rules();

  select count(*) into v_n from finding where rule_key = 'R_FIXED_ARREARS' and status = 'OPEN';
  assert v_n = 1, 'phải sinh đúng một phán quyết nợ cước — đang có ' || v_n;

  select evidence into v_ev from finding where rule_key = 'R_FIXED_ARREARS';
  assert (v_ev->>'so_ky_mien_phi')::int = 1,
    'kỳ được miễn phải nằm trong chứng cứ — đang là ' || coalesce(v_ev->>'so_ky_mien_phi','null');
  assert (v_ev->>'so_ky_no')::int >= 3,
    'phải đếm được số kỳ nợ — đang là ' || coalesce(v_ev->>'so_ky_no','null');
end $$;

-- ── Đóng rồi mở lại phải giữ tuổi của vấn đề ──────────────────────────
do $$
declare v_id uuid; v_ngay date; v_lan int; v_mo_lai int;
begin
  select id, first_seen_on into v_id, v_ngay
    from finding where rule_key = 'R_FIXED_ARREARS' limit 1;

  -- Giả vờ vấn đề đã tồn từ 10 ngày trước.
  update finding set first_seen_on = current_date - 10, times_reported = 5 where id = v_id;

  -- Bấm "đã xử lý" nhưng nợ vẫn còn.
  update finding set status = 'RESOLVED', resolved_on = current_date where id = v_id;
  perform run_rules();

  select first_seen_on, times_reported, reopened_count
    into v_ngay, v_lan, v_mo_lai from finding where id = v_id;

  assert (select count(*) from finding where rule_key = 'R_FIXED_ARREARS') = 1,
    'mở lại phải dùng chính dòng cũ, không sinh dòng mới';
  assert v_ngay = current_date - 10,
    'ngày phát hiện đầu tiên phải giữ nguyên — đang là ' || v_ngay;
  assert v_lan = 6, 'số lần nhắc phải cộng tiếp — đang là ' || v_lan;
  assert v_mo_lai = 1, 'phải đếm được một lần tái diễn — đang là ' || v_mo_lai;
  assert (select status from finding where id = v_id) = 'OPEN',
    'vấn đề còn thì phải mở lại';
end $$;

-- ── Gỡ đánh dấu bỏ qua ────────────────────────────────────────────────
do $$
declare v_id uuid;
begin
  select id into v_id from finding where rule_key = 'R_FIXED_ARREARS' limit 1;
  update finding set status = 'IGNORED' where id = v_id;

  perform run_rules();
  assert (select status from finding where id = v_id) = 'IGNORED',
    'đã bỏ qua thì lượt chạy sau không được đụng vào';

  perform unignore_finding(v_id);
  assert (select status from finding where id = v_id) = 'RESOLVED',
    'gỡ bỏ qua thì về trạng thái đã đóng, để lượt sau tự quyết';

  perform run_rules();
  assert (select status from finding where id = v_id) = 'OPEN',
    'vấn đề vẫn còn nên phải mở lại sau khi gỡ';
end $$;

\echo 'TẤT CẢ TEST ĐỀU QUA'

-- ── Tra cứu một hợp đồng và cước từng kỳ ──────────────────────────────
-- C1 dựng ở khối nợ cước phía trên: thu 1 kỳ, miễn 1 kỳ, còn lại là nợ.
do $$
declare v_tt text; v_n int;
begin
  -- Dòng cho kỳ nằm ngoài khoảng sinh được, phải hiện chứ không rơi mất.
  insert into fee_period_snapshot (source, source_id, subscription_source_id,
    period, amount, is_free, status)
  values ('FIXED','F9','C1', to_char(current_date + interval '18 months','YYYY-MM'),
          2000, false, 'APPROVED');

  -- Hợp đồng thiếu giá cước: không sinh được kỳ nào nhưng vẫn phải liệt kê.
  insert into subscription_snapshot (source, source_id, source_customer_id,
    service_type, status, monthly_price, fee_start_on, created_at_src)
  values ('FIXED', 'C2', 'HD_TRONG', 'FIXED_INTERNET', 'ACTIVE', null,
          current_date - interval '3 months', now());

  select tinh_trang_cuoc into v_tt from v_fixed_contract where subscription_id = 'C1';
  assert v_tt = 'NO', 'C1 còn nợ nên phải là NO — đang là ' || coalesce(v_tt,'null');

  select tinh_trang_cuoc into v_tt from v_fixed_contract where subscription_id = 'C2';
  assert v_tt = 'CHUA_TINH_DUOC',
    'hợp đồng thiếu giá cước phải là CHUA_TINH_DUOC — đang là ' || coalesce(v_tt,'null');

  select trang_thai into v_tt from v_fixed_contract_period
   where subscription_id = 'C1' and ky = to_char(current_date - interval '5 months','YYYY-MM');
  assert v_tt = 'MIEN_PHI', 'kỳ được miễn phải là MIEN_PHI — đang là ' || coalesce(v_tt,'null');

  select trang_thai into v_tt from v_fixed_contract_period
   where subscription_id = 'C1' and ky = to_char(current_date - interval '4 months','YYYY-MM');
  assert v_tt = 'NO', 'kỳ không có dòng nào phải là NO — đang là ' || coalesce(v_tt,'null');

  select count(*) into v_n from v_fixed_contract_period
   where subscription_id = 'C1' and ngoai_ky_tinh;
  assert v_n = 1, 'kỳ ngoài khoảng tính được phải hiện đúng một dòng — đang có ' || v_n;
end $$;

-- ── Cảnh báo trên từng hợp đồng ───────────────────────────────────────
-- C1 nợ 4 kỳ, C2 đang chạy mà thiếu giá cước — hai khối phía trên dựng.
do $$
declare v_cb text[];
begin
  select canh_bao into v_cb from v_fixed_contract where subscription_id = 'C1';
  assert 'NO_NANG' = any(v_cb), 'C1 nợ quá ngưỡng phải có NO_NANG — đang là ' || v_cb::text;
  assert 'NGOAI_KY' = any(v_cb), 'C1 có kỳ ngoài khoảng phải có NGOAI_KY — đang là ' || v_cb::text;
  assert not ('THIEU_CUOC' = any(v_cb)), 'C1 có giá cước, không được gắn THIEU_CUOC';

  select canh_bao into v_cb from v_fixed_contract where subscription_id = 'C2';
  assert 'THIEU_CUOC' = any(v_cb),
    'C2 đang chạy mà thiếu giá cước phải có THIEU_CUOC — đang là ' || v_cb::text;

  -- Hợp đồng đã huỷ nhưng chưa đòi xong tiền.
  insert into subscription_snapshot (source, source_id, source_customer_id,
    service_type, status, monthly_price, fee_start_on, created_at_src)
  values ('FIXED', 'C3', 'HD_HUY', 'FIXED_INTERNET', 'TERMINATED', 2000,
          current_date - interval '2 months', now());

  select canh_bao into v_cb from v_fixed_contract where subscription_id = 'C3';
  assert 'HUY_CON_NO' = any(v_cb),
    'hợp đồng huỷ mà còn nợ phải có HUY_CON_NO — đang là ' || v_cb::text;
end $$;

-- ── Mốc bắt đầu, kết thúc và kỳ thu thiếu tiền ────────────────────────
do $$
declare v_bd int; v_kt int; v_cb text[]; v_mo boolean; v_dong boolean;
begin
  -- C4 bắt đầu tháng 3 năm nay, kết thúc tháng 9, thu kỳ đầu thiếu 500.
  insert into subscription_snapshot (source, source_id, source_customer_id,
    service_type, status, monthly_price, fee_start_on, fee_end_on, created_at_src)
  values ('FIXED', 'C4', 'HD_MOC', 'FIXED_INTERNET', 'ACTIVE', 2000,
          make_date(extract(year from current_date)::int, 3, 1),
          make_date(extract(year from current_date)::int, 9, 30), now());

  insert into fee_period_snapshot (source, source_id, subscription_source_id,
    period, amount, is_free, status)
  values ('FIXED','F4','C4', to_char(make_date(extract(year from current_date)::int,3,1),'YYYY-MM'),
          1500, false, 'APPROVED');

  select tu_thang, den_thang into v_bd, v_kt
    from v_fixed_year_status where subscription_id = 'C4';
  assert v_bd = 3, 'đoạn hợp đồng phải mở từ tháng 3 — đang là ' || coalesce(v_bd::text,'null');
  assert v_kt = 9, 'đoạn hợp đồng phải đóng ở tháng 9 — đang là ' || coalesce(v_kt::text,'null');

  select co_mo_dau, co_ket_thuc into v_mo, v_dong
    from v_fixed_year_status where subscription_id = 'C4';
  assert v_mo and v_dong, 'C4 mở và đóng ngay trong năm nay nên phải bo tròn cả hai đầu';

  -- C5 bắt đầu từ năm ngoái và chưa kết thúc: phủ cả năm, không bo đầu cũng
  -- không bo đuôi, vì cả hai mốc đều nằm ngoài năm nay.
  insert into subscription_snapshot (source, source_id, source_customer_id,
    service_type, status, monthly_price, fee_start_on, created_at_src)
  values ('FIXED', 'C5', 'HD_NAM_TRUOC', 'FIXED_INTERNET', 'ACTIVE', 2000,
          make_date(extract(year from current_date)::int - 1, 5, 1), now());

  select tu_thang, den_thang, co_mo_dau, co_ket_thuc into v_bd, v_kt, v_mo, v_dong
    from v_fixed_year_status where subscription_id = 'C5';
  assert v_bd = 1 and v_kt = 12,
    'hợp đồng từ năm ngoái, chưa kết thúc thì phủ cả năm — đang là ' || v_bd || '..' || v_kt;
  assert not v_mo and not v_dong,
    'cả hai mốc nằm ngoài năm nay nên không được bo tròn đầu nào';

  select canh_bao into v_cb from v_fixed_contract where subscription_id = 'C4';
  assert 'THU_THIEU' = any(v_cb),
    'kỳ duyệt rồi mà thu thiếu tiền phải có THU_THIEU — đang là ' || v_cb::text;
end $$;

-- ── Thống kê theo tháng ───────────────────────────────────────────────
-- C4 ký tháng 3, lắp xong tháng 4, huỷ tháng 9 — cùng năm hiện tại.
do $$
declare v_n bigint; v_ky text;
begin
  update install_order_snapshot set signed_on = make_date(extract(year from current_date)::int, 3, 5),
                                    completed_on = make_date(extract(year from current_date)::int, 4, 2)
   where source = 'FIXED' and source_id = 'C4';
  insert into install_order_snapshot (source, source_id, status, signed_on, completed_on)
  select 'FIXED', 'C4', 'DONE',
         make_date(extract(year from current_date)::int, 3, 5),
         make_date(extract(year from current_date)::int, 4, 2)
   where not exists (select 1 from install_order_snapshot where source='FIXED' and source_id='C4');

  update subscription_snapshot set terminated_on = make_date(extract(year from current_date)::int, 9, 30)
   where source = 'FIXED' and source_id = 'C4';

  v_ky := to_char(make_date(extract(year from current_date)::int, 3, 1), 'YYYY-MM');
  select ky_moi into v_n from v_fixed_month where ky = v_ky;
  assert v_n >= 1, 'tháng ký của C4 phải đếm được hợp đồng mới — đang là ' || coalesce(v_n::text,'null');

  v_ky := to_char(make_date(extract(year from current_date)::int, 9, 1), 'YYYY-MM');
  select huy into v_n from v_fixed_month where ky = v_ky;
  assert v_n >= 1, 'tháng huỷ của C4 phải đếm được — đang là ' || coalesce(v_n::text,'null');

  -- Kỳ ngoài khoảng tính được không được vào bảng tháng.
  v_ky := to_char(current_date + interval '18 months', 'YYYY-MM');
  select so_ky into v_n from v_fixed_month where ky = v_ky;
  assert v_n is null, 'kỳ ngoài khoảng không được tính vào tháng — đang là ' || coalesce(v_n::text,'null');
end $$;

-- ── Gom nhóm lý do huỷ ────────────────────────────────────────────────
-- Chữ tự do, lẫn tiếng Nhật và sai chính tả, nên phải chắc bộ từ khoá còn bắt
-- được các biến thể thật đã gặp trong dữ liệu.
do $$
begin
  assert cancel_reason_group('không liên lạc được') = 'KHONG_LIEN_LAC';
  assert cancel_reason_group('khôg phản hồi') = 'KHONG_LIEN_LAC', 'phải chịu được lỗi gõ';
  assert cancel_reason_group('連絡つかず') = 'KHONG_LIEN_LAC', 'phải đọc được tiếng Nhật';
  assert cancel_reason_group('提供不可') = 'NHA_MANG_TU_CHOI';
  assert cancel_reason_group('ngoài khu vực lắp') = 'NHA_MANG_TU_CHOI';
  assert cancel_reason_group('khách chuyeenr nhà') = 'CHUYEN_NHA';
  assert cancel_reason_group('công ty quản lý không cho lắp') = 'TOA_NHA_TU_CHOI';
  assert cancel_reason_group('đăng ký trùng kiện') = 'DON_TRUNG_HOAC_SAI';
  assert cancel_reason_group('khách đăng ký bên khác') = 'DA_DANG_KY_NOI_KHAC';
  assert cancel_reason_group('hết slot family') = 'HET_SLOT';
  assert cancel_reason_group('lâu quá khách không đợi được') = 'KHACH_KHONG_CHO_DUOC';
  assert cancel_reason_group('khách không còn nhu cầu') = 'KHACH_DOI_Y';
  assert cancel_reason_group('') is null, 'ô rỗng không được xếp nhóm';
  assert cancel_reason_group(null) is null;
  assert cancel_reason_group('abcxyz') = 'KHAC';

  -- Nhà mạng phải chặn trước: câu tiếng Nhật hay kèm chữ キャンセル chung chung.
  assert cancel_reason_group('本件、NTT判定により提供不可 キャンセルになります') = 'NHA_MANG_TU_CHOI';
end $$;
