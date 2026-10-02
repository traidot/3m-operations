-- Danh sách lần tạo mã combini, lọc được theo tháng tạo và tình trạng.
--
-- Bảng tóm tắt theo tháng trả lời "bao nhiêu", danh sách này trả lời "những
-- cái nào". Dùng lại v_fixed_gmo_lan nên đơn vị vẫn là LẦN TẠO chứ không phải
-- mã: một lần sinh bốn mã combini cùng số tiền, đếm theo mã là nhân bốn.
--
-- Tình trạng tính đúng cùng công thức với v_fixed_gmo_thang, để bấm vào ô "108
-- hết hạn" của tháng 9 ra đúng 108 dòng.

create or replace view v_fixed_gmo_ds as
select l.lan,
       to_char(l.tao_luc, 'YYYY-MM')         as thang,
       case
         when l.da_tra then 'da_tra'
         when l.han_tra < now() then 'qua_han'
         else 'dang_cho'
       end                                   as tinh_trang,
       c.contract_code                       as ma_hd,
       c.dia_chi,
       c.trang_thai_hop_dong,
       l.tien,
       case when l.loai = 2 then 'cọc' else 'cước' end as loai_ten,
       l.ky_cuoc,
       l.tao_luc::date                       as ngay_tao,
       l.han_tra::date                       as ngay_het_han,
       l.tra_luc::date                       as ngay_tra,
       case when l.da_tra then null
            when l.han_tra < now() then (current_date - l.han_tra::date)
            else null end                    as qua_han_ngay,
       c.con_no,
       contract_url(l.contract_id)           as url
  from v_fixed_gmo_lan l
  left join v_fixed_contract c on c.subscription_id = l.contract_id;

comment on view v_fixed_gmo_ds is
  'Từng lần tạo mã combini kèm tình trạng — chi tiết đằng sau bảng mã combini theo tháng';
