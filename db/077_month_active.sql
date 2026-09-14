-- Thêm cột "thuê bao đang chạy" bên cạnh "thuê bao có cước".
--
-- Về nguyên tắc hai số này phải bằng nhau: thuê bao chạy tháng nào thì tháng đó
-- phải có cước. Chênh lệch chính là thứ cần nhìn — tháng 9/2026 chênh gần 500,
-- gần hết là thuê bao vẫn đánh dấu ACTIVE mà ngừng ra hoá đơn từ tháng 4.
--
-- "Đang chạy trong tháng M" suy từ ngày kích hoạt và ngày ngừng HIỆN TẠI, vì
-- nguồn không lưu lịch sử trạng thái. Với tháng đã qua thì đó là ước lượng:
-- thuê bao ngừng rồi bật lại sẽ bị tính là chạy suốt.
--
-- Phải nối FULL JOIN: dịch vụ có thuê bao chạy mà không có dòng cước nào sẽ
-- không xuất hiện nếu chỉ đi từ bảng cước — mà đó đúng là nhóm cần thấy nhất.

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
     and (s.terminated_on is null or s.terminated_on >= m.d1)
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
