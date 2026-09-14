-- Hoá đơn không gắn thuê bao nào phải xem được ở ngăn kéo khách.
--
-- 116 hoá đơn quá hạn (241.917 yên) chỉ có mã khách, không có thuê bao. Tiền đã
-- được cộng vào "nợ quá hạn" của khách từ migration 063, nhưng màn hình thì
-- không có chỗ nào bày chúng: bảng trong ngăn kéo khách liệt kê theo thuê bao,
-- ngăn kéo thuê bao lại chỉ có hoá đơn của thuê bao đó. Khách hiện nợ 9 yên mà
-- không có cách nào biết 9 yên ấy nằm ở hoá đơn nào.

create or replace view v_telecom_invoice as
select i.subscription_source_id as subscription_id,
       i.source_id              as invoice_id,
       i.number                 as so_hoa_don,
       i.issued_on              as ngay_lap,
       d.han_tra,
       i.period_start           as ky_tu,
       i.period_end             as ky_den,
       i.total_amount           as tien,
       i.paid_amount            as da_tra,
       i.total_amount - i.paid_amount as con_lai,
       i.status                 as trang_thai,
       (select string_agg(distinct pm.channel, ', ')
          from payment_snapshot pm
         where pm.source = 'TELECOM' and pm.invoice_source_id = i.source_id) as kenh_thu,
       current_date > d.han_tra as qua_han,
       telecom_url('hoa_don', i.source_id) as link_cms,
       i.party_id
  from invoice_snapshot i
  join v_telecom_invoice_due d on d.source_id = i.source_id
 where i.source = 'TELECOM';
