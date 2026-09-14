-- Trang khách phải cộng nợ theo KHÁCH, không phải theo thuê bao.
--
-- 130 hoá đơn đang đòi (318.023 yên) không gắn thuê bao nào — chỉ có mã khách.
-- View cũ cộng nợ bằng cách tổng hợp từng thuê bao nên số tiền này rơi hết:
-- trang hiện 236.316 trong khi nợ thật của mảng cầm tay là 554.339. Hơn một
-- nửa số tiền vô hình.
--
-- Cả 130 hoá đơn đều nối được về party, nên chỉ cần đi thẳng từ hoá đơn.

create or replace view v_telecom_party_debt as
select party_id,
       round(sum(con_lai) filter (where status = 'ISSUED' and current_date > han_tra))  as con_no,
       round(sum(con_lai) filter (where status = 'ISSUED' and current_date <= han_tra)) as chua_toi_han,
       round(sum(con_lai) filter (where status = 'UNPAYABLE'))                          as tien_mat,
       round(sum(paid_amount) filter (where status <> 'VOID'))                          as da_thu,
       max(current_date - han_tra) filter (where status = 'ISSUED')                     as ngay_qua_han,
       max(period_end) filter (where status <> 'VOID')                                  as ky_gan_nhat_den
  from v_telecom_invoice_due
 where party_id is not null
 group by party_id;

create or replace view v_telecom_customer as
 WITH cb AS (
         SELECT s_1.party_id, array_agg(DISTINCT u.cb) AS canh_bao
           FROM v_telecom_subscription s_1, LATERAL unnest(s_1.canh_bao) u(cb)
          WHERE s_1.party_id IS NOT NULL
          GROUP BY s_1.party_id
        ), ma AS (
         -- Gộp trước, không thì party có hai mã nguồn sẽ nhân đôi số thuê bao.
         SELECT party_id,
                string_agg(DISTINCT customer_code, ', ' ORDER BY customer_code) AS ma_khach,
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
    COALESCE(n.chua_toi_han, 0::numeric) AS chua_toi_han
   -- Đi từ khách chứ không từ thuê bao: có khách chỉ có hoá đơn, không thuê bao
   -- nào, mà vẫn đang nợ.
   FROM party p
     JOIN ma ON ma.party_id = p.id
     LEFT JOIN v_telecom_subscription s ON s.party_id = p.id
     LEFT JOIN cb ON cb.party_id = p.id
     LEFT JOIN v_telecom_party_debt n ON n.party_id = p.id
  GROUP BY p.id, p.display_name, p.phone_norm, cb.canh_bao, ma.ma_khach,
           ma.loai_khach, ma.nhom_khach, n.party_id,
           n.da_thu, n.con_no, n.tien_mat, n.ngay_qua_han, n.ky_gan_nhat_den, n.chua_toi_han
  -- Hồ sơ khách trắng trơn — không thuê bao, không hoá đơn — thì để ngoài danh
  -- sách; 1.324 hồ sơ như thế chỉ làm loãng trang.
  HAVING count(s.subscription_id) > 0 OR n.party_id IS NOT NULL;
