-- Báo cáo ngày: mỗi chỉ số một dòng, kèm hôm qua và trung bình 7 ngày.
--
-- Xem số hôm nay một mình thì không biết nhiều hay ít. Mỗi dòng mang sẵn ba
-- cột để so ngay: hôm nay, hôm qua, và trung bình bảy ngày trước đó (KHÔNG
-- tính hôm nay — nếu tính thì ngày bất thường tự kéo đường trung bình theo, so
-- với chính nó hoá ra không thấy gì).
--
-- Cùng một khuôn cho cả hai mảng wifi, nên thêm chỉ số mới chỉ là thêm một
-- nhánh union, không phải sửa chỗ hiển thị.

create or replace view v_bao_cao_ngay as
with ngay as (
  select current_date as hom_nay, current_date - 1 as hom_qua,
         current_date - 7 as bay_ngay_truoc
),
-- Mỗi nhánh trả về: nhóm, tên chỉ số, đơn vị, ngày, số lượng, tiền.
su_kien as (
  -- ── TIỀN VÀO ────────────────────────────────────────────────────────────
  select 'tien' as nhom, 'Thu tiền wifi cầm tay' as chi_so, 'yên' as don_vi,
         p.paid_at::date as ngay, 1 as so_luong, p.amount as tien
    from payment_snapshot p
   where p.source = 'TELECOM' and p.paid_at is not null
  union all
  select 'tien', 'Thu tiền wifi cố định', 'yên',
         i.paid_at::date, 1, i.amount
    from fixed_fee_installment i
   where i.source = 'FIXED' and i.paid_at is not null and i.amount > 0

  -- ── CÔNG NỢ ─────────────────────────────────────────────────────────────
  union all
  select 'no', 'Hoá đơn cầm tay phát hành', 'yên',
         v.issued_on, 1, v.total_amount
    from invoice_snapshot v
   where v.source = 'TELECOM' and v.issued_on is not null and v.status <> 'VOID'

  -- ── KHÁCH MỚI ───────────────────────────────────────────────────────────
  union all
  select 'moi', 'Thuê bao cầm tay kích hoạt', 'thuê bao',
         s.activated_on, 1, coalesce(s.monthly_price, 0)
    from subscription_snapshot s
   where s.source = 'TELECOM' and s.activated_on is not null
  union all
  select 'moi', 'Hợp đồng cố định ký mới', 'hợp đồng',
         hd.ngay_ky, 1, coalesce(hd.cuoc_thang, 0)
    from v_fixed_contract hd where hd.ngay_ky is not null
  union all
  select 'moi', 'Hợp đồng cố định lắp xong', 'hợp đồng',
         hd.ngay_lap_xong, 1, coalesce(hd.cuoc_thang, 0)
    from v_fixed_contract hd where hd.ngay_lap_xong is not null

  -- ── MẤT KHÁCH ───────────────────────────────────────────────────────────
  union all
  select 'huy', 'Thuê bao cầm tay huỷ', 'thuê bao',
         s.terminated_on, 1, coalesce(s.monthly_price, 0)
    from subscription_snapshot s
   where s.source = 'TELECOM' and s.terminated_on is not null
  union all
  select 'huy', 'Hợp đồng cố định huỷ', 'hợp đồng',
         hd.ngay_huy, 1, coalesce(hd.cuoc_thang, 0)
    from v_fixed_contract hd where hd.ngay_huy is not null

  -- ── KHO ─────────────────────────────────────────────────────────────────
  union all
  select 'kho', 'Phiếu nhập kho', 'dòng phiếu', m.doc_date, 1, 0
    from stock_move_snapshot m
   where m.source = 'TELECOM' and m.doc_date is not null and m.doc_type = 'INVENTORY_IN'
  union all
  select 'kho', 'Phiếu xuất kho', 'dòng phiếu', m.doc_date, 1, 0
    from stock_move_snapshot m
   where m.source = 'TELECOM' and m.doc_date is not null and m.doc_type = 'INVENTORY_OUT'
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
       coalesce(tien_hom_nay, 0)              as tien_hom_nay,
       so_hom_qua,
       coalesce(tien_hom_qua, 0)              as tien_hom_qua,
       round(so_7 / 7.0, 1)                   as so_tb_7,
       round(coalesce(tien_7, 0) / 7.0)       as tien_tb_7
  from gom;

comment on view v_bao_cao_ngay is
  'Chỉ số hôm nay đặt cạnh hôm qua và trung bình 7 ngày trước đó';
