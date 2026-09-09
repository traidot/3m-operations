-- Gộp hồ sơ khách giữa hai hệ thống.
--
-- Nguyên tắc: gộp sai tệ hơn không gộp. Ghép nhầm hai người thành một là
-- cộng nhầm công nợ của họ vào nhau, và người nợ thật thì không bị đòi.
-- Vì vậy chỉ tự động gộp khi khớp trên khoá định danh; giống tên thì đưa
-- vào hàng đợi cho người duyệt.

create extension if not exists pg_trgm;
create extension if not exists unaccent;

/**
 * Tìm hoặc tạo party cho một hồ sơ gốc, rồi ghi liên kết.
 * Gọi lại nhiều lần với cùng hồ sơ gốc không sinh thêm gì.
 */
create or replace function link_customer(
  p_source      source_system,
  p_customer_id text,
  p_name        text,
  p_phone       text,
  p_email       text,
  p_id_document text
) returns uuid language plpgsql as $$
declare
  v_phone text := norm_phone(p_phone);
  v_email text := lower(nullif(btrim(p_email), ''));
  v_hash  text := case when nullif(btrim(p_id_document), '') is null then null
                       else encode(digest(btrim(p_id_document), 'sha256'), 'hex') end;
  v_party uuid;
  v_rule  text;
begin
  -- Đã nối rồi thì chỉ làm mới thông tin, không đụng vào liên kết.
  select ps.party_id into v_party
    from party_source ps
   where ps.source = p_source
     and ps.source_customer_id = p_customer_id
     and ps.status <> 'REJECTED';

  if v_party is not null then
    update party
       set display_name = coalesce(nullif(btrim(p_name), ''), display_name),
           phone_norm   = coalesce(v_phone, phone_norm),
           email_norm   = coalesce(v_email, email_norm),
           id_hash      = coalesce(v_hash,  id_hash)
     where id = v_party;
    return v_party;
  end if;

  -- R1 điện thoại, R2 giấy tờ, R3 email. Xét theo thứ tự, dừng ở cái đầu khớp.
  if v_phone is not null then
    select id into v_party from party where phone_norm = v_phone limit 1;
    if v_party is not null then v_rule := 'R1_phone'; end if;
  end if;

  if v_party is null and v_hash is not null then
    select id into v_party from party where id_hash = v_hash limit 1;
    if v_party is not null then v_rule := 'R2_id_document'; end if;
  end if;

  if v_party is null and v_email is not null then
    select id into v_party from party where email_norm = v_email limit 1;
    if v_party is not null then v_rule := 'R3_email'; end if;
  end if;

  if v_party is null then
    insert into party (display_name, phone_norm, email_norm, id_hash)
    values (coalesce(nullif(btrim(p_name), ''), 'chưa có tên'), v_phone, v_email, v_hash)
    returning id into v_party;
    v_rule := 'R0_moi';
  else
    -- Bổ khuyết những trường party chưa có, không ghi đè trường đã có.
    update party
       set phone_norm = coalesce(phone_norm, v_phone),
           email_norm = coalesce(email_norm, v_email),
           id_hash    = coalesce(id_hash,    v_hash)
     where id = v_party;
  end if;

  insert into party_source (party_id, source, source_customer_id, match_rule, status)
  values (v_party, p_source, p_customer_id, v_rule,
          case when v_rule = 'R0_moi' then 'CONFIRMED' else 'AUTO' end);

  return v_party;
end $$;

create table if not exists merge_rejection (
  party_a     uuid not null,
  party_b     uuid not null,
  rejected_by text not null,
  rejected_at timestamptz not null default now(),
  primary key (party_a, party_b)
);

/**
 * Bỏ dấu và hạ chữ thường, chỉ để so sánh. Tên hiển thị vẫn giữ nguyên bản.
 * Không có bước này thì "Nguyễn Văn A" và "Nguyen Van A" chỉ giống 0.37 —
 * dưới ngưỡng, trong khi đó lại là kiểu trùng hay gặp nhất giữa hai hệ thống.
 */
create or replace function name_key(p_name text)
returns text language sql immutable as $$
  select lower(btrim(regexp_replace(
           unaccent(coalesce(p_name, '')), '\s+', ' ', 'g')));
$$;

/**
 * Hàng đợi duyệt trùng: tên gần giống nhưng chưa nối được bằng khoá định danh.
 * Chỉ gợi ý, không tự gộp.
 */
create or replace view v_merge_candidate as
select
  a.id                          as party_a,
  b.id                          as party_b,
  a.display_name                as ten_a,
  b.display_name                as ten_b,
  a.phone_norm                  as dien_thoai_a,
  b.phone_norm                  as dien_thoai_b,
  round(similarity(name_key(a.display_name), name_key(b.display_name))::numeric, 2) as do_giong
from party a
join party b
  on b.id > a.id
 and similarity(name_key(a.display_name), name_key(b.display_name)) > 0.6
where a.phone_norm is distinct from b.phone_norm
  and not exists (
    select 1 from merge_rejection r
     where r.party_a = least(a.id, b.id) and r.party_b = greatest(a.id, b.id));

/**
 * Gộp hai party. Giữ p_keep, chuyển mọi liên kết và ảnh chụp sang, rồi xoá
 * party bị gộp. Không xoá dữ liệu gốc — chỉ đổi chỗ trỏ.
 */
create or replace function merge_parties(
  p_keep uuid, p_drop uuid, p_by text
) returns void language plpgsql as $$
begin
  if p_keep = p_drop then
    raise exception 'Không gộp một party vào chính nó';
  end if;

  update party_source          set party_id = p_keep where party_id = p_drop;
  update subscription_snapshot set party_id = p_keep where party_id = p_drop;
  update invoice_snapshot      set party_id = p_keep where party_id = p_drop;
  update payment_snapshot      set party_id = p_keep where party_id = p_drop;
  update loan_record           set party_id = p_keep where party_id = p_drop;

  update party_source
     set status = 'CONFIRMED', reviewed_by = p_by, reviewed_at = now()
   where party_id = p_keep and status = 'AUTO';

  update party k
     set phone_norm = coalesce(k.phone_norm, d.phone_norm),
         email_norm = coalesce(k.email_norm, d.email_norm),
         id_hash    = coalesce(k.id_hash,    d.id_hash)
    from party d
   where k.id = p_keep and d.id = p_drop;

  delete from party where id = p_drop;
end $$;

/**
 * Bác một cặp gợi ý. Lần sau không hỏi lại cặp đó nữa.
 */
create or replace function reject_merge(
  p_a uuid, p_b uuid, p_by text
) returns void language sql as $$
  insert into merge_rejection (party_a, party_b, rejected_by)
  values (least(p_a, p_b), greatest(p_a, p_b), p_by)
  on conflict do nothing;
$$;
