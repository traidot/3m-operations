-- Sửa cách đo "mã combini hết hạn". Số cũ phóng đại 3,3 lần.
--
-- Cộng tiền của mọi lần tạo mã hết hạn ra 787.149 yên, và màn hình gọi đó là
-- "tiền đã hẹn thu mà khách không ra trả". Sai hai lần:
--
--  1. CỘNG TRÙNG. 219 lần hết hạn chỉ thuộc 170 hợp đồng — mã hỏng thì người
--     ta tạo mã mới cho đúng khoản đó, có hợp đồng tạo lại tới bốn lần. Cộng
--     cả bốn là cộng cùng một khoản nợ bốn lần.
--  2. PHẦN LỚN ĐÃ THU ĐƯỢC. 88 trên 170 hợp đồng giờ không còn nợ đồng nào:
--     khách trả bằng mã sau, bằng chuyển khoản, hoặc trừ cọc. Mã hỏng không có
--     nghĩa là tiền mất.
--
-- Nợ thật của nhóm này là 236.000 yên ở 82 hợp đồng. Còn con số 219 vẫn đáng
-- giữ nhưng với tên khác: đó là số LẦN HẸN THU HỎNG, đo chất lượng khâu tạo
-- mã chứ không phải tiền.

create or replace view v_fixed_gmo_qua_han as
select l.lan,
       c.contract_code                       as ma_hd,
       c.dia_chi,
       c.trang_thai_hop_dong,
       l.tien,
       case when l.loai = 2 then 'cọc' else 'cước' end as loai_ten,
       l.ky_cuoc,
       l.tao_luc::date                       as ngay_tao,
       l.han_tra::date                       as ngay_het_han,
       (current_date - l.han_tra::date)      as qua_han_ngay,
       c.con_no,
       contract_url(l.contract_id)           as url,
       -- Hai cột này nối vào CUỐI: create or replace view chỉ cho thêm cột ở
       -- cuối, chèn vào giữa là Postgres từ chối.
       --
       -- Hợp đồng này có lần tạo mã nào khác đã được trả chưa: mã hỏng mà sau
       -- đó khách vẫn trả thì chỉ là một lần hẹn trượt, không phải tiền mất.
       exists (select 1 from v_fixed_gmo_lan l2
                where l2.contract_id = l.contract_id and l2.da_tra) as da_tra_ma_khac,
       (select count(*) from v_fixed_gmo_lan l3
         where l3.contract_id = l.contract_id and not l3.da_tra and l3.han_tra < now())
                                             as so_lan_hong
  from v_fixed_gmo_lan l
  left join v_fixed_contract c on c.subscription_id = l.contract_id
 where not l.da_tra and l.han_tra is not null and l.han_tra < now();

comment on view v_fixed_gmo_qua_han is
  'Từng lần tạo mã combini hết hạn — đơn vị là LẦN HẸN, không cộng tiền được vì một hợp đồng tạo lại nhiều lần';

-- Tóm tắt đúng đơn vị: hợp đồng, và nợ thật của hợp đồng đó.
create or replace view v_fixed_gmo_het_han_tom_tat as
with het as (
  select l.contract_id, count(*) as so_lan
    from v_fixed_gmo_lan l
   where not l.da_tra and l.han_tra is not null and l.han_tra < now()
   group by 1
)
select count(*)                                      as hop_dong,
       sum(h.so_lan)                                 as lan_hen_hong,
       count(*) filter (where c.con_no > 0)          as hop_dong_con_no,
       coalesce(sum(c.con_no), 0)                    as no_that,
       count(*) filter (where c.con_no = 0)          as da_thu_duong_khac
  from het h
  left join v_fixed_contract c on c.subscription_id = h.contract_id;

comment on view v_fixed_gmo_het_han_tom_tat is
  'Mã combini hết hạn tính theo hợp đồng và nợ thật, thay cho phép cộng tiền từng lần vốn trùng lặp';
