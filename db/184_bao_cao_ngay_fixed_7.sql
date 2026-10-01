-- Bảy ngày gần nhất cho báo cáo ngày wifi cố định.
--
-- Ba mốc (hôm nay / hôm qua / trung bình 7) nén cả tuần thành một con số, nên
-- không thấy được hôm nào thu, hôm nào nghỉ. Bảng bảy ngày bày thẳng từng
-- ngày ra, dùng chung cho tiền, lắp đặt và nhập liệu.
--
-- Tiền mang hai số mỗi ô: phần KHÔNG phải cấn trừ cọc (tiền thật chạy qua
-- ngân hàng) và tổng ghi nhận. Gộp một số thì ngày nào cấn trừ nhiều nhìn như
-- ngày thu tốt, trong khi ngân hàng không nhận thêm đồng nào.

create or replace view v_bao_cao_ngay_fixed_7 as
with ngay as (
  select generate_series(current_date - 6, current_date, interval '1 day')::date as ngay
),
su_kien as (
  select 'tien' as nhom, kenh_thu_chuan(i.channel) as chi_so, 'yên' as don_vi,
         i.paid_at::date as ngay, i.amount as tien,
         case when kenh_thu_chuan(i.channel) = 'cần trừ cọc' then 0 else i.amount end
           as tien_that
    from fixed_fee_installment i
   where i.source = 'FIXED' and i.paid_at is not null and i.amount > 0
  union all
  select 'lap_dat', 'Đơn hẹn lịch lắp', 'đơn', io.scheduled_at::date, 0, 0
    from install_order_snapshot io
   where io.source = 'FIXED' and io.scheduled_at is not null
  union all
  select 'nhap_lieu', 'Đợt thu mới nhập', 'đợt', i.created_at_src::date, i.amount, i.amount
    from fixed_fee_installment i
   where i.source = 'FIXED' and i.created_at_src is not null
  union all
  select 'nhap_lieu', 'Phiếu cọc mới nhập', 'phiếu', d.created_at_src::date, d.amount, d.amount
    from deposit_allocation_snapshot d
   where d.source = 'FIXED' and d.created_at_src is not null
),
khung as (
  -- Mỗi chỉ số phải có đủ bảy dòng, kể cả ngày không phát sinh gì: thiếu dòng
  -- thì bảng thủng lỗ chỗ, không so được theo cột. Lấy danh sách chỉ số theo
  -- 30 ngày chứ không phải 7: tài khoản cả tuần không về đồng nào vẫn phải
  -- hiện thành một dòng số 0 — đó mới là tin đáng xem.
  select distinct e.nhom, e.chi_so, e.don_vi, n.ngay
    from su_kien e cross join ngay n
   where e.ngay >= current_date - 29
)
select k.nhom, k.chi_so, k.don_vi, k.ngay,
       count(e.*)                            as so_luong,
       coalesce(sum(e.tien), 0)              as tien,
       coalesce(sum(e.tien_that), 0)         as tien_that
  from khung k
  left join su_kien e
    on e.nhom = k.nhom and e.chi_so = k.chi_so and e.ngay = k.ngay
 group by 1, 2, 3, 4;

comment on view v_bao_cao_ngay_fixed_7 is
  'Bảy ngày gần nhất: tiền theo tài khoản (tách phần không cấn trừ), lắp đặt, nhập liệu';
