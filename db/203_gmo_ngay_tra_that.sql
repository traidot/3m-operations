-- Ngày khách trả mã combini: lấy từ phiếu cọc, không lấy updated_at.
--
-- v_fixed_gmo_lan đang suy ngày trả từ updated_at_src của dòng PAYSUCCESS —
-- đó là lúc bản ghi được cập nhật lần cuối, không phải lúc khách đứng ở quầy
-- combini. Hai mốc lệch nhau đủ để đẩy phiếu sang tháng khác: so với phiếu cọc
-- thì tháng 8 lệch 1, tháng 9 lệch 2, tháng 10 lệch 3; tổng vẫn đúng nên
-- không lộ ra ở con số chung, chỉ sai khi chia theo ngày hoặc theo tháng.
--
-- Ngày trả thật là gmoPaymentDate, CMS ghi xuống phiếu cọc mà mã này mở ra
-- (paid_at). Nối qua phieu_coc_id. Vẫn giữ updated_at làm phương án dự phòng
-- cho dòng chưa gắn phiếu — hiện không có dòng nào như vậy, nhưng mất mốc còn
-- hơn mất cả dòng.

create or replace view v_fixed_gmo_lan as
select coalesce(g.batch_id, g.source_id)                     as lan,
       max(g.contract_id)                                    as contract_id,
       max(g.amount)                                         as tien,
       bool_or(g.status = 'PAYSUCCESS')                       as da_tra,
       max(g.loai)                                           as loai,
       bool_or(g.phieu_coc_id is not null)                    as co_phieu_coc,
       min(g.created_at_src)                                 as tao_luc,
       max(g.han_tra)                                        as han_tra,
       max(coalesce(d.paid_at, g.updated_at_src))
         filter (where g.status = 'PAYSUCCESS')               as tra_luc,
       max(g.ky_cuoc)                                        as ky_cuoc
  from gmo_payment_snapshot g
  left join deposit_allocation_snapshot d
    on d.source = 'FIXED' and d.source_id = g.phieu_coc_id
 where g.source = 'FIXED'
 group by coalesce(g.batch_id, g.source_id);

comment on view v_fixed_gmo_lan is
  'Mỗi dòng một lần tạo mã combini (gộp bốn mã cùng batch) — đơn vị đúng để đếm tiền; ngày trả lấy từ phiếu cọc';
