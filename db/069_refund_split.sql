-- Hoàn tiền không phải công nợ.
--
-- REFUND là khoản 3M nợ khách (đổi thiết bị, trả lại phần chênh), mang số âm và
-- trạng thái UNPAID. Cộng nó vào "nợ quá hạn" là vừa sai dấu vừa sai chiều:
-- 11 khách hiện nợ âm, và 28.500 yên đang trừ ngược vào tổng nợ.
--
-- Tách hẳn thành phai_hoan — một cột riêng, số dương cho dễ đọc.

-- Cột mới phải nối vào cuối, không chèn giữa — replace không đổi tên cột được,
-- mà drop thì kéo theo cả chuỗi view phía sau.
create or replace view v_telecom_invoice_due as
select i.source_id,
       i.subscription_source_id,
       i.source_customer_id,
       i.party_id,
       i.status,
       i.total_amount - i.paid_amount                       as con_lai,
       i.paid_amount,
       i.period_start,
       i.period_end,
       coalesce(i.period_start,
                (date_trunc('month', i.issued_on) + interval '1 month')::date)
                                                            as han_tra,
       i.invoice_type,
       i.invoice_type = 'REFUND'                            as la_hoan_tien
  from invoice_snapshot i
 where i.source = 'TELECOM';

create or replace view v_telecom_party_debt as
select party_id,
       round(sum(con_lai) filter (where status = 'ISSUED' and not la_hoan_tien
                                    and current_date > han_tra))  as con_no,
       round(sum(con_lai) filter (where status = 'ISSUED' and not la_hoan_tien
                                    and current_date <= han_tra)) as chua_toi_han,
       round(sum(con_lai) filter (where status = 'UNPAYABLE'))    as tien_mat,
       round(sum(paid_amount) filter (where status <> 'VOID'))    as da_thu,
       max(current_date - han_tra) filter (where status = 'ISSUED' and not la_hoan_tien)
                                                                  as ngay_qua_han,
       max(period_end) filter (where status <> 'VOID')            as ky_gan_nhat_den,
       -- Đảo dấu: bên nguồn ghi âm, ở đây là "3M phải trả khách bao nhiêu".
       round(-sum(con_lai) filter (where status = 'ISSUED' and la_hoan_tien))
                                                                  as phai_hoan
  from v_telecom_invoice_due
 where party_id is not null
 group by party_id;
