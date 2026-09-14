-- Dựng lại "Thống kê cước dịch vụ theo tháng" đúng như CMS, nhưng gom theo DỊCH VỤ.
--
-- Đọc lại hàm rpt_subscription_fee_monthly_summary bên nguồn thì cách tính là:
--
--   Kỳ         lấy từ nam/thang của DÒNG CƯỚC, không phải ngày trên hoá đơn.
--   Phạm vi    dòng invoice_item của hoá đơn cước + dòng subscription_billing
--              của hoá đơn đơn hàng (bỏ dòng hoàn tiền), hoá đơn chưa huỷ, và
--              phải nối được về một thuê bao còn sống.
--   Đã thu     phân bổ theo tỉ lệ: (tiền dòng / tổng hoá đơn) × tiền đã trả.
--              Hoá đơn "không đòi được" thì coi như thu 0.
--   Chưa thu   chỉ tính trên hoá đơn đang đòi, và không cho âm.
--   Không TT   tiền của dòng thuộc hoá đơn "không đòi được".
--
-- Khác với bản cũ của mình ở hai chỗ quan trọng: kỳ lấy từ dòng cước (một hoá
-- đơn năm rải ra 12 tháng thay vì dồn vào tháng đầu), và tiền đã thu được chia
-- theo tỉ lệ thay vì gán trọn cho một tháng.
--
-- Phần thêm: cột dịch vụ, lấy từ thuê bao của dòng cước.

drop view if exists v_telecom_month_service;
create view v_telecom_month_service as
with dong as (
  select f.nam,
         f.thang,
         s.service_type                              as dich_vu,
         s.source_customer_id,
         i.party_id,
         f.subscription_source_id,
         i.status,
         f.amount,
         case
           when i.status = 'UNPAYABLE'            then 0::numeric
           when coalesce(i.total_amount, 0) <= 0  then 0::numeric
           else f.amount / i.total_amount * coalesce(i.paid_amount, 0)
         end                                        as da_thu
    from fee_line_snapshot f
    join invoice_snapshot i
      on i.source = 'TELECOM' and i.source_id = f.invoice_source_id
     and i.status <> 'VOID'
    join subscription_snapshot s
      on s.source = 'TELECOM' and s.source_id = f.subscription_source_id
   where f.source = 'TELECOM'
)
select to_char(make_date(nam, thang, 1), 'YYYY-MM')                as ky,
       dich_vu,
       count(*)                                                    as so_dong,
       count(distinct subscription_source_id)                      as so_thue_bao,
       count(distinct source_customer_id)                          as so_khach,
       round(sum(amount))                                          as phai_thu,
       round(sum(da_thu))                                          as da_thu,
       round(sum(case when status = 'ISSUED'
                      then greatest(amount - da_thu, 0) else 0 end)) as chua_thu,
       round(sum(case when status = 'UNPAYABLE' then amount else 0 end)) as khong_doi_duoc,
       count(distinct source_customer_id) filter (where amount > 0 and status = 'PAID')
                                                                   as khach_da_thu,
       count(distinct source_customer_id) filter (where amount > 0 and status = 'ISSUED')
                                                                   as khach_chua_thu,
       round(100.0 * sum(da_thu) / nullif(sum(amount), 0), 1)      as ty_le_thu
  from dong
 group by 1, 2;

comment on view v_telecom_month_service is
  'Thống kê cước cầm tay theo tháng × dịch vụ, cùng cách tính với báo cáo của CMS';
