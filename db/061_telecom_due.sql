-- Chốt lại "quá hạn" bên wifi cầm tay theo đúng cách 3M thu tiền.
--
-- QUY TRÌNH THẬT (anh David mô tả): mùng 5 và 15 hàng tháng xuất phiếu thu, thu
-- tiền cước của THÁNG SAU. Qua mùng 1 của tháng dùng mà chưa thu được thì là
-- quá hạn, và tới mức xem xét huỷ dịch vụ.
--
-- CÁI ĐANG SAI: view cũ lấy `due_on` của nguồn làm hạn. Nhưng 16.817/27.611 hoá
-- đơn có due_on đúng bằng issued_on — nguồn chỉ chép lại ngày lập chứ không ghi
-- hạn thật. Kết quả là hoá đơn vừa xuất hôm qua đã bị tính quá hạn.
--
-- HẠN ĐÚNG là ngày kỳ cước bắt đầu:
--   kỳ bắt đầu 01/10  → hạn 01/10, tức mùng 1 của tháng dùng. Đúng luật trên.
--   kỳ bắt đầu 14/09  → hạn 14/09. Đây là hoá đơn tính lẻ tháng đầu khi khách
--                       kích hoạt giữa tháng; bắt trả từ mùng 1 là vô lý.
-- Hoá đơn không có kỳ (3.053 cái, phần lớn là khoản thu lẻ) thì lấy mùng 1 của
-- tháng kế tiếp ngày lập — đúng nhịp "xuất tháng này, thu cho tháng sau".
--
-- "Sau mùng 1 mới là không kịp" nên đúng ngày hạn vẫn còn hạn: quá hạn là
-- current_date > han_tra.

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
                                                            as han_tra
  from invoice_snapshot i
 where i.source = 'TELECOM';

comment on view v_telecom_invoice_due is
  'Mỗi hoá đơn cầm tay kèm hạn trả thật; chỗ duy nhất định nghĩa hạn, mọi view khác đọc lại từ đây';
