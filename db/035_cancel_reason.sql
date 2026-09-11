-- Lý do huỷ bên nguồn là ô chữ tự do: 2.348 dòng có ghi nhưng 582 cách viết,
-- lẫn tiếng Nhật với tiếng Việt sai chính tả ("khôg phản hồi", "khách chuyeenr
-- nhà"). Gom nguyên văn thì bảng thống kê vô dụng, nên phải xếp nhóm.
--
-- cancelReasonManager rỗng hoàn toàn nên chỉ có cancelReasonProvider.

alter table subscription_snapshot
  add column if not exists cancel_reason text;

comment on column subscription_snapshot.cancel_reason is
  'Lý do huỷ, nguyên văn từ nguồn — chữ tự do, xem cancel_reason_group()';

/**
 * Xếp câu lý do tự do vào một nhóm.
 *
 * Khớp theo từ khoá trên chuỗi đã bỏ dấu và hạ chữ thường, nên bắt được cả lỗi
 * chính tả xoay quanh từ khoá ("khôg phản hồi" vẫn còn "phan hoi"). Vài biến
 * thể làm hỏng chính từ khoá thì phải liệt kê riêng.
 *
 * Thứ tự các nhánh có ý nghĩa: nhánh trên chặn trước nhánh dưới.
 */
create or replace function cancel_reason_group(p_ly_do text)
returns text language sql immutable as $$
  with t as (select lower(unaccent(coalesce(p_ly_do, ''))) as s, coalesce(p_ly_do, '') as goc)
  select case
    when t.s = '' then null

    -- Nhà mạng không cung cấp được. Để trên cùng vì câu tiếng Nhật hay kèm
    -- chữ "キャンセル" chung chung.
    when t.goc like '%提供%' or t.goc like '%西日本%' or t.goc like '%他社%'
      or t.s like '%khu vuc%' or t.s like '%khu vưc%' or t.s like '%tay nhat%'
      or t.goc like '%NTT%'   or t.goc like '%クロスファミリー%'
      then 'NHA_MANG_TU_CHOI'

    when t.goc like '%電波%' or t.s like '%song yeu%' then 'SONG_YEU'

    when t.s like '%lien lac%' or t.s like '%lien he%' or t.s like '%phan hoi%'
      or t.s like '%tra loi%'  or t.s like '%block%' or t.s like '%blok%'
      or t.s like '%khach chan%' or t.s like '%khong ll%'
      or t.goc like '%連絡%' or t.goc like '%返信%'
      then 'KHONG_LIEN_LAC'

    when t.s like '%chuyen nha%' or t.s like '%chuyeenr%' or t.s like '%ve nuoc%'
      or t.goc like '%引越%' or t.goc like '%引っ越%'
      then 'CHUYEN_NHA'

    when t.s like '%khong cho lap%' or t.s like '%quan ly%' or t.s like '%chu nha%'
      or t.s like '%toa nha%' or t.s like '%leopalace%' or t.s like '%duong ong%'
      then 'TOA_NHA_TU_CHOI'

    -- Đơn trùng hoặc nhập sai địa chỉ: lỗi khâu nhập liệu bên mình, không phải
    -- khách bỏ đi, nên tách khỏi nhóm khách đăng ký chỗ khác.
    when t.s like '%trung kien%' or t.s like '%trung voi%' or t.s like '%trung don%'
      or t.s like '%trung dia chi%' or t.s like '%nham dia chi%' or t.s like '%sai dia chi%'
      or t.s like '%dang ky trung%' or t.s like '%huy do trung%'
      then 'DON_TRUNG_HOAC_SAI'

    when t.s like '%ben khac%' or t.s like '%da co mang%'
      or t.s like '%noi khac%' or t.goc like '%申込%' or t.goc like '%別%'
      then 'DA_DANG_KY_NOI_KHAC'

    when t.s like '%het slot%' then 'HET_SLOT'

    when t.s like '%khong doi%' or t.s like '%khong cho duoc%' or t.s like '%lau qua%'
      then 'KHACH_KHONG_CHO_DUOC'

    when t.s like '%khong muon%' or t.s like '%khong con nhu cau%'
      or t.s like '%khong hop tac%' or t.s like '%khach huy%'
      or t.s like '%yeu cau huy%' or t.s like '%khong can nua%' or t.s like '%lua dao%'
      or t.goc like '%都合%'
      then 'KHACH_DOI_Y'

    else 'KHAC'
  end
  from t;
$$;

/**
 * Lý do huỷ theo lứa đăng ký, kèm mốc huỷ để biết mất khách ở khâu nào.
 * Lọc theo ngày ký cho khớp với fixed_register_report.
 */
drop view if exists v_fixed_cancel_reason;
drop function if exists fixed_cancel_reason_report(date, date);
create function fixed_cancel_reason_report(p_tu date default null, p_den date default null)
returns table (
  nhom        text,
  so_hop_dong bigint,
  truoc_lich  bigint,
  sau_lich    bigint,
  sau_lap     bigint
)
language sql stable as $$
  select
    coalesce(cancel_reason_group(s.cancel_reason), 'KHONG_GHI'),
    count(*),
    count(*) filter (where s.cancel_timing = 'BEFORE_SCHEDULE'),
    count(*) filter (where s.cancel_timing = 'AFTER_SCHEDULE' and o.completed_on is null),
    count(*) filter (where s.cancel_timing = 'AFTER_SCHEDULE' and o.completed_on is not null)
  from subscription_snapshot s
  left join install_order_snapshot o
         on o.source = 'FIXED' and o.source_id = s.source_id
  where s.source = 'FIXED' and s.status = 'TERMINATED'
    and (p_tu  is null or o.signed_on >= p_tu)
    and (p_den is null or o.signed_on <= p_den)
  group by 1
  order by 2 desc;
$$;
