-- Tách số của phần mềm thành hai cột: đúng như CMS lọc, và bỏ điều kiện duyệt.
--
-- Cột `tien_pm` cũ lấy MỌI đợt, nên đặt cạnh màn hình CMS là lệch mà không
-- hiểu vì sao: Báo cáo tài khoản thu bỏ đợt chưa ghi tài khoản và đợt mà cả
-- đợt lẫn phiếu cha đều chưa duyệt. Giữ nguyên `tien_pm` để không phá chỗ đang
-- dùng, thêm cột mới ở cuối (create or replace chỉ cho thêm cột ở cuối).
--
--   tien_cms       đúng bộ lọc của report/collection-account
--   tien_chua_duyet phần bị bộ lọc đó gạt ra vì chưa duyệt
--   chenh_cms      tiền khách trên sao kê trừ đi số giống CMS

create or replace view v_sao_ke_thang as
with sk as (
  select r.thang, r.tai_khoan,
         count(*)                                        as so_gd,
         sum(r.tien_vao)                                 as tien_tho,
         sum(r.tien_vao) filter (where r.noi_bo)         as noi_bo,
         sum(r.tien_vao) filter (where not r.noi_bo)     as tien_khach,
         count(*) filter (where r.ma_hd is not null)     as gd_co_ma
    from bank_row r
    join bank_import i on i.id = r.import_id and i.dang_dung
   where r.thang is not null
   group by 1, 2
), pm as (
  select thang_tien_ve as thang, tai_khoan,
         count(*) as so_dot, sum(so_tien) as tien,
         count(*) filter (where vao_bao_cao_tai_khoan)            as so_dot_cms,
         coalesce(sum(so_tien) filter (where vao_bao_cao_tai_khoan), 0) as tien_cms,
         coalesce(sum(so_tien) filter (where cho_duyet), 0)       as tien_cho_duyet
    from v_fixed_dot_thu
   group by 1, 2
)
select coalesce(sk.thang, pm.thang)         as thang,
       coalesce(sk.tai_khoan, pm.tai_khoan) as tai_khoan,
       coalesce(sk.so_gd, 0)                as so_gd,
       coalesce(sk.tien_tho, 0)             as tien_tho,
       coalesce(sk.noi_bo, 0)               as noi_bo,
       coalesce(sk.tien_khach, 0)           as tien_khach,
       coalesce(sk.gd_co_ma, 0)             as gd_co_ma,
       coalesce(pm.so_dot, 0)               as so_dot_pm,
       coalesce(pm.tien, 0)                 as tien_pm,
       coalesce(sk.tien_khach, 0) - coalesce(pm.tien, 0) as chenh,
       sk.thang is null                     as chi_phan_mem,
       pm.thang is null                     as chi_sao_ke,
       coalesce(pm.so_dot_cms, 0)           as so_dot_cms,
       coalesce(pm.tien_cms, 0)             as tien_cms,
       coalesce(pm.tien_cho_duyet, 0)       as tien_cho_duyet,
       coalesce(sk.tien_khach, 0) - coalesce(pm.tien_cms, 0) as chenh_cms
  from sk
  full join pm on pm.thang = sk.thang and pm.tai_khoan = sk.tai_khoan;
