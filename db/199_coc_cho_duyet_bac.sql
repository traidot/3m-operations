-- Gắn số bậc tuổi chờ vào từng phiếu, để bấm một dòng của bảng tóm tắt là mở
-- đúng những phiếu nằm trong dòng đó.
--
-- Bậc định nghĩa đúng một chỗ ở đây rồi cả bảng tóm tắt lẫn danh sách chi tiết
-- cùng đọc từ nó — để hai nơi tự chia khoảng thì sớm muộn cũng lệch, và lúc đó
-- bấm vào dòng "20 phiếu" lại ra 19 cái.

create or replace function coc_bac_cho(cho_ngay integer) returns integer
language sql immutable as $$
  select case
           when cho_ngay <= 3  then 1
           when cho_ngay <= 7  then 2
           when cho_ngay <= 14 then 3
           when cho_ngay <= 30 then 4
           else 5
         end
$$;

comment on function coc_bac_cho(integer) is
  'Bậc tuổi chờ của phiếu cọc: 1 = 0-3 ngày … 5 = trên 30 ngày';

create or replace view v_fixed_coc_cho_phan_bo as
select d.source_id,
       d.contract_code                       as ma_hd,
       c.dia_chi,
       d.amount                              as tien,
       d.paid_at::date                       as ngay_tra,
       (current_date - d.paid_at::date)      as cho_ngay,
       d.channel,
       d.note                                as ghi_chu,
       c.con_no,
       contract_url(d.subscription_source_id) as url,
       coalesce(jsonb_array_length(d.allocations), 0) > 0 as co_san_thang,
       d.allocations                         as phan_bo,
       coc_bac_cho((current_date - d.paid_at::date)::integer) as bac
  from deposit_allocation_snapshot d
  left join v_fixed_contract c on c.subscription_id = d.subscription_source_id
 where d.source = 'FIXED' and d.status = 'PENDING';

comment on view v_fixed_coc_cho_phan_bo is
  'Phiếu cọc đã thu tiền, CMS gọi là "Chờ duyệt" — kèm phiếu nào đã điền sẵn tháng cước và bậc tuổi chờ';

create or replace view v_fixed_coc_cho_duyet_nhom as
select bac,
       case bac
         when 1 then 'mới, 0-3 ngày'
         when 2 then '4-7 ngày'
         when 3 then '8-14 ngày'
         when 4 then '15-30 ngày'
         else 'trên 30 ngày'
       end                                   as nhom,
       count(*)                              as so_phieu,
       sum(tien)                             as tien,
       count(*) filter (where not co_san_thang) as phai_tu_tra,
       max(cho_ngay)                         as lau_nhat
  from v_fixed_coc_cho_phan_bo
 group by bac;

comment on view v_fixed_coc_cho_duyet_nhom is
  'Phiếu cọc chờ duyệt gom theo tuổi chờ — bản tóm tắt của màn deposit-allocations bên CMS';
