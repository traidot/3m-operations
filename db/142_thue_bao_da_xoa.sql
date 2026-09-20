-- Kỳ cước mồ côi: thuê bao đã bị xoá mềm ở nguồn nhưng kỳ cước vẫn còn.
--
-- David bấm nút CMS ở thuê bao 3872 thì bên đó báo không tìm thấy. Lý do: sync
-- lọc `deletedAt is null` cho bảng subscription nhưng KHÔNG lọc cho fee_line và
-- invoice, nên kỳ cước của thuê bao đã xoá vẫn lọt vào kho.
--
-- 59 kỳ · 19.000 yên, rải trên 5 tháng 2025-11 → 2026-09:
--   55 kỳ đã thu      8.800
--    4 kỳ không đòi được 10.200
--
-- KHÔNG bỏ khỏi tổng: 8.800 yên là tiền thu thật, bỏ đi thì tổng thu sai. Chỉ
-- đánh dấu để biết, và tắt nút sang CMS vì bấm vào chỉ ra trang không tìm thấy.

-- Chèn cột vào giữa nên phải drop; v_telecom_dot_thu đọc view này nên gỡ trước.
drop view if exists v_telecom_dot_thu;
drop view if exists v_telecom_ky_cuoc;

create view v_telecom_ky_cuoc as
with may as (
  select distinct on (fee_line_id) fee_line_id, ma_chuan
    from v_tb_ma_ky order by fee_line_id, ma_chuan
)
select f.source_id                                   as fee_line_id,
       to_char(make_date(f.nam, f.thang, 1), 'YYYY-MM') as ky,
       f.subscription_source_id                      as subscription_id,
       m.ma_chuan                                    as ma_thiet_bi,
       f.amount                                      as tien,
       i.source_id                                   as invoice_id,
       i.number                                      as so_hoa_don,
       i.status                                      as trang_thai_hd,
       i.issued_on                                   as ngay_lap,
       i.due_on                                      as han_tra,
       s.status                                      as trang_thai_tb,
       s.plan_name                                   as goi,
       -- Thuê bao đã xoá ở nguồn: hồ sơ không còn, chỉ còn cái kỳ cước.
       s.source_id is null                           as tb_da_xoa,
       case when s.source_id is null then 'thuê bao đã xoá ở nguồn'
            else coalesce(p.display_name, 'khách chưa có tên') end as khach,
       ps.customer_code                              as ma_khach,
       ps.customer_type                              as loai_khach,
       -- Tắt link khi thuê bao đã xoá: bấm vào chỉ ra trang không tìm thấy.
       case when s.source_id is null then null
            else telecom_url('thue_bao', f.subscription_source_id) end as link_cms
  from fee_line_snapshot f
  left join may m on m.fee_line_id = f.source_id
  left join invoice_snapshot i on i.source = 'TELECOM' and i.source_id = f.invoice_source_id
  left join subscription_snapshot s on s.source = 'TELECOM' and s.source_id = f.subscription_source_id
  left join party_source ps
    on ps.source = 'TELECOM' and ps.source_customer_id = s.source_customer_id
   and ps.status <> 'REJECTED'
  left join party p on p.id = ps.party_id
 where f.source = 'TELECOM';

/** Thêm cột đếm kỳ mồ côi vào bảng đợt thu. */
create view v_telecom_dot_thu as
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
       ky > to_char(CURRENT_DATE, 'YYYY-MM')                           as ky_tuong_lai,
       count(*) filter (where tb_da_xoa)                               as ky_mo_coi,
       round(coalesce(sum(tien) filter (where tb_da_xoa), 0))          as tien_mo_coi
  from v_telecom_ky_cuoc
 where ky <= to_char(CURRENT_DATE, 'YYYY') || '-12'
 group by ky;
