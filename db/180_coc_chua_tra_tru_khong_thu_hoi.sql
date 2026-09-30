-- Nhóm cọc "máy chưa trả" phải trừ máy phiếu ghi không cần thu hồi.
--
-- Màn cọc đang báo 167 máy chưa trả trong khi màn khách báo 7 — cùng một
-- khái niệm mà hai số, vì db/174 mới trừ cờ ở v_telecom_subscription. 162
-- trên 167 máy đó xuất đi là xong, không ai đòi; chúng thuộc nhóm "ngừng
-- dịch vụ mà chưa chốt cọc" chứ không phải nhóm phải đi đòi máy.

create or replace view v_telecom_deposit as
 WITH luot AS (
         SELECT DISTINCT ON (device_snapshot.imei) device_snapshot.imei,
            device_snapshot.status,
            device_snapshot.deposit,
            device_snapshot.deposit_status,
            device_snapshot.rented_on,
            device_snapshot.returned_on
           FROM device_snapshot
          WHERE device_snapshot.source = 'TELECOM'::source_system AND device_snapshot.imei IS NOT NULL
          ORDER BY device_snapshot.imei, device_snapshot.rented_on DESC NULLS LAST, device_snapshot.source_id DESC
        ), gan AS (
         SELECT DISTINCT ON (sd.imei) sd.imei,
            sd.subscription_source_id,
            sd.started_on,
            sd.ended_on
           FROM subscription_device_snapshot sd
          WHERE sd.source = 'TELECOM'::source_system
          ORDER BY sd.imei, sd.started_on DESC NULLS LAST, sd.source_id DESC
        )
select l.imei,
    g.subscription_source_id AS subscription_id,
    s.party_id,
    COALESCE(p.display_name, 'khách chưa có tên'::text) AS khach,
    ps.customer_type AS loai_khach,
    s.service_type,
    s.status AS trang_thai_thue_bao,
    s.terminated_on AS ngay_ngung,
    l.status AS trang_thai_may,
    l.deposit AS coc,
    l.deposit_status AS trang_thai_coc,
    l.rented_on AS ngay_thue,
    l.returned_on AS ngay_tra,
    g.started_on AS gan_tu,
    g.ended_on AS gan_den,
        CASE
            WHEN l.status = 'NOT_RETURNED'::text AND l.deposit_status = 'PENDING'::text
                 AND NOT (EXISTS (
                   SELECT 1 FROM stock_move_snapshot sm
                    WHERE sm.source = 'TELECOM'::source_system AND sm.is_no_recall
                      AND ltrim(sm.device_code, '0') = ltrim(l.imei, '0')
                 )) THEN 'CHUA_TRA'::text
            WHEN l.deposit_status = 'PENDING'::text AND g.imei IS NULL THEN 'CHUA_GAN'::text
            WHEN l.deposit_status = 'PENDING'::text AND s.status = 'TERMINATED'::text THEN 'NGUNG_CHUA_CHOT'::text
            WHEN l.deposit_status = 'PENDING'::text THEN 'DANG_THUE'::text
            ELSE 'XONG'::text
        END AS nhom,
    CURRENT_DATE - COALESCE(s.terminated_on, g.started_on, l.rented_on) AS so_ngay_treo
   FROM luot l
     LEFT JOIN gan g ON g.imei = l.imei
     LEFT JOIN subscription_snapshot s ON s.source = 'TELECOM'::source_system AND s.source_id = g.subscription_source_id
     LEFT JOIN party_source ps ON ps.source = 'TELECOM'::source_system AND ps.source_customer_id = s.source_customer_id AND ps.status <> 'REJECTED'::text
     LEFT JOIN party p ON p.id = ps.party_id;
