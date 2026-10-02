-- Bốn thiếu sót của màn hình "Hôm nay · wifi cố định".
--
-- 1. LẮP XONG đang đếm hai kiểu trong cùng một trang. Biểu đồ 30 ngày đếm
--    theo ngày lắp xong thật (completed_on), còn bảng bảy ngày đếm theo NGÀY
--    HẸN — đơn hẹn hôm qua mà lắp hôm nay không vào đâu cả. Sáng nay bảng ghi
--    "đã lắp xong —" trong khi thực tế có 3 đơn xong rồi. Thêm một dòng đếm
--    theo completed_on, giữ nguyên cụm theo ngày hẹn vì hai câu hỏi khác
--    nhau: "lịch hôm nay chạy tới đâu" và "hôm nay làm xong bao nhiêu".
--
-- 2. CÔNG NỢ không xuất hiện ở đâu. Màn hình trả lời "hôm nay thu bao nhiêu"
--    mà không trả lời "còn phải thu bao nhiêu".
--
-- 3-4. Hai danh sách để bấm vào: đơn quá hạn chưa lắp, và hợp đồng huỷ của
--    một ngày.

create or replace view v_bao_cao_ngay_fixed_7 as
with ngay as (
  select generate_series(current_date - 6, current_date, interval '1 day')::date as ngay
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
  -- Ba dòng đầu theo NGÀY HẸN, nên ngày mai cũng có số: đó là việc phải làm
  -- chứ không phải việc đã làm.
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
  -- Dòng này theo NGÀY LÀM XONG, không phải ngày hẹn — cùng cách đếm với cột
  -- "Lắp xong" của biểu đồ 30 ngày phía trên.
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
       k.thu_tu,
       coalesce(sum(e.tien_duyet), 0)        as tien_duyet
  from khung k
  left join su_kien e
    on e.nhom = k.nhom and e.chi_so = k.chi_so and e.ngay = k.ngay
 group by 1, 2, 3, 4, k.thu_tu;

comment on view v_bao_cao_ngay_fixed_7 is
  'Bảy ngày gần nhất: tiền theo tài khoản (tách cấn trừ cọc và phần đã duyệt), lắp đặt theo ngày hẹn và theo ngày làm xong, độ trễ nhập liệu';

-- Công nợ cước, gộp thành một dòng cho đầu màn hình.
create or replace view v_fixed_cong_no as
select count(*) filter (where con_no > 0)            as hop_dong,
       coalesce(sum(con_no), 0)                      as tien,
       coalesce(sum(so_ky_no), 0)                    as ky
  from v_fixed_debt;

comment on view v_fixed_cong_no is
  'Tổng công nợ cước wifi cố định — một dòng, dùng cho thẻ đầu màn hình Hôm nay';

-- Danh sách đơn đã qua ngày hẹn mà chưa lắp xong. Đống này càng để lâu càng
-- dày nên phải mở ra xem được, không chỉ đếm.
create or replace view v_fixed_lap_qua_han_ds as
select io.source_id,
       io.source_customer_id                         as ma_hd,
       io.address                                    as dia_chi,
       io.scheduled_at::date                         as ngay_hen,
       (current_date - io.scheduled_at::date)        as tre_ngay,
       io.status,
       coalesce(nv.display_name, io.technician_ref)  as nguoi_phu_trach,
       c.trang_thai_hop_dong,
       contract_url(io.source_id)                    as url
  from install_order_snapshot io
  left join staff_snapshot nv
    on nv.source = 'FIXED' and nv.source_id = io.technician_ref
  left join v_fixed_contract c on c.subscription_id = io.source_id
 where io.source = 'FIXED' and io.status <> 'DONE'
   and io.scheduled_at is not null and io.scheduled_at::date < current_date;

comment on view v_fixed_lap_qua_han_ds is
  'Đơn lắp đã qua ngày hẹn mà chưa xong, kèm số ngày trễ';

-- Hợp đồng huỷ trong một ngày, để bấm từ cột huỷ của biểu đồ.
create or replace view v_fixed_huy_ngay as
select c.ngay_huy                       as ngay,
       c.subscription_id,
       c.contract_code                  as ma_hd,
       c.dia_chi,
       c.ngay_ky,
       c.ngay_lap_xong,
       c.ly_do_huy,
       c.nhom_ly_do_huy,
       c.con_no,
       contract_url(c.subscription_id)  as url
  from v_fixed_contract c
 where c.ngay_huy is not null;

comment on view v_fixed_huy_ngay is
  'Hợp đồng wifi cố định huỷ theo ngày — chi tiết đằng sau cột huỷ của biểu đồ';
