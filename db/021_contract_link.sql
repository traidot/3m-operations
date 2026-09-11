-- Bấm vào hợp đồng thì mở thẳng màn hình hợp đồng bên hệ thống nguồn.
-- Lớp giám sát chỉ đọc, nên mọi thao tác sửa đều phải quay về đó.

insert into app_setting (key, value, note) values
  ('fixed_cms_contract_url', 'https://cms-wifi.deepsync.vn/contracts/',
   'Tiền tố URL màn hình hợp đồng wifi cố định; nối thêm id hợp đồng')
on conflict (key) do nothing;

create or replace function contract_url(p_subscription_id text)
returns text language sql stable as $$
  select case
    when p_subscription_id is null then null
    else (select value from app_setting where key = 'fixed_cms_contract_url')
         || p_subscription_id
  end;
$$;
