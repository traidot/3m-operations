-- Mã khách hàng bên telecom (KH03901) đang bị ánh xạ nhầm vào id_document.
--
-- id_document dành cho giấy tờ tuỳ thân nên kho chỉ giữ bản băm, không giữ
-- chuỗi gốc — đúng với số hộ chiếu, sai với một mã nghiệp vụ mà người dùng cần
-- đọc và tra cứu. Hệ quả: 3.746 party đều có id_hash mà chưa bao giờ khớp được
-- với nhau (mã là duy nhất từng khách), nên băm vừa vô dụng vừa giấu mất mã.
--
-- Chuyển sang cột riêng, và xoá đám băm vô nghĩa đi.

alter table party_source add column if not exists customer_code text;

comment on column party_source.customer_code is
  'Mã khách hiển thị bên nguồn, ví dụ KH03901; khác source_customer_id là khoá kỹ thuật';

create index if not exists party_source_ma on party_source (customer_code)
  where customer_code is not null;

update party set id_hash = null where id_hash is not null;
