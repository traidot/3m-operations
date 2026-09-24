-- Tách tiền chờ duyệt thành hai phần rời nhau, để bảng cộng được.
--
-- Đặt cạnh nhau ba cột "giống CMS", "bỏ điều kiện duyệt" và "chưa approve" thì
-- ai cũng thử cộng hai cột sau ra cột giữa, và không khớp: một phần tiền chờ
-- duyệt (đợt đã duyệt nhưng phiếu cha chưa) vẫn được CMS tính, nên nằm SẴN
-- trong cột giống CMS — cộng vào là đếm hai lần.
--
-- Hai cột mới rời nhau hẳn:
--   cms_loai_ra           = tien_pm − tien_cms, phần CMS gạt đi
--   cho_duyet_trong_cms   phần chờ duyệt mà CMS vẫn tính
-- Khi đó  tien_cms + cms_loai_ra = tien_pm
--   và    cms_loai_ra + cho_duyet_trong_cms  ≠  tien_cho_duyet chỉ khi CMS gạt
--         vì lý do khác duyệt (đợt chưa ghi tài khoản), nên giữ cả ba cột.

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
         coalesce(sum(so_tien) filter (where cho_duyet), 0)       as tien_cho_duyet,
         coalesce(sum(so_tien) filter (where cho_duyet and vao_bao_cao_tai_khoan), 0)
                                                                  as cho_duyet_trong_cms
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
       coalesce(sk.tien_khach, 0) - coalesce(pm.tien_cms, 0) as chenh_cms,
       coalesce(pm.tien, 0) - coalesce(pm.tien_cms, 0)       as cms_loai_ra,
       coalesce(pm.cho_duyet_trong_cms, 0)  as cho_duyet_trong_cms
  from sk
  full join pm on pm.thang = sk.thang and pm.tai_khoan = sk.tai_khoan;
