-- Khách lẻ và khách đại lý là hai loại khác nhau, gộp chung thì mọi con số
-- tổng đều lệch: một party đại lý giữ 802 thuê bao đứng cạnh khách lẻ một
-- thuê bao trong cùng một bảng.
--
-- Hai trường bên nguồn, giữ cả hai vì chúng nói hai chuyện khác nhau:
--   customerType     CUSTOMER | COLLABORATOR | AGENCY — vai trò
--   customerGroupId  nhóm nghiệp vụ, trong đó có "NHÓM KHÁCH HÀNG WF CỐ ĐỊNH"
--                    967 người — khách wifi cố định nằm trong hệ telecom
--
-- Để ở party_source chứ không ở party: đây là thuộc tính theo từng nguồn, một
-- party gộp từ nhiều nguồn có thể mang vai trò khác nhau ở mỗi bên.

alter table party_source
  add column if not exists customer_type  text,
  add column if not exists customer_group text;

comment on column party_source.customer_type is
  'Vai trò bên nguồn: khách lẻ, cộng tác viên, hay đại lý';
comment on column party_source.customer_group is
  'Nhóm nghiệp vụ bên nguồn, tên nguyên văn';

/** Dịch mã vai trò sang chữ đọc được, dùng chung cho web và quy tắc. */
create or replace function customer_type_label(p_ma text)
returns text language sql immutable as $$
  select case p_ma
           when 'CUSTOMER'     then 'khách lẻ'
           when 'COLLABORATOR' then 'cộng tác viên'
           when 'AGENCY'       then 'đại lý'
           else coalesce(p_ma, 'chưa phân loại')
         end;
$$;
