-- Địa chỉ màn duyệt phiếu cọc bên CMS, để màn giám sát dẫn thẳng sang chỗ làm.
--
-- Để cạnh fixed_cms_contract_url chứ không viết cứng trong code web: hai nơi
-- cùng trỏ về một hệ thống, đổi tên miền thì sửa một chỗ.
--
-- Màn đó dựng bộ lọc bằng useState chứ không đọc query string, nên KHÔNG
-- deep-link theo mã hợp đồng được — mở ra là danh sách mặc định đã lọc sẵn
-- "Chờ duyệt", người dùng tự gõ mã vào ô tìm.

insert into app_setting (key, value, note)
values ('fixed_cms_deposit_url',
        'https://cms-wifi.deepsync.vn/fee-payments/deposit-allocations',
        'Màn duyệt phân bổ cọc/GMO bên CMS; không nhận tham số lọc trên URL')
on conflict (key) do update set value = excluded.value, note = excluded.note;
