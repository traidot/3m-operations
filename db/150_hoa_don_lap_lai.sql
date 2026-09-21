-- Kỳ đã lập lại hoá đơn thì dòng cước của hoá đơn cũ vẫn nằm trong sổ.
--
-- David bắt được thuê bao 2020 kỳ 2026-08: màn hình ghi "không đòi được" trong
-- khi CMS hiện rõ đã thanh toán. Kỳ đó có HAI dòng cước — HD160735 lập 01/07,
-- 7.095 yên, bị bỏ; và HD165105 lập 09/09, 2.365 yên, đã thu. Hoá đơn cũ bị
-- thay nhưng dòng cước của nó không bị xoá, nên bảng đợt thu đếm cả hai: vừa
-- thổi phồng phải thu vừa báo nhầm là không đòi được.
--
-- Toàn hệ 133 cặp (thuê bao, kỳ) như vậy, 463.782 yên đang bị tính nhầm.
--
-- Luật nhận biết: cùng một thuê bao, cùng một kỳ, có dòng nào hoá đơn ĐÃ THU
-- thì mấy dòng hoá đơn hỏng của kỳ đó là bản bị thay thế. Không suy đoán gì
-- thêm — nếu cả hai cùng hỏng thì giữ nguyên cả hai, vì không có bằng chứng
-- cái nào thay cái nào.

drop view if exists v_telecom_ky_mo_coi;
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
       -- Kỳ đã lập hoá đơn lại: hoá đơn cũ hỏng, hoá đơn mới đã thu. Dòng cước
       -- của hoá đơn cũ còn nguyên trong sổ nên phải nhận ra để khỏi đếm.
       i.status in ('UNPAYABLE', 'VOID') and exists (
         select 1 from fee_line_snapshot f2
           join invoice_snapshot i2 on i2.source = 'TELECOM' and i2.source_id = f2.invoice_source_id
          where f2.source = 'TELECOM'
            and f2.subscription_source_id = f.subscription_source_id
            and f2.nam = f.nam and f2.thang = f.thang
            and i2.status = 'PAID')                as bi_thay_the,
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
       0::bigint                                                       as ky_mo_coi,
       0::numeric                                                      as tien_mo_coi,
       count(*) filter (where tra_mot_phan)                            as ky_tra_do
  from v_telecom_ky_cuoc
 where ky <= to_char(CURRENT_DATE, 'YYYY') || '-12'
   and not tb_da_xoa
   and not bi_thay_the
 group by ky;

/** Kỳ cước của hoá đơn đã bị thay bằng hoá đơn khác — giữ để đối chiếu. */
create or replace view v_telecom_ky_bi_thay as
select * from v_telecom_ky_cuoc where bi_thay_the;

create or replace view v_telecom_ky_mo_coi as
select * from v_telecom_ky_cuoc where tb_da_xoa;
