-- Chuỗi 30 ngày cho báo cáo ngày wifi cố định.
--
-- Bảng ba mốc (hôm nay / hôm qua / trung bình 7) trả lời "nhiều hay ít", còn
-- hình dạng tháng thì phải nhìn cả dải. Hai thứ khác nhau nên để riêng chứ
-- không nhồi vào một view.
--
-- generate_series để ngày không có việc gì vẫn ra một cột 0 — thiếu ngày thì
-- biểu đồ tự co lại, nhìn như tháng chỉ có hai mươi ngày.

create or replace view v_bao_cao_ngay_fixed_30 as
with ngay as (
  select generate_series(current_date - 29, current_date, interval '1 day')::date as ngay
),
hd as (select ngay_ky, ngay_lap_xong, fee_start_on, ngay_huy from v_fixed_contract)
select n.ngay,
       (select count(*) from hd where hd.ngay_ky = n.ngay)        as ky_moi,
       (select count(*) from hd where hd.ngay_lap_xong = n.ngay)  as lap_xong,
       -- "Hoạt động" = ngày bắt đầu thu cước: lắp xong rồi mà chưa tới ngày
       -- thu thì chưa sinh đồng nào, chưa tính là đang chạy.
       (select count(*) from hd where hd.fee_start_on = n.ngay)   as hoat_dong,
       (select count(*) from hd where hd.ngay_huy = n.ngay)       as huy
  from ngay n
 order by n.ngay;

comment on view v_bao_cao_ngay_fixed_30 is
  'Hợp đồng cố định theo từng ngày trong 30 ngày gần nhất: ký, lắp xong, bắt đầu thu, huỷ';
