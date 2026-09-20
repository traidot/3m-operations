-- Dọn xong thì lộ ra lớp mồ côi thứ hai: con của những dòng vừa bị dọn.
--
-- Xoá 4 thuê bao đã xoá ở nguồn thì hoá đơn và kỳ cước của chúng thành mồ côi.
-- Theo chốt của David — đã xoá thì bỏ — nên loại khỏi số luôn:
--
--     5 hoá đơn   14.200 yên   thuê bao không còn
--     1 đợt trả góp            kỳ cước không còn (bên wifi cố định)
--
-- Kỳ cước mồ côi (60 kỳ, 23.000) đã loại từ db/144.
--
-- Hoá đơn KHÔNG gắn thuê bao thì giữ: đó là hoá đơn bán hàng, vốn không có
-- thuê bao chứ không phải mất thuê bao. Chỉ loại khi có mã mà mã đó không còn.

delete from fixed_fee_installment i
 where i.source = 'FIXED' and i.fee_period_id is not null
   and not exists (select 1 from fee_period_snapshot k
                    where k.source = 'FIXED' and k.source_id = i.fee_period_id);

create or replace view v_telecom_month as
select to_char(coalesce(i.period_start, i.issued_on)::timestamptz, 'YYYY-MM') as ky,
       count(*)                                                   as so_hoa_don,
       count(distinct i.subscription_source_id)                   as so_thue_bao,
       round(sum(i.total_amount))                                 as phai_thu,
       round(sum(i.paid_amount))                                  as da_thu,
       round(sum(i.total_amount - i.paid_amount) filter (where i.status = 'ISSUED'))    as con_doi,
       round(sum(i.total_amount - i.paid_amount) filter (where i.status = 'UNPAYABLE')) as mat_trang,
       count(*) filter (where i.status = 'ISSUED')                as hoa_don_dang_doi,
       count(*) filter (where i.status = 'UNPAYABLE')             as hoa_don_mat,
       round(100.0 * sum(i.paid_amount) / nullif(sum(i.total_amount), 0), 1) as ty_le_thu
  from invoice_snapshot i
 where i.source = 'TELECOM' and i.status <> 'VOID'
   -- Hoá đơn trỏ tới thuê bao đã xoá thì bỏ; hoá đơn vốn không có thuê bao
   -- (bán hàng) thì giữ.
   and (i.subscription_source_id is null
        or exists (select 1 from subscription_snapshot s
                    where s.source = 'TELECOM' and s.source_id = i.subscription_source_id))
 group by 1;
