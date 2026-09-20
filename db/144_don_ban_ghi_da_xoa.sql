-- Dọn bản ghi đã xoá ở nguồn mà lọt vào kho, và không tính chúng vào số nữa.
--
-- David chốt: đã xoá thì bỏ, không tính vào.
--
-- ① Wifi cố định — 48 đợt trả góp, 83.101 yên. Bảng nguồn
-- `contract_fee_payment_installments` có cột `deletedAt` mà truy vấn đồng bộ
-- quên lọc. Đã thêm lọc bên agent; ở đây xoá 48 dòng cũ vì đồng bộ chỉ ghi đè
-- chứ không tự dọn dòng nguồn đã bỏ.
--
-- Ba bảng FIXED khác không có xoá mềm nên không dính: deposit_allocations,
-- no_collection_reasons, và bảng devices đã lọc sẵn.
--
-- ② Wifi cầm tay — kỳ cước của thuê bao đã xoá. 59 kỳ, 19.000 yên. Trước đây
-- vẫn tính vào tổng và chỉ đánh dấu; giờ bỏ hẳn khỏi mọi con số. Vẫn giữ lại
-- một view riêng để biết chúng tồn tại, chứ không xoá dữ liệu.

delete from fixed_fee_installment i
 where i.source = 'FIXED'
   and i.fee_period_id is not null
   and not exists (select 1 from fee_period_snapshot k
                    where k.source = 'FIXED' and k.source_id = i.fee_period_id);

/** Kỳ cước cầm tay mồ côi — giữ riêng để đối chiếu, không cộng vào đâu cả. */
create or replace view v_telecom_ky_mo_coi as
select * from v_telecom_ky_cuoc where tb_da_xoa;

comment on view v_telecom_ky_mo_coi is
  'Kỳ cước cầm tay có thuê bao đã xoá ở nguồn — không tính vào tổng nào';

create or replace view v_telecom_dot_thu as
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
 group by ky;
