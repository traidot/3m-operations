-- Bày "phải hoàn cho khách" lên trang khách, và ghi loại lên từng hoá đơn.

create or replace view v_telecom_invoice as
select i.subscription_source_id as subscription_id,
       i.source_id              as invoice_id,
       i.number                 as so_hoa_don,
       i.issued_on              as ngay_lap,
       d.han_tra,
       i.period_start           as ky_tu,
       i.period_end             as ky_den,
       i.total_amount           as tien,
       i.paid_amount            as da_tra,
       i.total_amount - i.paid_amount as con_lai,
       i.status                 as trang_thai,
       (select string_agg(distinct pm.channel, ', ')
          from payment_snapshot pm
         where pm.source = 'TELECOM' and pm.invoice_source_id = i.source_id) as kenh_thu,
       current_date > d.han_tra and not d.la_hoan_tien as qua_han,
       telecom_url('hoa_don', i.source_id) as link_cms,
       i.party_id,
       i.invoice_type           as loai
  from invoice_snapshot i
  join v_telecom_invoice_due d on d.source_id = i.source_id
 where i.source = 'TELECOM';

create or replace view v_telecom_customer as
 WITH cb AS (
         SELECT s_1.party_id, array_agg(DISTINCT u.cb) AS canh_bao
           FROM v_telecom_subscription s_1, LATERAL unnest(s_1.canh_bao) u(cb)
          WHERE s_1.party_id IS NOT NULL
          GROUP BY s_1.party_id
        ), ma AS (
         SELECT party_id,
                string_agg(DISTINCT customer_code, ', ' ORDER BY customer_code) AS ma_khach,
                array_agg(source_customer_id ORDER BY source_customer_id) AS ma_nguon,
                max(customer_type) AS loai_khach,
                max(customer_group) AS nhom_khach
           FROM party_source
          WHERE source = 'TELECOM' AND status <> 'REJECTED'
          GROUP BY party_id
        )
 SELECT p.id AS party_id,
    COALESCE(p.display_name, 'khách chưa có tên') AS khach,
    p.phone_norm AS dien_thoai,
    ma.loai_khach,
    customer_type_label(ma.loai_khach) AS loai_khach_chu,
    ma.nhom_khach,
    count(s.subscription_id) AS so_thue_bao,
    count(*) FILTER (WHERE s.trang_thai = 'ACTIVE') AS dang_chay,
    array_agg(DISTINCT s.service_type) FILTER (WHERE s.service_type IS NOT NULL) AS dich_vu,
    COALESCE(n.da_thu, 0::numeric) AS da_thu,
    COALESCE(n.con_no, 0::numeric) AS con_no,
    COALESCE(n.tien_mat, 0::numeric) AS tien_mat,
    COALESCE(sum(s.may_chua_tra), 0::bigint) AS may_chua_tra,
    COALESCE(n.ngay_qua_han, 0) AS ngay_qua_han,
    n.ky_gan_nhat_den,
    CASE WHEN COALESCE(n.con_no, 0::numeric) > 0 AND NOT ('NO_QUA_HAN' = ANY (COALESCE(cb.canh_bao, '{}'::text[])))
         THEN COALESCE(cb.canh_bao, '{}'::text[]) || 'NO_QUA_HAN'::text
         ELSE COALESCE(cb.canh_bao, '{}'::text[])
    END AS canh_bao,
    ma.ma_khach,
    COALESCE(n.chua_toi_han, 0::numeric) AS chua_toi_han,
    (SELECT array_agg(telecom_url('khach', v)) FROM unnest(ma.ma_nguon) v) AS link_cms,
    COALESCE(n.phai_hoan, 0::numeric) AS phai_hoan
   FROM party p
     JOIN ma ON ma.party_id = p.id
     LEFT JOIN v_telecom_subscription s ON s.party_id = p.id
     LEFT JOIN cb ON cb.party_id = p.id
     LEFT JOIN v_telecom_party_debt n ON n.party_id = p.id
  GROUP BY p.id, p.display_name, p.phone_norm, cb.canh_bao, ma.ma_khach, ma.ma_nguon,
           ma.loai_khach, ma.nhom_khach, n.party_id,
           n.da_thu, n.con_no, n.tien_mat, n.ngay_qua_han, n.ky_gan_nhat_den,
           n.chua_toi_han, n.phai_hoan
  HAVING count(s.subscription_id) > 0 OR n.party_id IS NOT NULL;
