-- Máy đồng bộ. Không biết gì về lược đồ hai hệ thống nguồn — chỉ đọc năm
-- view ánh xạ mô tả ở 005. Chạy lại nhiều lần không nhân đôi dữ liệu.

create or replace function src_schema(p_source source_system)
returns text language sql immutable as $$
  select case p_source when 'TELECOM' then 'src_telecom' else 'src_fixed' end;
$$;

/**
 * Đồng bộ một thực thể từ một nguồn. Ghi một dòng sync_run cho mỗi lượt,
 * kể cả khi hỏng — đồng bộ chết âm thầm nguy hiểm hơn đồng bộ lỗi.
 */
create or replace function sync_entity(
  p_source       source_system,
  p_entity       text,
  p_triggered_by text default 'schedule'
) returns int language plpgsql as $$
declare
  v_run   uuid;
  v_sql   text;
  v_rows  int := 0;
  v_src   text := src_schema(p_source);
begin
  insert into sync_run (source, table_name, triggered_by)
  values (p_source, p_entity, p_triggered_by)
  returning id into v_run;

  v_sql := case p_entity

    when 'customer' then format($f$
      select link_customer(%L, m.source_customer_id, m.full_name,
                           m.phone, m.email, m.id_document)
        from %I.map_customer m
    $f$, p_source, v_src)

    when 'subscription' then format($f$
      insert into subscription_snapshot (
        source, source_id, source_customer_id, service_type, plan_name, status,
        monthly_price, monthly_cost, activated_on, terminated_on, anchor_day,
        device_ref, sim_ref, created_at_src, updated_at_src, created_by_src, synced_at)
      select %L, m.source_id, m.source_customer_id, m.service_type, m.plan_name, m.status,
             m.monthly_price, m.monthly_cost, m.activated_on, m.terminated_on, m.anchor_day,
             m.device_ref, m.sim_ref, m.created_at_src, m.updated_at_src, m.created_by_src, now()
        from %I.map_subscription m
      on conflict (source, source_id) do update set
        service_type = excluded.service_type, plan_name = excluded.plan_name,
        status = excluded.status, monthly_price = excluded.monthly_price,
        monthly_cost = excluded.monthly_cost, activated_on = excluded.activated_on,
        terminated_on = excluded.terminated_on, anchor_day = excluded.anchor_day,
        device_ref = excluded.device_ref, sim_ref = excluded.sim_ref,
        updated_at_src = excluded.updated_at_src, synced_at = now()
    $f$, p_source, v_src)

    when 'invoice' then format($f$
      insert into invoice_snapshot (
        source, source_id, subscription_source_id, number, issued_on, due_on,
        period_start, period_end, total_amount, paid_amount, status,
        created_at_src, created_by_src, synced_at)
      select %L, m.source_id, m.subscription_source_id, m.number, m.issued_on, m.due_on,
             m.period_start, m.period_end, m.total_amount, m.paid_amount, m.status,
             m.created_at_src, m.created_by_src, now()
        from %I.map_invoice m
      on conflict (source, source_id) do update set
        number = excluded.number, due_on = excluded.due_on,
        period_start = excluded.period_start, period_end = excluded.period_end,
        total_amount = excluded.total_amount, paid_amount = excluded.paid_amount,
        status = excluded.status, synced_at = now()
    $f$, p_source, v_src)

    when 'payment' then format($f$
      insert into payment_snapshot (
        source, source_id, invoice_source_id, amount, channel, reference,
        paid_at, created_at_src, created_by_src, synced_at)
      select %L, m.source_id, m.invoice_source_id, m.amount, m.channel, m.reference,
             m.paid_at, m.created_at_src, m.created_by_src, now()
        from %I.map_payment m
      on conflict (source, source_id) do update set
        invoice_source_id = excluded.invoice_source_id, amount = excluded.amount,
        channel = excluded.channel, reference = excluded.reference,
        paid_at = excluded.paid_at, synced_at = now()
    $f$, p_source, v_src)

    when 'device' then format($f$
      insert into device_snapshot (
        source, source_id, imei, model, status, subscription_source_id,
        location, updated_at_src, synced_at)
      select %L, m.source_id, m.imei, m.model, m.status, m.subscription_source_id,
             m.location, m.updated_at_src, now()
        from %I.map_device m
      on conflict (source, source_id) do update set
        imei = excluded.imei, model = excluded.model, status = excluded.status,
        subscription_source_id = excluded.subscription_source_id,
        location = excluded.location, updated_at_src = excluded.updated_at_src,
        synced_at = now()
    $f$, p_source, v_src)

    else null
  end;

  if v_sql is null then
    raise exception 'Không biết thực thể %', p_entity;
  end if;

  execute v_sql;
  get diagnostics v_rows = row_count;

  update sync_run
     set finished_at = now(), status = 'OK', rows_written = v_rows
   where id = v_run;

  return v_rows;

exception when others then
  update sync_run
     set finished_at = now(), status = 'FAILED', error = sqlerrm
   where id = v_run;
  raise;
end $$;

/**
 * Chuẩn hoá số điện thoại để khớp hồ sơ khách giữa hai hệ thống.
 * Giữ chữ số, bỏ số 0 đầu, gắn mã quốc gia trong app_setting.
 */
create or replace function norm_phone(p_raw text)
returns text language plpgsql immutable as $$
declare
  v_digits text := regexp_replace(coalesce(p_raw, ''), '[^0-9]', '', 'g');
  v_cc     text := coalesce(
    (select value from app_setting where key = 'phone_country_code'), '');
begin
  if v_digits = '' then return null; end if;
  v_digits := regexp_replace(v_digits, '^0+', '');
  if v_cc <> '' and left(v_digits, length(v_cc)) <> v_cc then
    v_digits := v_cc || v_digits;
  end if;
  return '+' || v_digits;
end $$;

insert into app_setting (key, value, note) values
  ('phone_country_code', '', 'CHƯA ĐẶT — mã quốc gia không có dấu cộng, ví dụ 81 cho Nhật')
on conflict (key) do nothing;

/**
 * Một lượt đồng bộ đầy đủ. Thứ tự cố định: khách trước, rồi tới thứ tham
 * chiếu tới khách.
 */
create or replace function sync_all(p_triggered_by text default 'schedule')
returns table (source source_system, entity text, rows_written int)
language plpgsql as $$
declare
  v_src source_system;
  v_ent text;
begin
  foreach v_ent in array array['customer','subscription','invoice','payment','device'] loop
    foreach v_src in array array['TELECOM','FIXED']::source_system[] loop
      source := v_src; entity := v_ent;
      rows_written := sync_entity(v_src, v_ent, p_triggered_by);
      return next;
    end loop;
  end loop;
end $$;
