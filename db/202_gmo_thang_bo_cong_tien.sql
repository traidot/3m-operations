-- Bảng mã combini theo tháng: bỏ phép cộng tiền, thêm số hợp đồng.
--
-- Cột "tiền chết" cộng tiền của mọi lần tạo mã hết hạn trong tháng, mà một
-- hợp đồng tạo lại tới bốn lần cho cùng một khoản — cộng là nhân bản. Thay
-- bằng số HỢP ĐỒNG riêng biệt: đó mới là thứ đếm được mà không trùng.
--
-- Tiền của nhóm này đã có chỗ khác lo (v_fixed_gmo_het_han_tom_tat, lấy nợ
-- thật một lần cho mỗi hợp đồng), nên bảng theo tháng chỉ còn đo chất lượng
-- khâu tạo mã: tạo ra bao nhiêu, bao nhiêu cái khách trả, bao nhiêu cái hỏng.

-- Drop rồi tạo lại chứ không replace: đổi cả tên lẫn kiểu của cột cuối, mà
-- create or replace view chỉ cho nối thêm cột. Không view nào phụ thuộc vào
-- view này.
drop view if exists v_fixed_gmo_thang;

create view v_fixed_gmo_thang as
select to_char(tao_luc, 'YYYY-MM')                                   as thang,
       count(*)                                                      as tao,
       count(*) filter (where da_tra)                                as da_tra,
       count(*) filter (where not da_tra and han_tra < now())         as chet,
       count(*) filter (where not da_tra and (han_tra is null or han_tra >= now()))
                                                                     as dang_cho,
       sum(tien) filter (where da_tra)                               as tien_tra,
       count(distinct contract_id) filter (where not da_tra and han_tra < now())
                                                                     as hop_dong_hong,
       sum(tien) filter (where not da_tra and (han_tra is null or han_tra >= now()))
                                                                     as tien_cho,
       case
         when count(*) filter (where da_tra or han_tra < now()) = 0 then null
         else round(100.0 * count(*) filter (where not da_tra and han_tra < now())
                    / count(*) filter (where da_tra or han_tra < now()), 1)
       end                                                           as ty_le_chet
  from v_fixed_gmo_lan
 group by 1;

comment on view v_fixed_gmo_thang is
  'Mã combini theo tháng tạo — đếm lần tạo và số hợp đồng, không cộng tiền vì một hợp đồng tạo lại nhiều lần cho cùng một khoản';
