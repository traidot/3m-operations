-- Thêm khách, loại khách và tháng vào danh sách lượt thu chưa cấn trừ, để dựng
-- được màn hình chứ không phải tra bằng tay.
--
-- 1.247 lượt · 4.920.384 yên. Tiền đã vào két mà chưa gán vào hoá đơn nào còn
-- sống, nên không kỳ cước nào ghi nhận là đã thu.

-- Thêm cột vào giữa nên phải drop; 146 dựng bản đầu.
drop view if exists v_telecom_thu_chua_can_tru;

create view v_telecom_thu_chua_can_tru as
select p.source_id                        as payment_id,
       p.party_id,
       coalesce(pt.display_name, 'khách chưa có tên') as khach,
       ps.customer_code                   as ma_khach,
       ps.customer_type                   as loai_khach,
       p.amount,
       p.channel,
       p.reference,
       p.paid_at,
       to_char(p.paid_at, 'YYYY-MM')      as thang,
       (current_date - p.paid_at::date)   as so_ngay_treo,
       -- Kho chỉ giữ dòng cấn trừ CÒN HIỆU LỰC nên không phân biệt được "chưa
       -- cấn trừ bao giờ" với "cấn trừ rồi lại huỷ". Đếm thẳng bên nguồn thì
       -- 1.033 lượt chưa cấn trừ lần nào và 213 lượt đã huỷ hết cấn trừ.
       case
         when exists (select 1 from payment_reconcile_snapshot r
                       where r.source = 'TELECOM' and r.payment_source_id = p.source_id)
           then 'CAN_TRU_HOA_DON_XOA'
         else 'CHUA_CAN_TRU'
       end                                as ly_do,
       telecom_url('khach', ps.source_customer_id) as link_cms
  from payment_snapshot p
  left join party pt on pt.id = p.party_id
  left join party_source ps
    on ps.source = 'TELECOM' and ps.party_id = p.party_id and ps.status <> 'REJECTED'
 where p.source = 'TELECOM'
   and not exists (
     select 1 from payment_reconcile_snapshot r
       join invoice_snapshot i on i.source = 'TELECOM' and i.source_id = r.invoice_source_id
      where r.source = 'TELECOM' and r.payment_source_id = p.source_id);
