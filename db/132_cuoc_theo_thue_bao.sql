-- "Không có hồ sơ cho thuê" ≠ "không có dịch vụ". Em đọc thiếu một tầng.
--
-- David bắt được SIM 08023784594: màn hình xếp vào "máy ở khách mà không có hồ
-- sơ cho thuê", trong khi CMS hiện rõ dịch vụ DV02919, đang sử dụng, khách zHa
-- リザ (KH01596), gói 5GB, giá 1.077.
--
-- Lý do: v_telecom_may dựng từ `rental_device` — bảng CHO THUÊ MÁY, có cọc, có
-- ngày thuê/trả. SIM không đi qua bảng đó (chỉ 68 SIM Datacall có), nên mọi SIM
-- đều rơi vào nhánh "không có hồ sơ". Nhưng thuê bao thì nằm ở
-- `subscription_device` + `subscription`, và kỳ cước nằm ở `fee_line`.
--
-- Sai 1.120 trong 1.528 mã. Thêm tầng đọc theo THUÊ BAO, dùng đúng luật phân
-- loại của v_telecom_may để hai đường ra cùng một thước.
--
-- Còn lại 408 mã mới thật sự là "ở khách mà không có dịch vụ nào" — chỉ có
-- phiếu xuất, không thuê bao, không cọc, không kỳ cước.

/** Kỳ cước quy về từng MÃ THIẾT BỊ, đi từ thuê bao nên phủ cả SIM. */
create or replace view v_tb_ma_ky as
select distinct
       ltrim(sd.imei, '0')               as ma_chuan,
       sd.subscription_source_id,
       to_char(make_date(f.nam, f.thang, 1), 'YYYY-MM') as ky,
       f.source_id                       as fee_line_id,
       f.amount                          as tien,
       i.status                          as trang_thai_hd
  from subscription_device_snapshot sd
  join fee_line_snapshot f
    on f.source = 'TELECOM'
   and f.subscription_source_id = sd.subscription_source_id
   -- Cùng luật khoảng gắn như v_telecom_may_ky: kỳ cước chỉ có năm tháng.
   and make_date(f.nam, f.thang, 1) >= coalesce(date_trunc('month', sd.started_on)::date, '1900-01-01')
   and make_date(f.nam, f.thang, 1) <= coalesce(date_trunc('month', sd.ended_on)::date, '2999-12-31')
  left join invoice_snapshot i on i.source = 'TELECOM' and i.source_id = f.invoice_source_id
 where sd.source = 'TELECOM' and sd.imei is not null;

comment on view v_tb_ma_ky is
  'Kỳ cước theo mã thiết bị, đi từ subscription_device nên phủ cả SIM lẫn máy wifi';

/** Tình trạng dịch vụ của từng mã thiết bị, suy từ thuê bao gắn gần nhất. */
create or replace view v_tb_ma as
with gan as (
  select distinct on (ltrim(sd.imei, '0'))
         ltrim(sd.imei, '0') as ma_chuan, sd.subscription_source_id
    from subscription_device_snapshot sd
   where sd.source = 'TELECOM' and sd.imei is not null
   order by 1, sd.started_on desc nulls last, sd.source_id desc
), cuoc as (
  select ma_chuan, max(ky) as ky_cuoi, count(*) as so_ky,
         round(sum(tien) filter (where trang_thai_hd = 'ISSUED')) as chua_thu
    from v_tb_ma_ky group by ma_chuan
)
select g.ma_chuan,
       g.subscription_source_id,
       s.status        as trang_thai_tb,
       s.plan_name     as goi,
       s.monthly_price as gia_thang,
       c.ky_cuoi,
       coalesce(c.chua_thu, 0) as chua_thu,
       coalesce(p.display_name, 'khách chưa có tên') as khach,
       ps.customer_code as ma_khach,
       ps.customer_type as loai_khach,
       case
         when s.status is null                              then 'TB_DA_XOA'
         when s.status <> 'ACTIVE'                          then 'HUY_CHUA_THU_MAY'
         when c.ky_cuoi >= to_char(CURRENT_DATE, 'YYYY-MM') then 'DANG_RA_CUOC'
         else 'HUT_CUOC'
       end as tinh_trang_cuoc
  from gan g
  left join cuoc c on c.ma_chuan = g.ma_chuan
  left join subscription_snapshot s
    on s.source = 'TELECOM' and s.source_id = g.subscription_source_id
  left join party_source ps
    on ps.source = 'TELECOM' and ps.source_customer_id = s.source_customer_id
   and ps.status <> 'REJECTED'
  left join party p on p.id = ps.party_id;

comment on view v_tb_ma is
  'Tình trạng dịch vụ theo mã thiết bị: dùng khi mã không có hồ sơ cho thuê, ví dụ SIM';
