-- Đếm "dịch vụ đang chạy" theo ngày ngừng thật, không theo ngày dọn dữ liệu.
--
-- Bản 077 lấy terminated_on (có ngày huỷ thì lấy ngày huỷ) nên 661 thuê bao bị
-- huỷ hàng loạt trong tháng 9/2026 — đã hết hạn, đã thôi ra cước từ tháng 1–4 —
-- bị tính là đang chạy tới tận tháng 9. Tháng 9 chênh +500 hoá ra là số ảo; tính
-- lại (bỏ cả thuê bao chờ kích hoạt) thì tháng 9 đang chạy 1.562, có cước 1.417.

drop view if exists v_telecom_month_service;
create view v_telecom_month_service as
with ky as (
  select generate_series(
           date_trunc('month', (select min(make_date(nam, thang, 1)) from fee_line_snapshot
                                 where source = 'TELECOM')),
           date_trunc('month', (select max(make_date(nam, thang, 1)) from fee_line_snapshot
                                 where source = 'TELECOM')),
           '1 mon')::date as d1
),
moc as (
  select d1, (d1 + interval '1 month - 1 day')::date as d2,
         to_char(d1, 'YYYY-MM') as ky
    from ky
),
chay as (
  select m.ky, s.service_type as dich_vu, count(*) as thue_bao_chay
    from moc m
    join subscription_snapshot s
      on s.source = 'TELECOM'
     and s.activated_on <= m.d2
     -- Chờ kích hoạt thì chưa chạy, dù đã có sẵn ngày kích hoạt dự kiến.
     and s.status <> 'PENDING'
     -- Đã huỷ thì ngừng ở ngày đến trước giữa ngày huỷ và ngày hết hạn: hai đợt
     -- dọn 01/09 và 11/09/2026 ghi ngày huỷ là ngày dọn, trong khi dịch vụ đã
     -- hết hạn và thôi ra cước từ nhiều tháng trước. Còn chạy thì bỏ qua ngày
     -- hết hạn, vì gia hạn không cập nhật nó (248 thuê bao đang chạy có ngày hết
     -- hạn nằm trong quá khứ).
     and (case when s.status = 'TERMINATED'
               then least(s.cancel_on, s.expire_on)
               else s.cancel_on
          end is null
          or case when s.status = 'TERMINATED'
                  then least(s.cancel_on, s.expire_on)
                  else s.cancel_on
             end >= m.d1)
   group by 1, 2
),
dong as (
  select f.nam, f.thang, s.service_type as dich_vu, s.source_customer_id,
         f.subscription_source_id, i.status, f.amount,
         case
           when i.status = 'UNPAYABLE'           then 0::numeric
           when coalesce(i.total_amount, 0) <= 0 then 0::numeric
           else f.amount / i.total_amount * coalesce(i.paid_amount, 0)
         end as da_thu
    from fee_line_snapshot f
    join invoice_snapshot i
      on i.source = 'TELECOM' and i.source_id = f.invoice_source_id and i.status <> 'VOID'
    join subscription_snapshot s
      on s.source = 'TELECOM' and s.source_id = f.subscription_source_id
   where f.source = 'TELECOM'
),
cuoc as (
  select to_char(make_date(nam, thang, 1), 'YYYY-MM') as ky, dich_vu,
         count(*) as so_dong,
         count(distinct subscription_source_id) as thue_bao_co_cuoc,
         count(distinct source_customer_id) as so_khach,
         round(sum(amount)) as phai_thu,
         round(sum(da_thu)) as da_thu,
         round(sum(case when status = 'ISSUED'
                        then greatest(amount - da_thu, 0) else 0 end)) as chua_thu,
         round(sum(case when status = 'UNPAYABLE' then amount else 0 end)) as khong_doi_duoc,
         count(distinct source_customer_id) filter (where amount > 0 and status = 'PAID')
           as khach_da_thu,
         count(distinct source_customer_id) filter (where amount > 0 and status = 'ISSUED')
           as khach_chua_thu,
         round(100.0 * sum(da_thu) / nullif(sum(amount), 0), 1) as ty_le_thu
    from dong group by 1, 2
)
select coalesce(c.ky, h.ky)                         as ky,
       coalesce(c.dich_vu, h.dich_vu)               as dich_vu,
       coalesce(h.thue_bao_chay, 0)                 as thue_bao_chay,
       coalesce(c.thue_bao_co_cuoc, 0)              as thue_bao_co_cuoc,
       -- Tháng chưa tới thì không có gì để so: ai còn chạy tới lúc đó chưa biết,
       -- mà cước thì đã xuất trước. Để rỗng thay vì bịa ra một số âm.
       case when coalesce(c.ky, h.ky) <= to_char(current_date, 'YYYY-MM')
            then coalesce(h.thue_bao_chay, 0) - coalesce(c.thue_bao_co_cuoc, 0)
       end                                          as chenh,
       coalesce(c.so_dong, 0)                       as so_dong,
       coalesce(c.so_khach, 0)                      as so_khach,
       coalesce(c.phai_thu, 0)                      as phai_thu,
       coalesce(c.da_thu, 0)                        as da_thu,
       coalesce(c.chua_thu, 0)                      as chua_thu,
       coalesce(c.khong_doi_duoc, 0)                as khong_doi_duoc,
       coalesce(c.khach_da_thu, 0)                  as khach_da_thu,
       coalesce(c.khach_chua_thu, 0)                as khach_chua_thu,
       c.ty_le_thu
  from cuoc c
  full join chay h on h.ky = c.ky and h.dich_vu = c.dich_vu;

comment on view v_telecom_month_service is
  'Cước cầm tay theo tháng × dịch vụ, kèm số thuê bao đang chạy để so với số có cước';
