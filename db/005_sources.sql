-- Nối tới hai database nguồn qua postgres_fdw.
-- Cả ba instance nằm trên cùng VPS nên đi qua localhost, không ra internet.
--
-- TRƯỚC KHI CHẠY FILE NÀY, tạo role chỉ đọc trên TỪNG database nguồn:
--
--   create role monitor_ro login password '...';
--   grant connect on database <ten_db> to monitor_ro;
--   grant usage on schema public to monitor_ro;
--   grant select on all tables in schema public to monitor_ro;
--   alter default privileges in schema public grant select on tables to monitor_ro;
--
-- Không dùng tài khoản của ứng dụng. Một câu query viết ẩu ở lớp giám sát
-- không được phép ghi hay khoá bảng của hệ thống đang phục vụ khách.

create extension if not exists postgres_fdw;

-- Sửa dbname và port cho khớp thực tế.
create server src_telecom_srv foreign data wrapper postgres_fdw
  options (host 'localhost', port '5432', dbname 'telecom');

create server src_fixed_srv foreign data wrapper postgres_fdw
  options (host 'localhost', port '5433', dbname 'fixed_wifi');

-- Mật khẩu nằm trong pg_user_mappings, superuser đọc được.
-- Đây là mật khẩu của role chỉ đọc nên thiệt hại giới hạn, nhưng vẫn phải
-- là mật khẩu riêng, không dùng lại ở đâu khác.
create user mapping for current_user server src_telecom_srv
  options (user 'monitor_ro', password 'DAT_MAT_KHAU_O_DAY');

create user mapping for current_user server src_fixed_srv
  options (user 'monitor_ro', password 'DAT_MAT_KHAU_O_DAY');

create schema if not exists src_telecom;
create schema if not exists src_fixed;

-- Kéo lược đồ bảng từ xa về. Chỉ liệt kê bảng thật sự cần, đừng import cả schema.
--   import foreign schema public limit to (customers, subscriptions, invoices, payments, devices)
--     from server src_telecom_srv into src_telecom;
--   import foreign schema public limit to (...)
--     from server src_fixed_srv into src_fixed;

-- ─────────────────────────────────────────────────────────────────────
-- HỢP ĐỒNG ÁNH XẠ
--
-- Mỗi schema nguồn phải có đúng năm view dưới đây với đúng tên cột này.
-- Đó là chỗ duy nhất phụ thuộc lược đồ nội bộ của từng hệ thống — máy đồng
-- bộ ở 006 không biết gì về bảng gốc, nên đổi schema bên kia chỉ phải sửa
-- năm view, không phải sửa gì khác.
--
-- Cột nào hệ thống nguồn không có thì để `null::<kiểu> as <ten>`.
-- Riêng created_at_src và created_by_src null sẽ tự loại bản ghi đó khỏi
-- nhóm chỉ số nhập kịp — hệ thống vẫn chạy, chỉ mất phép đo đó.
--
--   map_customer     (source_customer_id, full_name, phone, email, id_document,
--                     created_at_src, created_by_src)
--   map_subscription (source_id, source_customer_id, service_type, plan_name, status,
--                     monthly_price, monthly_cost, activated_on, terminated_on,
--                     anchor_day, device_ref, sim_ref,
--                     created_at_src, updated_at_src, created_by_src)
--   map_invoice      (source_id, source_customer_id, subscription_source_id, number,
--                     issued_on, due_on, period_start, period_end,
--                     total_amount, paid_amount, status,
--                     created_at_src, created_by_src)
--   map_payment      (source_id, source_customer_id, invoice_source_id, amount,
--                     channel, reference, paid_at,
--                     created_at_src, created_by_src)
--   map_device       (source_id, imei, model, status, subscription_source_id,
--                     location, updated_at_src)
--
-- status phải quy về đúng bộ giá trị dùng trong kho:
--   subscription: PENDING | ACTIVE | SUSPENDED | TERMINATED
--   invoice:      ISSUED | PAID | VOID | WRITTEN_OFF
--   device:       IN_STOCK | ASSIGNED | ON_LOAN | IN_REPAIR | LOST
-- Quy đổi ngay trong view bằng case, đừng để máy đồng bộ đoán.
-- ─────────────────────────────────────────────────────────────────────
