-- Làm rõ hai nhóm cuối của báo cáo ngày wifi cố định.
--
-- LẮP ĐẶT trước đây chỉ có một dòng "số đơn hẹn", không nói được hẹn rồi có
-- lắp hay không — mà đó mới là chỗ hỏng: hiện có hàng trăm đơn đã qua ngày hẹn
-- vẫn chưa lắp xong. Tách thành hẹn / đã lắp xong / còn chưa lắp.
--
-- NHẬP LIỆU trước đây chỉ đếm "bao nhiêu bản ghi được tạo", một con số không
-- nói lên điều gì. Cái đáng xem là ĐỘ TRỄ: đợt thu được gõ vào máy đúng ngày
-- tiền về, hay vài hôm sau mới gõ. Trễ bao nhiêu thì cột tiền của những ngày
-- gần đây còn thiếu bấy nhiêu và sẽ phình lên sau. Tách theo khoảng cách giữa
-- ngày tiền về (paid_at) và ngày gõ máy (created_at_src), đếm theo ngày gõ.

create or replace view v_bao_cao_ngay_fixed_7 as
with ngay as (
  select generate_series(current_date - 6, current_date, interval '1 day')::date as ngay
),
su_kien as (
  select 'tien' as nhom, kenh_thu_chuan(i.channel) as chi_so, 'yên' as don_vi, 1 as thu_tu,
         i.paid_at::date as ngay, i.amount as tien,
         case when kenh_thu_chuan(i.channel) = 'cần trừ cọc' then 0 else i.amount end
           as tien_that
    from fixed_fee_installment i
   where i.source = 'FIXED' and i.paid_at is not null and i.amount > 0
  union all
  -- Lắp đặt tính theo NGÀY HẸN, nên ngày mai cũng có số: đó là việc phải làm
  -- chứ không phải việc đã làm.
  select 'lap_dat', 'Đơn hẹn lịch lắp', 'đơn', 1, io.scheduled_at::date, 0, 0
    from install_order_snapshot io
   where io.source = 'FIXED' and io.scheduled_at is not null
  union all
  select 'lap_dat', 'Trong đó đã lắp xong', 'đơn', 2, io.scheduled_at::date, 0, 0
    from install_order_snapshot io
   where io.source = 'FIXED' and io.scheduled_at is not null and io.status = 'DONE'
  union all
  select 'lap_dat', 'Còn chưa lắp', 'đơn', 3, io.scheduled_at::date, 0, 0
    from install_order_snapshot io
   where io.source = 'FIXED' and io.scheduled_at is not null and io.status <> 'DONE'
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
         i.created_at_src::date, i.amount, i.amount
    from fixed_fee_installment i
   where i.source = 'FIXED' and i.created_at_src is not null and i.paid_at is not null
  union all
  select 'nhap_lieu', 'Phiếu cọc mới nhập', 'phiếu', 4, d.created_at_src::date, d.amount, d.amount
    from deposit_allocation_snapshot d
   where d.source = 'FIXED' and d.created_at_src is not null
),
khung as (
  -- Mỗi chỉ số phải có đủ bảy dòng, kể cả ngày không phát sinh gì: thiếu dòng
  -- thì bảng thủng lỗ chỗ, không so được theo cột. Lấy danh sách chỉ số theo
  -- 30 ngày chứ không phải 7: tài khoản cả tuần không về đồng nào vẫn phải
  -- hiện thành một dòng số 0 — đó mới là tin đáng xem.
  select distinct e.nhom, e.chi_so, e.don_vi, e.thu_tu, n.ngay
    from su_kien e cross join ngay n
   where e.ngay >= current_date - 29
)
select k.nhom, k.chi_so, k.don_vi, k.ngay,
       count(e.*)                            as so_luong,
       coalesce(sum(e.tien), 0)              as tien,
       coalesce(sum(e.tien_that), 0)         as tien_that,
       -- Thứ tự đọc, không phải thứ tự chữ cái: "Đơn hẹn" phải đứng trên
       -- "Trong đó đã lắp xong", xếp theo abc thì câu "trong đó" mất nghĩa.
       k.thu_tu
  from khung k
  left join su_kien e
    on e.nhom = k.nhom and e.chi_so = k.chi_so and e.ngay = k.ngay
 group by 1, 2, 3, 4, k.thu_tu;

comment on view v_bao_cao_ngay_fixed_7 is
  'Bảy ngày gần nhất: tiền theo tài khoản (tách phần không cấn trừ), lắp đặt theo ngày hẹn, độ trễ nhập liệu';

-- Đơn đã qua ngày hẹn mà vẫn chưa lắp xong. Không chia theo ngày được: nó là
-- một đống tồn đọng, càng để lâu càng dày, nên đếm thành một con số kèm mốc
-- hẹn cũ nhất để biết đống này cũ tới đâu.
create or replace view v_lap_dat_qua_han as
select count(*)                                         as don,
       min(scheduled_at::date)                          as hen_cu_nhat,
       count(*) filter (where scheduled_at::date >= current_date - 29) as trong_30_ngay
  from install_order_snapshot
 where source = 'FIXED' and status <> 'DONE'
   and scheduled_at is not null and scheduled_at::date < current_date;

comment on view v_lap_dat_qua_han is
  'Đơn lắp đã qua ngày hẹn mà chưa lắp xong — tồn đọng, không chia theo ngày';
