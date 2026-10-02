-- Mã combini theo tháng tạo: bao nhiêu mã chết.
--
-- Mẫu số phải là phần ĐÃ CÓ KẾT CỤC (đã trả + đã hết hạn), không phải tổng số
-- mã tạo ra. Mã vừa tạo hôm qua chưa tới hạn thì chưa biết khách có trả hay
-- không — đếm nó vào mẫu số là tháng đang chạy nào cũng trông tệ, và càng gần
-- cuối tháng con số càng "đẹp lên" một cách giả tạo.
--
-- Khác biệt không nhỏ: tháng 9 có 525 trả / 108 chết / 173 còn đang chờ. Lấy
-- 525 chia 806 ra 65% nghe như xấu hơn tháng 8 (70%), nhưng tính trên phần đã
-- ngã ngũ thì tháng 9 chết 17% còn tháng 8 chết 30% — ngược hẳn kết luận.

create or replace view v_fixed_gmo_thang as
select to_char(tao_luc, 'YYYY-MM')                                   as thang,
       count(*)                                                      as tao,
       count(*) filter (where da_tra)                                as da_tra,
       count(*) filter (where not da_tra and han_tra < now())         as chet,
       count(*) filter (where not da_tra and (han_tra is null or han_tra >= now()))
                                                                     as dang_cho,
       sum(tien) filter (where da_tra)                               as tien_tra,
       sum(tien) filter (where not da_tra and han_tra < now())        as tien_chet,
       sum(tien) filter (where not da_tra and (han_tra is null or han_tra >= now()))
                                                                     as tien_cho,
       -- Null khi chưa mã nào ngã ngũ: tháng mới mở thì chia cho 0, mà ghi 0%
       -- thì đọc ra thành "tháng này chưa chết cái nào", sai hẳn nghĩa.
       case
         when count(*) filter (where da_tra or han_tra < now()) = 0 then null
         else round(100.0 * count(*) filter (where not da_tra and han_tra < now())
                    / count(*) filter (where da_tra or han_tra < now()), 1)
       end                                                           as ty_le_chet
  from v_fixed_gmo_lan
 group by 1;

comment on view v_fixed_gmo_thang is
  'Mã combini theo tháng tạo — tỷ lệ chết tính trên phần đã có kết cục, mã còn trong hạn để riêng';
