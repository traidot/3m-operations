-- Báo cáo ngày riêng cho wifi cố định.
--
-- Tách khỏi bản chung vì hai mảng đo bằng thứ khác nhau: cố định có TÀI KHOẢN
-- THU (combini, yucho, cấn trừ cọc) và có khâu LẮP ĐẶT, cầm tay thì không.
-- Gộp chung thì mỗi bên chỉ còn được vài dòng chung chung.
--
-- Cùng khuôn ba mốc với db/181: hôm nay, hôm qua, trung bình 7 ngày TRƯỚC ĐÓ.

create or replace view v_bao_cao_ngay_fixed as
with ngay as (
  select current_date as hom_nay, current_date - 1 as hom_qua,
         current_date - 7 as bay_ngay_truoc
),
su_kien as (
  -- ── TIỀN VÀO, tách theo tài khoản thu ───────────────────────────────────
  select 'tien' as nhom,
         kenh_thu_chuan(i.channel) as chi_so, 'đợt' as don_vi,
         i.paid_at::date as ngay, i.amount as tien
    from fixed_fee_installment i
   where i.source = 'FIXED' and i.paid_at is not null and i.amount > 0

  -- ── HỢP ĐỒNG ────────────────────────────────────────────────────────────
  union all
  select 'hop_dong', 'Ký mới', 'hợp đồng', hd.ngay_ky, coalesce(hd.cuoc_thang, 0)
    from v_fixed_contract hd where hd.ngay_ky is not null
  union all
  select 'hop_dong', 'Lắp xong', 'hợp đồng', hd.ngay_lap_xong, coalesce(hd.cuoc_thang, 0)
    from v_fixed_contract hd where hd.ngay_lap_xong is not null
  union all
  select 'hop_dong', 'Huỷ', 'hợp đồng', hd.ngay_huy, coalesce(hd.cuoc_thang, 0)
    from v_fixed_contract hd where hd.ngay_huy is not null

  -- ── LẮP ĐẶT ─────────────────────────────────────────────────────────────
  union all
  select 'lap_dat', 'Đơn hẹn lịch lắp', 'đơn', io.scheduled_at::date, 0
    from install_order_snapshot io
   where io.source = 'FIXED' and io.scheduled_at is not null

  -- ── DUYỆT ───────────────────────────────────────────────────────────────
  -- Đợt thu vừa tạo: người thu đã ghi nhận, còn chờ duyệt hay không là việc
  -- của khâu sau, nhưng số tạo trong ngày cho biết hôm nay có ai nhập liệu.
  union all
  select 'duyet', 'Đợt thu mới nhập', 'đợt', i.created_at_src::date, i.amount
    from fixed_fee_installment i
   where i.source = 'FIXED' and i.created_at_src is not null
  union all
  select 'duyet', 'Phiếu cọc mới nhập', 'phiếu', d.created_at_src::date, d.amount
    from deposit_allocation_snapshot d
   where d.source = 'FIXED' and d.created_at_src is not null
),
gom as (
  select e.nhom, e.chi_so, e.don_vi,
         count(*) filter (where e.ngay = n.hom_nay)                 as so_hom_nay,
         sum(e.tien) filter (where e.ngay = n.hom_nay)              as tien_hom_nay,
         count(*) filter (where e.ngay = n.hom_qua)                 as so_hom_qua,
         sum(e.tien) filter (where e.ngay = n.hom_qua)              as tien_hom_qua,
         count(*) filter (where e.ngay between n.bay_ngay_truoc and n.hom_qua) as so_7,
         sum(e.tien) filter (where e.ngay between n.bay_ngay_truoc and n.hom_qua) as tien_7
    from su_kien e cross join ngay n
   group by 1, 2, 3
)
select nhom, chi_so, don_vi,
       so_hom_nay,
       coalesce(tien_hom_nay, 0)        as tien_hom_nay,
       so_hom_qua,
       coalesce(tien_hom_qua, 0)        as tien_hom_qua,
       round(so_7 / 7.0, 1)             as so_tb_7,
       round(coalesce(tien_7, 0) / 7.0) as tien_tb_7
  from gom;

comment on view v_bao_cao_ngay_fixed is
  'Báo cáo ngày wifi cố định: tiền theo tài khoản thu, hợp đồng, lắp đặt, nhập liệu';
