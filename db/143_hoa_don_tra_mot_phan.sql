-- Hoá đơn trả một phần: 17 hoá đơn còn ở trạng thái đang đòi nhưng đã nhận
-- 13.211 yên trên tổng 50.313. Bảng đợt thu đang đếm cả 50.313 vào "đang đòi",
-- tức coi như chưa nhận đồng nào.
--
-- Nhỏ (0,016% tổng cước) nhưng sai nguyên tắc: tiền đã vào két thì phải nằm ở
-- cột đã thu. Chia theo tỉ lệ trả của hoá đơn vì một hoá đơn có thể gồm nhiều
-- kỳ cước, không biết khách trả cho kỳ nào.

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
       -- Phần của kỳ này đã nhận được, chia theo tỉ lệ trả của cả hoá đơn.
       case when i.status = 'PAID' then f.amount
            when i.status = 'ISSUED' and coalesce(i.paid_amount, 0) > 0
              then round(f.amount * i.paid_amount / nullif(i.total_amount, 0), 2)
            else 0 end                               as tien_da_nhan,
       i.source_id                                   as invoice_id,
       i.number                                      as so_hoa_don,
       i.status                                      as trang_thai_hd,
       coalesce(i.paid_amount, 0) > 0 and i.status = 'ISSUED' as tra_mot_phan,
       i.issued_on                                   as ngay_lap,
       i.due_on                                      as han_tra,
       s.status                                      as trang_thai_tb,
       s.plan_name                                   as goi,
       s.source_id is null                           as tb_da_xoa,
       case when s.source_id is null then 'thuê bao đã xoá ở nguồn'
            else coalesce(p.display_name, 'khách chưa có tên') end as khach,
       ps.customer_code                              as ma_khach,
       ps.customer_type                              as loai_khach,
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

create view v_telecom_dot_thu as
select ky,
       count(*)                                                        as so_ky,
       count(distinct subscription_id)                                 as so_thue_bao,
       count(distinct ma_thiet_bi)                                     as so_may,
       round(sum(tien))                                                as phai_thu,
       -- Đã thu = hoá đơn đã trả đủ, cộng phần đã nhận của hoá đơn trả dở.
       round(sum(tien_da_nhan))                                        as da_thu,
       round(coalesce(sum(tien - tien_da_nhan) filter (where trang_thai_hd = 'ISSUED'), 0)) as dang_doi,
       round(coalesce(sum(tien) filter (where trang_thai_hd = 'UNPAYABLE'), 0)) as bo_thu,
       round(coalesce(sum(tien) filter (where trang_thai_hd = 'VOID'), 0))      as huy_hd,
       round(100.0 * sum(tien_da_nhan) / nullif(sum(tien), 0), 1)      as ty_le_thu,
       count(*) filter (where loai_khach = 'CUSTOMER')                 as ky_khach_le,
       count(*) filter (where loai_khach = 'COLLABORATOR')             as ky_ctv,
       count(*) filter (where loai_khach = 'AGENCY')                   as ky_dai_ly,
       count(*) filter (where loai_khach is null)                      as ky_khong_ro,
       round(coalesce(sum(tien) filter (where loai_khach = 'CUSTOMER'), 0))     as tien_khach_le,
       round(coalesce(sum(tien) filter (where loai_khach = 'COLLABORATOR'), 0)) as tien_ctv,
       round(coalesce(sum(tien) filter (where loai_khach = 'AGENCY'), 0))       as tien_dai_ly,
       ky > to_char(CURRENT_DATE, 'YYYY-MM')                           as ky_tuong_lai,
       count(*) filter (where tb_da_xoa)                               as ky_mo_coi,
       round(coalesce(sum(tien) filter (where tb_da_xoa), 0))          as tien_mo_coi,
       count(*) filter (where tra_mot_phan)                            as ky_tra_do
  from v_telecom_ky_cuoc
 where ky <= to_char(CURRENT_DATE, 'YYYY') || '-12'
 group by ky;
