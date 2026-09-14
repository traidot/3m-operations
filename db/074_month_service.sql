-- Thống kê cước theo THÁNG × DỊCH VỤ cho mảng cầm tay.
--
-- Bảng bên CMS gom theo khách; anh David cần gom theo dịch vụ để biết mảng nào
-- đang gánh doanh thu và mảng nào đang chảy máu.
--
-- Kỳ lấy theo period_start (rơi về ngày lập nếu hoá đơn không có kỳ) — giống
-- v_telecom_month. Đối chiếu với CMS thì cột "không thanh toán" khớp từng tháng
-- (95.343, 88.743, 19.210…), nên hai bên cùng gom theo kỳ; riêng "tổng phải
-- thu" lệch vì CMS lọc loại hoá đơn theo cách chưa rõ. Ở đây tính hết, chỉ trừ
-- hoá đơn đã huỷ và hoàn tiền.
--
-- Hoá đơn không gắn thuê bao không có dịch vụ, nên xếp theo loại hoá đơn:
-- đơn hàng và thu khác thành hai "dịch vụ" riêng, không trộn vào gói nào.

create or replace view v_telecom_month_service as
select to_char(coalesce(i.period_start, i.issued_on), 'YYYY-MM')     as ky,
       coalesce(s.service_type,
                case i.invoice_type when 'ORDER' then 'DON_HANG'
                                    else 'THU_KHAC' end)             as dich_vu,
       count(*)                                                      as so_hoa_don,
       count(distinct i.subscription_source_id)                      as so_thue_bao,
       count(distinct i.party_id)                                    as so_khach,
       round(sum(i.total_amount))                                    as phai_thu,
       round(sum(i.paid_amount))                                     as da_thu,
       round(sum(i.total_amount - i.paid_amount)
             filter (where i.status = 'ISSUED'))                     as con_doi,
       round(sum(i.total_amount - i.paid_amount)
             filter (where i.status = 'UNPAYABLE'))                  as mat_trang,
       round(100.0 * sum(i.paid_amount)
             / nullif(sum(i.total_amount), 0), 1)                    as ty_le_thu
  from invoice_snapshot i
  left join subscription_snapshot s
         on s.source = 'TELECOM' and s.source_id = i.subscription_source_id
 where i.source = 'TELECOM'
   and i.status <> 'VOID'
   and coalesce(i.invoice_type, '') <> 'REFUND'
 group by 1, 2;

comment on view v_telecom_month_service is
  'Cước cầm tay theo tháng và theo dịch vụ; hoá đơn không gắn thuê bao xếp thành đơn hàng / thu khác';
