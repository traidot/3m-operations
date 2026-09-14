-- Danh sách đòi nợ phải nhìn số sau khi trừ cọc.
--
-- v_fixed_arrears đọc từ v_fixed_debt nên đã tự hưởng mốc hạn mùng 10, nhưng
-- chưa biết gì về tiền cọc. Hợp đồng mà khách đã nộp đủ, chỉ chờ bên mình
-- duyệt, thì không được nằm trong danh sách gọi điện đòi.

create or replace view v_fixed_arrears as
 WITH ky_cuoi AS (
         SELECT subscription_id, max(ky) AS ky_da_thu_gan_nhat
           FROM v_fixed_settled_fee GROUP BY subscription_id
        ), cho_duyet AS (
         SELECT subscription_source_id AS subscription_id,
            count(*) FILTER (WHERE status = 'PENDING_APPROVAL') AS ky_cho_duyet,
            count(*) FILTER (WHERE status = 'NOTE_ONLY') AS ky_ghi_chu
           FROM fee_period_snapshot WHERE source = 'FIXED'
          GROUP BY subscription_source_id
        )
 SELECT d.subscription_id,
    d.contract_code,
    s.status AS trang_thai_hop_dong,
    o.status AS trang_thai_lap_dat,
    k.ky_da_thu_gan_nhat,
    COALESCE(p.ky_cho_duyet, 0::bigint) AS ky_cho_duyet,
    COALESCE(p.ky_ghi_chu, 0::bigint) AS ky_ghi_chu,
    d.so_ky,
    d.so_ky_mien_phi,
    d.so_ky_no,
    d.tong_da_thu,
    d.con_no,
    COALESCE(dp.coc_cho_duyet, 0::numeric) AS coc_cho_duyet,
    GREATEST(d.con_no - COALESCE(dp.coc_cho_duyet, 0::numeric), 0::numeric) AS con_no_sau_coc
   FROM v_fixed_debt d
     JOIN subscription_snapshot s ON s.source = 'FIXED' AND s.source_id = d.subscription_id
     LEFT JOIN install_order_snapshot o ON o.source = 'FIXED' AND o.source_id = d.subscription_id
     LEFT JOIN ky_cuoi k ON k.subscription_id = d.subscription_id
     LEFT JOIN cho_duyet p ON p.subscription_id = d.subscription_id
     LEFT JOIN v_fixed_deposit dp ON dp.subscription_id = d.subscription_id
  WHERE s.status = 'ACTIVE'
    AND d.so_ky_no >= (SELECT value::integer FROM threshold WHERE key = 'fixed_arrears_periods')
    AND GREATEST(d.con_no - COALESCE(dp.coc_cho_duyet, 0::numeric), 0::numeric) > 0;
