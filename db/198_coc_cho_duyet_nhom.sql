-- Phiếu cọc chờ duyệt, gom thành vài dòng để đọc thẳng trên màn hình.
--
-- Màn /fee-payments/deposit-allocations bên CMS mặc định lọc "Chờ duyệt" và
-- đổ ra danh sách dài; nhìn vào chỉ biết là nhiều, không biết nhiều tới đâu
-- hay cái nào đáng lo trước.
--
-- Gom theo TUỔI CHỜ vì đó là thứ quyết định việc phải làm: trung bình duyệt
-- xong trong 2,1 ngày, nên phiếu nằm quá hai tuần không còn là đang xử lý.
-- Cột "phải tự tra" tách tiếp phần nặng: lúc tạo mã không chọn sẵn tháng cước
-- thì người duyệt phải mở từng hợp đồng ra dò.

create or replace view v_fixed_coc_cho_duyet_nhom as
with g as (
  select case
           when cho_ngay <= 3  then 1
           when cho_ngay <= 7  then 2
           when cho_ngay <= 14 then 3
           when cho_ngay <= 30 then 4
           else 5
         end                                 as bac,
         cho_ngay, tien, co_san_thang
    from v_fixed_coc_cho_phan_bo
)
select bac,
       case bac
         when 1 then 'mới, 0-3 ngày'
         when 2 then '4-7 ngày'
         when 3 then '8-14 ngày'
         when 4 then '15-30 ngày'
         else 'trên 30 ngày'
       end                                   as nhom,
       count(*)                              as so_phieu,
       sum(tien)                             as tien,
       count(*) filter (where not co_san_thang) as phai_tu_tra,
       max(cho_ngay)                         as lau_nhat
  from g
 group by bac;

comment on view v_fixed_coc_cho_duyet_nhom is
  'Phiếu cọc chờ duyệt gom theo tuổi chờ — bản tóm tắt của màn deposit-allocations bên CMS';
