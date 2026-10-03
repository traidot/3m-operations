-- Màn Hôm nay: 28 ngày liên tiếp, mỗi ngày một cột.
--
-- Lần trước em hiểu "4 tuần" thành gộp theo tuần (4 cột). Không phải: vẫn là
-- trục ngày, chỉ kéo dài từ 7 lên 28 ngày — bốn tuần liên tiếp, nhìn được cả
-- nhịp trong tuần lẫn xu hướng tháng.
--
-- Thứ Bảy và Chủ nhật đánh dấu ở lớp hiển thị (màn hình tự tính từ ngày), kho
-- không cần cột riêng.

create or replace view v_bao_cao_ngay_fixed_28 as
with ngay as (
  select generate_series(current_date - 27, current_date, interval '1 day')::date as ngay
),
su_kien as (
  select 'tien' as nhom, kenh_thu_chuan(i.channel) as chi_so, 'yên' as don_vi, 1 as thu_tu,
         i.paid_at::date as ngay, i.amount as tien,
         case when kenh_thu_chuan(i.channel) = 'cần trừ cọc' then 0 else i.amount end
           as tien_that,
         case when i.status = 'APPROVED' then i.amount else 0 end as tien_duyet
    from fixed_fee_installment i
   where i.source = 'FIXED' and i.paid_at is not null and i.amount > 0
  union all
  select 'lap_dat', 'Đơn hẹn lịch lắp', 'đơn', 1, io.scheduled_at::date, 0, 0, 0
    from install_order_snapshot io
   where io.source = 'FIXED' and io.scheduled_at is not null
  union all
  select 'lap_dat', 'Trong đó đã lắp xong', 'đơn', 2, io.scheduled_at::date, 0, 0, 0
    from install_order_snapshot io
   where io.source = 'FIXED' and io.scheduled_at is not null and io.status = 'DONE'
  union all
  select 'lap_dat', 'Còn chưa lắp', 'đơn', 3, io.scheduled_at::date, 0, 0, 0
    from install_order_snapshot io
   where io.source = 'FIXED' and io.scheduled_at is not null and io.status <> 'DONE'
  union all
  select 'lap_dat', 'Lắp xong trong ngày', 'đơn', 4, io.completed_on, 0, 0, 0
    from install_order_snapshot io
   where io.source = 'FIXED' and io.completed_on is not null
  union all
  select 'nhap_lieu',
         case
           when i.created_at_src::date = i.paid_at::date then 'Gõ đúng ngày tiền về'
           when i.created_at_src::date > i.paid_at::date then 'Gõ bù cho ngày trước'
           else 'Ghi trước khi tiền về'
         end,
         'đợt',
         case
           when i.created_at_src::date = i.paid_at::date then 1
           when i.created_at_src::date > i.paid_at::date then 2
           else 3
         end,
         i.created_at_src::date, i.amount, i.amount, i.amount
    from fixed_fee_installment i
   where i.source = 'FIXED' and i.created_at_src is not null and i.paid_at is not null
  union all
  select 'nhap_lieu', 'Phiếu cọc mới nhập', 'phiếu', 4, d.created_at_src::date,
         d.amount, d.amount, d.amount
    from deposit_allocation_snapshot d
   where d.source = 'FIXED' and d.created_at_src is not null
),
khung as (
  -- Danh sách chỉ số lấy theo 90 ngày: tài khoản cả tháng không về đồng nào
  -- vẫn phải hiện thành một dòng số 0.
  select distinct e.nhom, e.chi_so, e.don_vi, e.thu_tu, n.ngay
    from su_kien e cross join ngay n
   where e.ngay >= current_date - 89
)
select k.nhom, k.chi_so, k.don_vi, k.ngay,
       count(e.*)                            as so_luong,
       coalesce(sum(e.tien), 0)              as tien,
       coalesce(sum(e.tien_that), 0)         as tien_that,
       k.thu_tu,
       coalesce(sum(e.tien_duyet), 0)        as tien_duyet
  from khung k
  left join su_kien e
    on e.nhom = k.nhom and e.chi_so = k.chi_so and e.ngay = k.ngay
 group by 1, 2, 3, 4, k.thu_tu;

comment on view v_bao_cao_ngay_fixed_28 is
  '28 ngày gần nhất: tiền theo tài khoản, lắp đặt, độ trễ nhập liệu';

create or replace view v_bao_cao_tong_hop_28 as
with ngay as (
  select generate_series(current_date - 27, current_date, interval '1 day')::date as ngay
),
hd as (
  select io.signed_on                        as ngay,
         coalesce(s.is_renewal, false)       as dang_ky_lai,
         s.status = 'TERMINATED'             as huy,
         s.cancel_timing                     as moc_huy,
         io.status                           as lap,
         io.scheduled_at is not null         as co_lich
    from install_order_snapshot io
    join subscription_snapshot s
      on s.source = io.source and s.source_id = io.source_id
   where io.source = 'FIXED' and io.signed_on >= current_date - 27
),
cho as (
  select h.*,
         not h.huy and h.lap = 'DONE'                                as xong,
         not h.huy and h.lap = 'FAILED'                              as that_bai,
         not h.huy and h.lap not in ('DONE', 'FAILED') and h.co_lich as cho_lap,
         not h.huy and h.lap not in ('DONE', 'FAILED') and not h.co_lich as chua_hen
    from hd h
)
select n.ngay,
       count(c.*) filter (where not c.dang_ky_lai)                   as lan_dau,
       count(c.*) filter (where c.dang_ky_lai)                       as dang_ky_lai,
       count(c.*)                                                    as tong_dang_ky,
       count(c.*) filter (where c.huy and c.moc_huy is distinct from 'AFTER_SCHEDULE')
                                                                     as huy_truoc_lich,
       count(c.*) filter (where c.huy and c.moc_huy = 'AFTER_SCHEDULE' and c.lap <> 'DONE')
                                                                     as huy_sau_lich,
       count(c.*) filter (where c.huy and c.moc_huy = 'AFTER_SCHEDULE' and c.lap = 'DONE')
                                                                     as huy_sau_lap,
       count(c.*) filter (where c.huy)                               as tong_huy,
       count(c.*) filter (where not c.huy)                           as con_lai,
       count(c.*) filter (where c.that_bai or c.cho_lap)             as co_lich_lap,
       count(c.*) filter (where c.chua_hen)                          as chua_co_lich,
       count(c.*) filter (where c.xong)                              as lap_xong,
       count(c.*) filter (where c.cho_lap)                           as co_lich_chua_lap,
       count(c.*) filter (where c.that_bai)                          as that_bai
  from ngay n
  left join cho c on c.ngay = n.ngay
 group by n.ngay;

comment on view v_bao_cao_tong_hop_28 is
  'Báo cáo tổng hợp của CMS vỡ theo ngày, 28 ngày gần nhất';

drop view if exists v_bao_cao_tuan_fixed;
drop view if exists v_bao_cao_tong_hop_tuan;
