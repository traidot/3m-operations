-- Danh sách xem xét huỷ: dịch vụ đang chạy mà đã quá hạn thu cước.
--
-- Mốc biết được quá hạn hay chưa, theo luật 3M:
--   wifi cầm tay   mùng 1 hàng tháng  (kỳ tháng M phải thu xong trước 01/M)
--   wifi cố định   mùng 10 hàng tháng (kỳ tháng M phải thu xong trước 10/(M+1))
-- Hai mốc này đã nằm sẵn trong v_telecom_invoice_due và v_fixed_ky_chot, nên ở
-- đây chỉ gom lại chứ không định nghĩa lại lần nữa.
--
-- Chỉ lấy dịch vụ CÒN CHẠY — huỷ cái đã huỷ thì không có việc gì để làm. Bên
-- cố định trừ tiền cọc chờ duyệt trước khi xét: khách đã nộp rồi thì không
-- được đem ra cân nhắc cắt dịch vụ.

create or replace view v_xem_xet_huy as
-- Wifi cố định
select 'FIXED'::source_system                      as nguon,
       c.subscription_id                           as id,
       c.contract_code                             as ma,
       c.dia_chi                                   as khach,
       'FIXED_INTERNET'                            as dich_vu,
       c.goi_cuoc                                  as goi,
       c.cuoc_thang                                as gia_thang,
       c.con_no_sau_coc                            as con_no,
       c.coc_cho_duyet,
       c.so_ky_no                                  as so_ky_no,
       k.ky_no_cu_nhat,
       (current_date - fixed_fee_due_date(k.ky_no_cu_nhat))::int as ngay_qua_han,
       c.kho_doi,
       contract_url(c.subscription_id)             as link_cms
  from v_fixed_contract c
  left join (
        select subscription_id, min(ky) as ky_no_cu_nhat
          from v_fixed_contract_period
         where trang_thai = 'NO' and qua_han and coc_cho_duyet = 0
         group by subscription_id
      ) k on k.subscription_id = c.subscription_id
 where c.trang_thai_hop_dong = 'ACTIVE'
   and c.con_no_sau_coc > 0

union all

-- Wifi cầm tay
select 'TELECOM'::source_system,
       s.subscription_id,
       s.subscription_id,
       s.khach,
       s.service_type,
       s.goi,
       s.gia_thang,
       s.con_no,
       0::numeric,
       h.so_hoa_don_qua_han,
       to_char(h.han_cu_nhat, 'YYYY-MM'),
       (current_date - h.han_cu_nhat)::int,
       false,
       telecom_url('thue_bao', s.subscription_id)
  from v_telecom_subscription s
  join (
        select subscription_source_id as sid,
               count(*)               as so_hoa_don_qua_han,
               min(han_tra)           as han_cu_nhat
          from v_telecom_invoice_due
         where status = 'ISSUED' and current_date > han_tra
           and subscription_source_id is not null
         group by subscription_source_id
      ) h on h.sid = s.subscription_id
 where s.trang_thai = 'ACTIVE'
   and s.con_no > 0;

comment on view v_xem_xet_huy is
  'Dịch vụ đang chạy đã quá hạn thu cước, cả hai mảng — danh sách để cân nhắc cắt';
