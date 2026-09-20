-- Cắt đợt thu cước ở hết năm hiện tại. Cước cầm tay phát hành trước nên sổ có
-- sẵn kỳ tới tận 2027-09, nhưng mấy tháng đó chỉ lác đác 2–6 kỳ, kéo dài bảng
-- ra mà không nói lên điều gì — 9 tháng, 62 kỳ, 157.416 yên.
--
-- Lấy mốc là hết năm hiện tại chứ không ghi cứng 2026-12, để sang năm không
-- phải sửa lại.

create or replace view v_telecom_dot_thu as
select ky,
       count(*)                                                        as so_ky,
       count(distinct subscription_id)                                 as so_thue_bao,
       count(distinct ma_thiet_bi)                                     as so_may,
       round(sum(tien))                                                as phai_thu,
       round(coalesce(sum(tien) filter (where trang_thai_hd = 'PAID'), 0))      as da_thu,
       round(coalesce(sum(tien) filter (where trang_thai_hd = 'ISSUED'), 0))    as dang_doi,
       round(coalesce(sum(tien) filter (where trang_thai_hd = 'UNPAYABLE'), 0)) as bo_thu,
       round(coalesce(sum(tien) filter (where trang_thai_hd = 'VOID'), 0))      as huy_hd,
       round(100.0 * coalesce(sum(tien) filter (where trang_thai_hd = 'PAID'), 0)
             / nullif(sum(tien), 0), 1)                                as ty_le_thu,
       count(*) filter (where loai_khach = 'CUSTOMER')                 as ky_khach_le,
       count(*) filter (where loai_khach = 'COLLABORATOR')             as ky_ctv,
       count(*) filter (where loai_khach = 'AGENCY')                   as ky_dai_ly,
       count(*) filter (where loai_khach is null)                      as ky_khong_ro,
       round(coalesce(sum(tien) filter (where loai_khach = 'CUSTOMER'), 0))     as tien_khach_le,
       round(coalesce(sum(tien) filter (where loai_khach = 'COLLABORATOR'), 0)) as tien_ctv,
       round(coalesce(sum(tien) filter (where loai_khach = 'AGENCY'), 0))       as tien_dai_ly,
       ky > to_char(CURRENT_DATE, 'YYYY-MM')                           as ky_tuong_lai
  from v_telecom_ky_cuoc
 where ky <= to_char(CURRENT_DATE, 'YYYY') || '-12'
 group by ky;
