-- Cột thứ hai của phần mềm đổi từ "mọi đợt" sang đúng cách tính "Đã thu" của
-- Báo cáo thống kê cước phí (report/fee-payment).
--
-- Bộ lọc của báo cáo đó, đọc từ contract-fee-payment.service.ts:
--   phiếu cha status = APPROVED · không isFree
--   hợp đồng installationStatus = INSTALLATION_COMPLETED · monthlyFee > 0
-- Trong kho đúng là cờ `vao_bao_cao_cuoc`.
--
-- LƯU Ý TRỤC THỜI GIAN: bảng này gom theo THÁNG TIỀN VỀ để đặt cạnh sao kê
-- ngân hàng, còn màn hình fee-payment gom theo KỲ CƯỚC. Cùng một bộ lọc nhưng
-- khác trục, nên số của một tháng lẻ sẽ không trùng màn hình; chỉ tổng cả
-- quãng mới trùng.

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
                                                                  as cho_duyet_trong_cms,
         count(*) filter (where vao_bao_cao_cuoc)                 as so_dot_cuoc,
         coalesce(sum(so_tien) filter (where vao_bao_cao_cuoc), 0) as tien_cuoc
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
       coalesce(pm.cho_duyet_trong_cms, 0)  as cho_duyet_trong_cms,
       coalesce(pm.so_dot_cuoc, 0)          as so_dot_cuoc,
       coalesce(pm.tien_cuoc, 0)            as tien_cuoc
  from sk
  full join pm on pm.thang = sk.thang and pm.tai_khoan = sk.tai_khoan;
