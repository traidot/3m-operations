-- Hai danh sách việc: thu cước hàng tháng, và dự kiến huỷ.
--
-- v_thu_cuoc  — từng khoản còn phải thu, cả hai mảng, kèm hạn của nó. Đây là
--               danh sách đi thu: xếp theo hạn, cái đến hạn sớm nhất trước.
-- v_xem_xet_huy — dịch vụ còn chạy mà đã quá hạn, tức phần "quá hạn" của danh
--               sách trên gom về mức dịch vụ.
--
-- Hạn theo luật 3M, đã định nghĩa ở migration 053 và 061, đây chỉ đọc lại:
--   cầm tay   mùng 1 của tháng dùng
--   cố định   mùng 10 của tháng kế tiếp kỳ
--
-- Hoàn tiền (REFUND) không nằm trong danh sách thu — đó là khoản phải trả khách.

drop view if exists v_thu_cuoc;
create view v_thu_cuoc as
-- Wifi cố định: từng kỳ cước chưa có tiền, hợp đồng còn chạy.
select 'FIXED'::source_system                          as nguon,
       c.subscription_id                               as id,
       c.contract_code                                 as ma,
       c.dia_chi                                       as khach,
       'FIXED_INTERNET'                                as dich_vu,
       p.ky,
       p.phai_thu                                      as tien,
       p.coc_cho_duyet,
       fixed_fee_due_date(p.ky)                        as han_tra,
       p.qua_han,
       (current_date - fixed_fee_due_date(p.ky))::int  as ngay_le,
       null::text                                      as so_hoa_don,
       p.trang_thai                                    as tinh_trang,
       null::text                                      as loai_hoa_don,
       c.kho_doi,
       contract_url(c.subscription_id)                 as link_cms
  from v_fixed_contract_period p
  join v_fixed_contract c using (subscription_id)
 -- "Chờ duyệt" và "chỉ ghi chú" cũng là kỳ chưa có tiền: v_fixed_debt tính
   -- chúng vào công nợ vì chưa ai chốt là thu hay miễn. Bỏ hai loại này thì
   -- danh sách hụt 58 khoản, 115.100 yên so với con số nợ đang hiển thị.
 where p.trang_thai in ('NO', 'CHO_DUYET', 'GHI_CHU')
   and not p.ngoai_ky_tinh
   and c.trang_thai_hop_dong = 'ACTIVE'

union all

-- Wifi cầm tay: từng hoá đơn còn đang đòi.
select 'TELECOM'::source_system,
       coalesce(d.subscription_source_id, d.party_id::text),
       coalesce(d.subscription_source_id, i.number),
       coalesce(p.display_name, 'khách chưa có tên'),
       coalesce(s.service_type, d.invoice_type),
       to_char(coalesce(d.period_start, d.han_tra), 'YYYY-MM'),
       d.con_lai,
       0::numeric,
       d.han_tra,
       current_date > d.han_tra,
       (current_date - d.han_tra)::int,
       i.number,
       'DANG_DOI',
       d.invoice_type,
       false,
       telecom_url('hoa_don', d.source_id)
  from v_telecom_invoice_due d
  join invoice_snapshot i on i.source = 'TELECOM' and i.source_id = d.source_id
  left join party p on p.id = d.party_id
  left join subscription_snapshot s
         on s.source = 'TELECOM' and s.source_id = d.subscription_source_id
 where d.status = 'ISSUED'
   and not d.la_hoan_tien
   -- Thuê bao đã ngừng thì hoá đơn cũ vẫn phải đòi, nên không lọc theo trạng
   -- thái thuê bao như bên cố định; chỉ hoá đơn mới quyết định.
   and d.con_lai > 0;

comment on view v_thu_cuoc is
  'Từng khoản còn phải thu của cả hai mảng, kèm hạn — danh sách đi thu hàng tháng';
