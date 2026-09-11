-- Góc nhìn cho mảng wifi cầm tay. Hệ telecom có hoá đơn thật nên công nợ đọc
-- thẳng, không phải suy từ sổ thu như bên wifi cố định.

/** Một dòng một thuê bao, kèm công nợ và cảnh báo. */
drop view if exists v_telecom_subscription;
create view v_telecom_subscription as
with hd as (
  select subscription_source_id                                        as sid,
         count(*)                                                      as so_hoa_don,
         count(*) filter (where status = 'ISSUED')                     as hoa_don_dang_doi,
         round(sum(total_amount - paid_amount) filter (where status = 'ISSUED')) as con_no,
         count(*) filter (where status = 'UNPAYABLE')                  as hoa_don_mat,
         round(sum(total_amount - paid_amount) filter (where status = 'UNPAYABLE')) as tien_mat,
         round(sum(paid_amount))                                       as da_thu,
         max(period_end)                                               as ky_gan_nhat_den,
         max(current_date - due_on) filter (where status = 'ISSUED')   as ngay_qua_han
    from invoice_snapshot
   where source = 'TELECOM' and status <> 'VOID'
   group by 1
),
may as (
  select subscription_source_id as sid,
         count(*) filter (where status = 'NOT_RETURNED') as may_chua_tra
    from device_snapshot where source = 'TELECOM' and subscription_source_id is not null
   group by 1
),
nguong as (
  select (select value::int from threshold where key = 'ar_overdue_days')   as qua_han,
         (select value::int from threshold where key = 'invoice_grace_days') as an_han
)
select
  s.source_id                                   as subscription_id,
  s.party_id,
  p.display_name                                as khach,
  s.service_type,
  s.plan_name                                   as goi,
  s.status                                      as trang_thai,
  s.monthly_price                               as gia_thang,
  s.activated_on                                as ngay_kich_hoat,
  s.terminated_on                               as ngay_ngung,
  s.device_ref                                  as ma_may,
  coalesce(hd.so_hoa_don, 0)                    as so_hoa_don,
  coalesce(hd.hoa_don_dang_doi, 0)              as hoa_don_dang_doi,
  coalesce(hd.con_no, 0)                        as con_no,
  coalesce(hd.hoa_don_mat, 0)                   as hoa_don_mat,
  coalesce(hd.tien_mat, 0)                      as tien_mat,
  coalesce(hd.da_thu, 0)                        as da_thu,
  hd.ky_gan_nhat_den,
  coalesce(hd.ngay_qua_han, 0)                  as ngay_qua_han,
  coalesce(may.may_chua_tra, 0)                 as may_chua_tra,
  coalesce(
    current_date - hd.ky_gan_nhat_den,
    current_date - s.activated_on)              as ngay_khong_co_cuoc,
  array_remove(array[
    case when coalesce(hd.ngay_qua_han, 0) > (select qua_han from nguong)
         then 'NO_QUA_HAN' end,
    case when coalesce(hd.hoa_don_mat, 0) > 0 then 'KHONG_DOI_DUOC' end,
    case when s.status = 'ACTIVE'
          and coalesce(current_date - hd.ky_gan_nhat_den,
                       current_date - s.activated_on) > (select an_han from nguong)
         then 'THIEU_HOA_DON' end,
    case when s.status = 'ACTIVE' and (s.monthly_price is null or s.monthly_price = 0)
         then 'THIEU_GIA' end,
    case when coalesce(may.may_chua_tra, 0) > 0 then 'MAY_CHUA_TRA' end
  ], null)                                      as canh_bao
from subscription_snapshot s
left join party p    on p.id = s.party_id
left join hd         on hd.sid = s.source_id
left join may        on may.sid = s.source_id
where s.source = 'TELECOM';

/** Hoá đơn của một thuê bao, cho ngăn kéo chi tiết. */
drop view if exists v_telecom_invoice;
create view v_telecom_invoice as
select
  i.subscription_source_id  as subscription_id,
  i.source_id               as invoice_id,
  i.number                  as so_hoa_don,
  i.issued_on               as ngay_lap,
  i.due_on                  as han_tra,
  i.period_start            as ky_tu,
  i.period_end              as ky_den,
  i.total_amount            as tien,
  i.paid_amount             as da_tra,
  i.total_amount - i.paid_amount as con_lai,
  i.status                  as trang_thai,
  (select string_agg(distinct pm.channel, ', ')
     from payment_snapshot pm
    where pm.source = 'TELECOM' and pm.invoice_source_id = i.source_id) as kenh_thu
from invoice_snapshot i
where i.source = 'TELECOM';

/**
 * Theo tháng của mảng cầm tay. Ghép theo KỲ CƯỚC (period_start) chứ không theo
 * ngày lập, để so được với bảng cước bên wifi cố định.
 */
drop view if exists v_telecom_month;
create view v_telecom_month as
select
  to_char(coalesce(i.period_start, i.issued_on), 'YYYY-MM')            as ky,
  count(*)                                                            as so_hoa_don,
  count(distinct i.subscription_source_id)                            as so_thue_bao,
  round(sum(i.total_amount))                                          as phai_thu,
  round(sum(i.paid_amount))                                           as da_thu,
  round(sum(i.total_amount - i.paid_amount) filter (where i.status = 'ISSUED'))    as con_doi,
  round(sum(i.total_amount - i.paid_amount) filter (where i.status = 'UNPAYABLE')) as mat_trang,
  count(*) filter (where i.status = 'ISSUED')                         as hoa_don_dang_doi,
  count(*) filter (where i.status = 'UNPAYABLE')                      as hoa_don_mat,
  round(100.0 * sum(i.paid_amount) / nullif(sum(i.total_amount), 0), 1) as ty_le_thu
from invoice_snapshot i
where i.source = 'TELECOM' and i.status <> 'VOID'
group by 1;

/** Tiền về theo kênh, cho một khoảng ngày. */
drop function if exists telecom_channel_report(date, date);
create function telecom_channel_report(p_tu date default null, p_den date default null)
returns table (kenh text, so_lan bigint, tien numeric)
language sql stable as $$
  select coalesce(nullif(btrim(channel), ''), 'không ghi kênh'),
         count(*), round(sum(amount))
    from payment_snapshot
   where source = 'TELECOM'
     and (p_tu  is null or paid_at::date >= p_tu)
     and (p_den is null or paid_at::date <= p_den)
   group by 1 order by 3 desc;
$$;

-- Phán quyết thiếu hoá đơn trỏ sang trang danh sách thuê bao mới.
update finding
   set metabase_url = '/cam-tay/thue-bao?cb=THIEU_HOA_DON'
 where rule_key = 'R_MISSING_INVOICE';
