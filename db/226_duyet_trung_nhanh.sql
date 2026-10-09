-- Hàng đợi duyệt trùng: 1,9 giây xuống dưới một phần mười.
--
-- View so MỌI cặp khách với nhau: 3.864 × 1.931 ≈ 7,4 triệu lần gọi
-- similarity(), không chỉ mục nào đỡ được vì điều kiện viết bằng hàm.
--
-- pg_trgm có toán tử `%` dùng được chỉ mục GIN. Nó lọc thô theo ngưỡng phiên
-- (mặc định 0.3), rồi điều kiện similarity > 0.6 giữ nguyên để lọc tinh —
-- KẾT QUẢ KHÔNG ĐỔI, chỉ bớt số cặp phải tính thật.
--
-- Giữ cả hai điều kiện chứ không bỏ cái nào: `%` một mình thì lỏng hơn 0.6 và
-- hàng đợi phình ra, còn similarity một mình thì lại quét toàn bảng như cũ.

create index if not exists party_name_key_trgm
    on party using gin (name_key(display_name) gin_trgm_ops);

create or replace view v_merge_candidate as
select a.id                                   as party_a,
       b.id                                   as party_b,
       a.display_name                         as ten_a,
       b.display_name                         as ten_b,
       a.phone_norm                           as dien_thoai_a,
       b.phone_norm                           as dien_thoai_b,
       round(similarity(name_key(a.display_name), name_key(b.display_name))::numeric, 2) as do_giong
  from party a
  join party b
    on b.id > a.id
   and name_key(a.display_name) % name_key(b.display_name)
   and similarity(name_key(a.display_name), name_key(b.display_name)) > 0.6::double precision
 where a.phone_norm is distinct from b.phone_norm
   and not exists (select 1 from merge_rejection r
                    where r.party_a = least(a.id, b.id)
                      and r.party_b = greatest(a.id, b.id));

comment on view v_merge_candidate is
  'Cặp khách giống tên mà khác điện thoại — lọc thô bằng chỉ mục trigram rồi lọc tinh bằng similarity';
