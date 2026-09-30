-- Thuê bao cho mượn chờ wifi cố định không có trang chi tiết bên CMS.
--
-- Bấm "Mở thuê bao bên CMS" ở nhóm này thì CMS đá về danh sách trống, nhìn
-- như thuê bao không tồn tại. Thực ra nó nằm ở màn riêng
-- /subscriptions/lend-for-fixed-wifi, nơi mã dịch vụ chỉ là chữ chứ không
-- phải link — không có trang chi tiết để mà trỏ tới.
--
-- Màn đó nhận ?search= nên vẫn mở thẳng được đúng một dòng, tìm theo MÃ MÁY.
-- Đã thử trên CMS thật: search=861720051133255 ra đúng DV04151.

create or replace function telecom_url(p_loai text, p_id text)
returns text language sql immutable as $$
  select case
    when p_id is null then null
    when p_loai = 'cho_muon' then
      (select value from app_setting where key = 'telecom_cms_url') ||
      '/subscriptions/lend-for-fixed-wifi?page=1&limit=25&search=' || p_id
    else (select value from app_setting where key = 'telecom_cms_url') ||
         case p_loai
           when 'khach'    then '/customers/'
           when 'thue_bao' then '/subscriptions/subscription-customer/'
           when 'hoa_don'  then '/finance/invoices/'
         end || p_id || '/detail'
  end;
$$;

comment on function telecom_url(text, text) is
  'Đường dẫn CMS telecom. Loại cho_muon nhận MÃ MÁY chứ không phải id thuê bao';

alter table subscription_snapshot
  add column if not exists cho_muon_cd boolean not null default false;

comment on column subscription_snapshot.cho_muon_cd is
  'Đơn cho mượn cục wifi trong lúc khách chờ lắp wifi cố định';
