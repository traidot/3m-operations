-- Lịch sử thu cước từ đầu: 27.648 kỳ cước, 2024-02 → 2027-09, kỳ nào cũng nối
-- được về thuê bao và về hoá đơn nên đọc được cả tiền lẫn kết quả thu.
--
-- Đơn vị tiền là KỲ CƯỚC (fee_line), không phải máy: 544 kỳ nối vào hơn một mã
-- thiết bị vì thuê bao đổi máy giữa kỳ, đếm theo máy là nhân đôi tiền. Máy chỉ
-- lấy một cái để hiển thị, chọn theo thứ tự cố định cho khỏi nhảy.

create or replace view v_telecom_ky_cuoc as
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
       coalesce(p.display_name, 'khách chưa có tên') as khach,
       ps.customer_code                              as ma_khach,
       ps.customer_type                              as loai_khach,
       telecom_url('thue_bao', f.subscription_source_id) as link_cms
  from fee_line_snapshot f
  left join may m on m.fee_line_id = f.source_id
  left join invoice_snapshot i on i.source = 'TELECOM' and i.source_id = f.invoice_source_id
  left join subscription_snapshot s on s.source = 'TELECOM' and s.source_id = f.subscription_source_id
  left join party_source ps
    on ps.source = 'TELECOM' and ps.source_customer_id = s.source_customer_id
   and ps.status <> 'REJECTED'
  left join party p on p.id = ps.party_id
 where f.source = 'TELECOM';

comment on view v_telecom_ky_cuoc is
  'Một dòng một kỳ cước cầm tay, kèm máy, khách và kết quả thu — đếm tiền theo kỳ, không theo máy';

/** Một dòng một tháng: đợt thu cước của tháng đó ra sao. */
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
 group by ky;

comment on view v_telecom_dot_thu is
  'Mỗi tháng một dòng: đợt thu cước wifi cầm tay từ 2024-02 tới nay';
