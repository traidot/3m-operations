-- Bấm từ ngăn kéo sang thẳng màn hình tương ứng bên CMS cầm tay.
-- Lớp giám sát chỉ đọc, nên mọi thao tác sửa đều phải quay về đó.

insert into app_setting (key, value, note) values
  ('telecom_cms_url', 'https://telecom-system-cms.human-life.vn',
   'Gốc URL của CMS wifi cầm tay, không có dấu / ở cuối')
on conflict (key) do update set value = excluded.value, note = excluded.note;

/**
 * Đường dẫn màn hình bên CMS cầm tay.
 *   khach      /customers/{id}/detail                              id là mã khách nguồn
 *   thue_bao   /subscriptions/subscription-customer/{id}/detail    id là mã thuê bao nguồn
 *   hoa_don    /finance/invoices/{id}/detail                       id là mã hoá đơn nguồn
 */
create or replace function telecom_url(p_loai text, p_id text)
returns text language sql stable as $$
  select case
    when p_id is null then null
    else (select value from app_setting where key = 'telecom_cms_url') ||
         case p_loai
           when 'khach'    then '/customers/'
           when 'thue_bao' then '/subscriptions/subscription-customer/'
           when 'hoa_don'  then '/finance/invoices/'
         end || p_id || '/detail'
  end;
$$;
