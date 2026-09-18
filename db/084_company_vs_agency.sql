-- Hợp đồng wifi cố định: của công ty hay của đại lý.
--
-- 3M chỉ thu cước những hợp đồng do công ty phụ trách. Hợp đồng do đại lý mở
-- thì đại lý tự thu, nên bên nguồn không đặt giá cước và ngày bắt đầu thu —
-- đó là chuyện bình thường, không phải thiếu dữ liệu.
--
-- Bằng chứng trong dữ liệu (hợp đồng đã lắp, chưa huỷ):
--   hà đông 542/610 có giá · ty 135/137 · Tố Hữu 35/56 · Hoa-MC 7/14 · Sakura 2/4
--   mọi tài khoản đại lý khác: 0 hợp đồng nào có giá, trên hơn 2.000 hợp đồng
--
-- Nên "thiếu giá" chỉ đáng báo trong nhóm công ty: khoảng 100 hợp đồng, không
-- phải 2.144 như đang hiện.
--
-- Danh sách người của công ty để ở bảng cho sửa được, vì nguồn không có cờ nào
-- phân biệt — chỉ có tên người tạo hợp đồng, nhập tay.

create table if not exists fixed_company_staff (
  ten     text primary key,
  ghi_chu text
);

insert into fixed_company_staff (ten, ghi_chu) values
  ('hà đông', 'công ty phụ trách'),
  ('ty',      'công ty phụ trách'),
  ('tố hữu',  'công ty phụ trách'),
  ('hoa- mc', 'công ty phụ trách'),
  ('sakura',  'công ty phụ trách')
on conflict (ten) do nothing;

comment on table fixed_company_staff is
  'Tên người tạo hợp đồng thuộc công ty; còn lại coi là đại lý tự thu. So khớp theo lower(trim()).';

-- Cảnh báo cho người đọc sau: màn hình CMS gắn nhãn cột người tạo là "Tên Đại
-- lý" và hiển thị đúng mấy tên trong bảng này. Nhãn đó SAI — chủ hệ thống đã
-- xác nhận đây là nhân viên công ty. Đừng đảo luật theo nhãn của CMS.

/** Hợp đồng do công ty phụ trách hay do đại lý. */
create or replace view v_fixed_contract_owner as
select c.subscription_id,
       c.nguoi_nhap,
       exists (select 1 from fixed_company_staff s
                where s.ten = lower(btrim(coalesce(c.nguoi_nhap, '')))) as do_cong_ty
  from v_fixed_contract c;

-- Độ phủ chỉ tính trên phần công ty thu; phần đại lý đếm riêng cho khỏi lẫn.
create or replace view v_fixed_billing_coverage as
select count(*) filter (where o.do_cong_ty)                               as hop_dong_dang_chay,
       count(*) filter (where o.do_cong_ty
                          and (c.cuoc_thang is null or c.cuoc_thang = 0)) as thieu_gia_cuoc,
       count(*) filter (where o.do_cong_ty and c.fee_start_on is null)    as thieu_ngay_bat_dau,
       count(*) filter (where o.do_cong_ty
                          and c.cuoc_thang > 0 and c.fee_start_on is not null) as tinh_duoc,
       round(100.0 * count(*) filter (where o.do_cong_ty
                                        and c.cuoc_thang > 0
                                        and c.fee_start_on is not null)
             / nullif(count(*) filter (where o.do_cong_ty), 0), 1)        as ty_le_tinh_duoc,
       count(*) filter (where not o.do_cong_ty)                           as hop_dong_dai_ly
  from v_fixed_contract c
  join v_fixed_contract_owner o using (subscription_id)
 where c.trang_thai_hop_dong = 'ACTIVE';
