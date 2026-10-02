-- Phiếu cọc chờ duyệt: thu cái gì — cước, cọc cục TP Link, hay cọc không ghi rõ.
--
-- Phiếu nào cũng do một mã combini đã trả mở ra, nên thừa hưởng được cách phân
-- loại của mã đó (v_fixed_gmo_lan.nhom_tien, db/205).
--
-- Số liệu lộ ra một chuyện làm em phải nói lại kết luận cũ. Cột "phải tự tra"
-- (lúc tạo mã không chọn sẵn tháng cước) chia theo loại:
--
--   cọc TP Link        45/45  phải tự tra
--   cọc không ghi rõ   29/29  phải tự tra
--   cước hàng tháng     2/14  phải tự tra
--
-- Tức mã thu CỌC gần như không bao giờ chọn sẵn tháng — mà đúng thế: tiền cọc
-- không thuộc tháng cước nào cả, có muốn chọn cũng không có gì để chọn. Trước
-- đây nhìn con số 73/104 rồi kết luận "khâu tạo mã làm ẩu" là sai: ẩu chỉ có
-- 2 trường hợp, đều ở nhóm cước. Phần còn lại là việc của người duyệt — quyết
-- định cọc đó chuyển thành cước tháng nào, hay giữ nguyên làm cọc.

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
       coc_bac_cho((current_date - d.paid_at::date)::integer) as bac,
       coalesce(l.nhom_tien, 'khong_ro')     as nhom_tien
  from deposit_allocation_snapshot d
  left join v_fixed_contract c on c.subscription_id = d.subscription_source_id
  left join gmo_payment_snapshot g
    on g.source = 'FIXED' and g.phieu_coc_id = d.source_id
  left join v_fixed_gmo_lan l on l.lan = coalesce(g.batch_id, g.source_id)
 where d.source = 'FIXED' and d.status = 'PENDING';

comment on view v_fixed_coc_cho_phan_bo is
  'Phiếu cọc đã thu tiền, CMS gọi là "Chờ duyệt" — kèm bậc tuổi chờ và thu cái gì (cước / cọc TP Link / cọc không ghi rõ)';

create or replace view v_fixed_coc_cho_duyet_loai as
select nhom_tien,
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
 group by 1;

comment on view v_fixed_coc_cho_duyet_loai is
  'Phiếu cọc chờ duyệt chia theo thứ đang thu — cọc gần như luôn "phải tự tra" vì tiền cọc không thuộc tháng cước nào';
