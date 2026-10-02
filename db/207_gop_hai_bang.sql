-- Gộp hai bảng tách rời của mục 6 và mục 7 thành một bảng hai chiều.
--
-- Trước đây mỗi mục có bảng "theo tháng/theo tuổi chờ" rồi bảng "theo loại"
-- đứng riêng bên dưới. Hai bảng cùng một đống dữ liệu, cắt theo hai chiều, mà
-- muốn biết "tháng 9 mã thu cọc chết bao nhiêu" thì không bảng nào trả lời
-- được — phải tự nhân chéo trong đầu.

create or replace view v_fixed_gmo_thang_loai as
select to_char(tao_luc, 'YYYY-MM')                                   as thang,
       nhom_tien,
       case nhom_tien
         when 'cuoc'       then 'Cước hàng tháng'
         when 'coc_tplink' then 'Cọc cục TP Link'
         else 'Cọc, không ghi rõ'
       end                                                           as ten,
       count(*)                                                      as tao,
       count(*) filter (where da_tra)                                as da_tra,
       count(*) filter (where not da_tra and han_tra < now())         as chet,
       count(*) filter (where not da_tra and (han_tra is null or han_tra >= now()))
                                                                     as dang_cho,
       count(distinct contract_id) filter (where not da_tra and han_tra < now())
                                                                     as hop_dong_hong,
       sum(tien) filter (where da_tra)                               as tien_tra,
       case
         when count(*) filter (where da_tra or han_tra < now()) = 0 then null
         else round(100.0 * count(*) filter (where not da_tra and han_tra < now())
                    / count(*) filter (where da_tra or han_tra < now()), 1)
       end                                                           as ty_le_chet
  from v_fixed_gmo_lan
 group by 1, 2;

comment on view v_fixed_gmo_thang_loai is
  'Mã combini cắt đồng thời theo tháng tạo và thứ đang thu';

create or replace view v_fixed_coc_cho_duyet_o as
select bac,
       case bac
         when 1 then 'mới, 0-3 ngày'
         when 2 then '4-7 ngày'
         when 3 then '8-14 ngày'
         when 4 then '15-30 ngày'
         else 'trên 30 ngày'
       end                                   as nhom,
       nhom_tien,
       case nhom_tien
         when 'cuoc'       then 'Cước hàng tháng'
         when 'coc_tplink' then 'Cọc cục TP Link'
         when 'coc_khac'   then 'Cọc, không ghi rõ'
         else 'Không nối được mã'
       end                                   as ten,
       count(*)                              as so_phieu,
       sum(tien)                             as tien,
       count(*) filter (where not co_san_thang) as phai_tu_tra,
       max(cho_ngay)                         as lau_nhat
  from v_fixed_coc_cho_phan_bo
 group by 1, 3;

comment on view v_fixed_coc_cho_duyet_o is
  'Phiếu cọc chờ duyệt cắt đồng thời theo tuổi chờ và thứ đang thu';
