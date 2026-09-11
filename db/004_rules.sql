-- Quy tắc sinh phán quyết. SQL phát hiện, agent diễn giải.
-- Mọi con số trong finding.evidence đều do đây tính, agent không được tự tính lại.

create table if not exists app_setting (
  key   text primary key,
  value text not null,
  note  text
);
insert into app_setting (key, value, note) values
  ('metabase_base_url', '', 'CHƯA ĐẶT — dùng để dựng link xem sâu trong bản tin')
on conflict (key) do nothing;

create or replace function mb_link(p_path text)
returns text language sql stable as $$
  select case
    when coalesce((select value from app_setting where key = 'metabase_base_url'), '') = ''
      then null
    else (select value from app_setting where key = 'metabase_base_url') || p_path
  end;
$$;

create or replace function run_rules(p_today date default current_date)
returns table (rule_key text, so_phat_hien int, so_da_dong int)
language plpgsql as $$
declare
  v_fp   text[];
  v_rec  record;
  v_nguong numeric;
begin

  -- ── Đồng bộ quá hạn ────────────────────────────────────────────────
  -- Phán quyết này phải đứng đầu: mọi số phía sau chỉ đáng tin nếu nó im.
  v_fp := '{}';
  for v_rec in
    select * from v_sync_freshness
    where lan_dong_bo_cuoi is null or gio_ke_tu_lan_cuoi > nguong_gio
  loop
    perform upsert_finding(
      'R_SYNC_STALE', 'global', v_rec.source::text || '/' || v_rec.table_name,
      'CRITICAL',
      format('Nguồn %s bảng %s chưa đồng bộ được', v_rec.source, v_rec.table_name),
      jsonb_build_object(
        'lan_dong_bo_cuoi', v_rec.lan_dong_bo_cuoi,
        'gio_ke_tu_lan_cuoi', v_rec.gio_ke_tu_lan_cuoi,
        'nguong_gio', v_rec.nguong_gio),
      'Kiểm tra job đồng bộ. Mọi số liệu trong bản tin hôm nay đang dựa trên dữ liệu cũ.',
      null, p_today);
    v_fp := v_fp || ('R_SYNC_STALE:' || v_rec.source::text || '/' || v_rec.table_name);
  end loop;
  rule_key := 'R_SYNC_STALE'; so_phat_hien := coalesce(array_length(v_fp, 1), 0);
  so_da_dong := auto_resolve_findings('R_SYNC_STALE', v_fp, p_today); return next;

  -- ── Thuê bao chạy mà thiếu hoá đơn ─────────────────────────────────
  -- Đang phục vụ miễn phí. Phải bằng không mỗi ngày.
  v_fp := '{}';
  for v_rec in select * from v_missing_invoice loop
    perform upsert_finding(
      'R_MISSING_INVOICE', 'subscription',
      v_rec.source::text || '/' || v_rec.subscription_id,
      'CRITICAL',
      format('Thuê bao %s (%s) đang chạy nhưng %s ngày không có hoá đơn',
             v_rec.subscription_id, coalesce(v_rec.service_type, 'chưa rõ dịch vụ'),
             v_rec.ngay_khong_co_cuoc),
      jsonb_build_object(
        'service_type', v_rec.service_type,
        'plan_name', v_rec.plan_name,
        'monthly_price', v_rec.monthly_price,
        'ky_gan_nhat_den', v_rec.ky_gan_nhat_den,
        'ngay_khong_co_cuoc', v_rec.ngay_khong_co_cuoc),
      'Vào hệ thống gốc kiểm tra vì sao chưa sinh cước cho thuê bao này.',
      mb_link('/question/missing-invoice'), p_today);
    v_fp := v_fp || ('R_MISSING_INVOICE:' || v_rec.source::text || '/' || v_rec.subscription_id);
  end loop;
  rule_key := 'R_MISSING_INVOICE'; so_phat_hien := coalesce(array_length(v_fp, 1), 0);
  so_da_dong := auto_resolve_findings('R_MISSING_INVOICE', v_fp, p_today); return next;

  -- ── Nợ vượt ngưỡng ─────────────────────────────────────────────────
  -- Ngưỡng còn 0 nghĩa là chưa ai đặt, im lặng bỏ qua chứ đừng báo bừa.
  v_fp := '{}';
  select value into v_nguong from threshold where key = 'ar_suspend_amount';
  if v_nguong > 0 then
    for v_rec in
      select * from v_ar_by_party where tong_no >= v_nguong
    loop
      perform upsert_finding(
        'R_AR_OVER_LIMIT', 'customer', v_rec.party_id::text,
        'WARN',
        format('%s đang nợ %s, quá hạn lâu nhất %s ngày',
               coalesce(v_rec.display_name, 'khách chưa có tên'),
               to_char(v_rec.tong_no, 'FM999G999G999'), v_rec.qua_han_lau_nhat),
        jsonb_build_object(
          'tong_no', v_rec.tong_no, 'so_hoa_don', v_rec.so_hoa_don,
          'qua_han_lau_nhat', v_rec.qua_han_lau_nhat,
          'nguong', v_nguong, 'dien_thoai', v_rec.phone_norm),
        'Quyết định khoá dịch vụ hay gia hạn. Người quyết, không phải hệ thống.',
        mb_link('/question/ar-by-party'), p_today);
      v_fp := v_fp || ('R_AR_OVER_LIMIT:' || v_rec.party_id::text);
    end loop;
  end if;
  rule_key := 'R_AR_OVER_LIMIT'; so_phat_hien := coalesce(array_length(v_fp, 1), 0);
  so_da_dong := auto_resolve_findings('R_AR_OVER_LIMIT', v_fp, p_today); return next;

  -- ── Máy cho mượn quá hạn thu hồi ───────────────────────────────────
  v_fp := '{}';
  for v_rec in select * from v_loan_overdue loop
    perform upsert_finding(
      'R_LOAN_OVERDUE', 'loan', v_rec.id::text,
      'WARN',
      format('Máy %s quá hạn thu hồi %s ngày', v_rec.device_imei, v_rec.ngay_qua_han),
      jsonb_build_object(
        'imei', v_rec.device_imei, 'install_ref', v_rec.install_ref,
        'issued_on', v_rec.issued_on, 'due_on', v_rec.due_on,
        'ngay_qua_han', v_rec.ngay_qua_han),
      'Gọi đòi máy. Để lâu thì máy mượn thành máy mất.',
      mb_link('/question/loan-overdue'), p_today);
    v_fp := v_fp || ('R_LOAN_OVERDUE:' || v_rec.id::text);
  end loop;
  rule_key := 'R_LOAN_OVERDUE'; so_phat_hien := coalesce(array_length(v_fp, 1), 0);
  so_da_dong := auto_resolve_findings('R_LOAN_OVERDUE', v_fp, p_today); return next;

  -- ── Thuê bao đã ngừng nhưng máy chưa về kho ────────────────────────
  v_fp := '{}';
  for v_rec in select * from v_device_stuck loop
    perform upsert_finding(
      'R_DEVICE_STUCK', 'device', v_rec.source::text || '/' || v_rec.source_id,
      'WARN',
      format('Máy %s vẫn gắn thuê bao đã chấm dứt ngày %s',
             coalesce(v_rec.imei, v_rec.source_id), v_rec.terminated_on),
      jsonb_build_object('imei', v_rec.imei, 'model', v_rec.model,
                         'terminated_on', v_rec.terminated_on),
      'Đòi máy hoặc chốt đền bù, rồi cập nhật trạng thái ở hệ thống gốc.',
      null, p_today);
    v_fp := v_fp || ('R_DEVICE_STUCK:' || v_rec.source::text || '/' || v_rec.source_id);
  end loop;
  rule_key := 'R_DEVICE_STUCK'; so_phat_hien := coalesce(array_length(v_fp, 1), 0);
  so_da_dong := auto_resolve_findings('R_DEVICE_STUCK', v_fp, p_today); return next;

  -- ── Hồ sơ khách tạo rồi bỏ đó ──────────────────────────────────────
  v_fp := '{}';
  for v_rec in select * from v_party_stale loop
    perform upsert_finding(
      'R_PARTY_STALE', 'customer', v_rec.party_id::text,
      'WARN',
      format('%s tạo hồ sơ %s ngày trước mà chưa có thuê bao nào',
             coalesce(v_rec.display_name, 'khách chưa có tên'), v_rec.so_ngay),
      jsonb_build_object('ngay_tao', v_rec.ngay_tao, 'so_ngay', v_rec.so_ngay,
                         'source', v_rec.source),
      'Giao lại cho sale chăm. Tiền quảng cáo đã tiêu rồi.',
      null, p_today);
    v_fp := v_fp || ('R_PARTY_STALE:' || v_rec.party_id::text);
  end loop;
  rule_key := 'R_PARTY_STALE'; so_phat_hien := coalesce(array_length(v_fp, 1), 0);
  so_da_dong := auto_resolve_findings('R_PARTY_STALE', v_fp, p_today); return next;

  -- ── Tiền thu chưa gắn hoá đơn ──────────────────────────────────────
  v_fp := '{}';
  for v_rec in
    select count(*) as so_ban_ghi, sum(amount) as tong_tien from v_payment_unallocated
    having count(*) > 0
  loop
    perform upsert_finding(
      'R_PAYMENT_UNALLOCATED', 'global', null,
      'WARN',
      format('%s khoản thu chưa cấn vào hoá đơn nào, tổng %s',
             v_rec.so_ban_ghi, to_char(v_rec.tong_tien, 'FM999G999G999')),
      jsonb_build_object('so_ban_ghi', v_rec.so_ban_ghi, 'tong_tien', v_rec.tong_tien),
      'Cấn từng khoản vào hoá đơn tương ứng ở hệ thống gốc, nếu không sổ sẽ lệch dần.',
      mb_link('/question/payment-unallocated'), p_today);
    v_fp := v_fp || 'R_PAYMENT_UNALLOCATED:global'::text;
  end loop;
  rule_key := 'R_PAYMENT_UNALLOCATED'; so_phat_hien := coalesce(array_length(v_fp, 1), 0);
  so_da_dong := auto_resolve_findings('R_PAYMENT_UNALLOCATED', v_fp, p_today); return next;

  -- ── Khách trùng hồ sơ ──────────────────────────────────────────────
  v_fp := '{}';
  for v_rec in select * from v_duplicate_party loop
    perform upsert_finding(
      'R_DUPLICATE_PARTY', 'customer', v_rec.phone_norm,
      'INFO',
      format('Số %s đang là %s hồ sơ khác nhau', v_rec.phone_norm, v_rec.so_ho_so),
      jsonb_build_object('phone', v_rec.phone_norm, 'so_ho_so', v_rec.so_ho_so,
                         'party_ids', to_jsonb(v_rec.party_ids)),
      'Vào màn hình duyệt trùng để gộp hoặc bác. Gộp sai tệ hơn không gộp.',
      null, p_today);
    v_fp := v_fp || ('R_DUPLICATE_PARTY:' || v_rec.phone_norm);
  end loop;
  rule_key := 'R_DUPLICATE_PARTY'; so_phat_hien := coalesce(array_length(v_fp, 1), 0);
  so_da_dong := auto_resolve_findings('R_DUPLICATE_PARTY', v_fp, p_today); return next;

  -- ── Sheet marketing chưa cập nhật ──────────────────────────────────
  -- Kéo về mỗi ngày nhưng marketing quên nhập thì số vẫn cũ. Phát hiện sớm
  -- hơn nhiều so với đợi tới báo cáo tuần.
  v_fp := '{}';
  for v_rec in
    select * from v_ads_freshness where so_ngay_cham > nguong_ngay
  loop
    perform upsert_finding(
      'R_ADS_STALE', 'global', v_rec.sheet_owner,
      'WARN',
      format('Sheet quảng cáo của %s mới có số tới %s, chậm %s ngày',
             v_rec.sheet_owner, v_rec.ngay_moi_nhat, v_rec.so_ngay_cham),
      jsonb_build_object(
        'ngay_moi_nhat', v_rec.ngay_moi_nhat,
        'so_ngay_cham', v_rec.so_ngay_cham,
        'lan_keo_cuoi', v_rec.lan_keo_cuoi),
      'Nhắc người chạy quảng cáo nhập số. Không có số thì không tính được chi phí ra một khách.',
      null, p_today);
    v_fp := v_fp || ('R_ADS_STALE:' || v_rec.sheet_owner);
  end loop;
  rule_key := 'R_ADS_STALE'; so_phat_hien := coalesce(array_length(v_fp, 1), 0);
  so_da_dong := auto_resolve_findings('R_ADS_STALE', v_fp, p_today); return next;
  -- ── Hợp đồng wifi cố định nợ nhiều kỳ ──────────────────────────────
  -- Nhánh này không có hoá đơn nên nợ suy từ kỳ cước, đếm theo số kỳ.
  v_fp := '{}';
  for v_rec in select * from v_fixed_arrears order by so_ky_no desc loop
    perform upsert_finding(
      'R_FIXED_ARREARS', 'subscription', 'FIXED/' || v_rec.subscription_id,
      case when v_rec.so_ky_no >= 6 then 'CRITICAL' else 'WARN' end,
      format('Hợp đồng %s nợ %s kỳ, còn %s — %s, lắp đặt %s',
             v_rec.contract_code, v_rec.so_ky_no,
             to_char(v_rec.con_no, 'FM999G999G999'),
             v_rec.trang_thai_hop_dong, coalesce(v_rec.trang_thai_lap_dat, 'chưa rõ')),
      jsonb_build_object(
        'contract_code', v_rec.contract_code,
        'trang_thai_hop_dong', v_rec.trang_thai_hop_dong,
        'trang_thai_lap_dat', v_rec.trang_thai_lap_dat,
        'ky_da_thu_gan_nhat', v_rec.ky_da_thu_gan_nhat,
        'ky_cho_duyet', v_rec.ky_cho_duyet,
        'ky_ghi_chu', v_rec.ky_ghi_chu,
        'so_ky', v_rec.so_ky,
        'so_ky_mien_phi', v_rec.so_ky_mien_phi, 'so_ky_no', v_rec.so_ky_no,
        'tong_da_thu', v_rec.tong_da_thu, 'con_no', v_rec.con_no),
      'Quyết định đòi tiếp hay ngừng dịch vụ.',
      contract_url(v_rec.subscription_id), p_today);
    v_fp := v_fp || ('R_FIXED_ARREARS:FIXED/' || v_rec.subscription_id);
  end loop;
  rule_key := 'R_FIXED_ARREARS'; so_phat_hien := coalesce(array_length(v_fp, 1), 0);
  so_da_dong := auto_resolve_findings('R_FIXED_ARREARS', v_fp, p_today); return next;

end $$;

-- Chụp số cuối ngày. Công nợ và tồn kho là số tại thời điểm, không truy hồi được.
create or replace function snapshot_daily(p_today date default current_date)
returns int language plpgsql as $$
declare v_n int := 0;
begin
  insert into daily_metric (metric_date, metric_key, dimension, value)
  select p_today, 'ar_total', null, coalesce(sum(con_du), 0) from v_ar_open
  union all
  select p_today, 'ar_aging', nhom, tong_tien from v_ar_aging
  union all
  select p_today, 'cash_collected', null, coalesce(sum(amount), 0)
    from payment_snapshot where paid_at::date = p_today - 1
  union all
  select p_today, 'active_subscriptions', service_type, count(*)
    from subscription_snapshot where status = 'ACTIVE' group by service_type
  union all
  select p_today, 'missing_invoice', null, count(*) from v_missing_invoice
  union all
  select p_today, 'loan_overdue', null, count(*) from v_loan_overdue
  on conflict (metric_date, metric_key, coalesce(dimension, ''))
  do update set value = excluded.value, computed_at = now();

  get diagnostics v_n = row_count;
  return v_n;
end $$;
