-- Cùng lý do db/177, cho màn hình máy cho thuê.
--
-- View này đã có sẵn cờ cho_muon từ đơn hàng, dùng luôn — máy cho mượn thì
-- thuê bao của nó cũng thuộc nhóm cho mượn.

create or replace view v_telecom_may as
 WITH luot AS (
         SELECT DISTINCT ON (device_snapshot.imei) device_snapshot.imei,
            device_snapshot.source_id AS may_id,
            device_snapshot.status,
            device_snapshot.deposit,
            device_snapshot.deposit_status,
            device_snapshot.rented_on,
            device_snapshot.returned_on,
            device_snapshot.subscription_source_id,
            device_snapshot.cho_muon_cd
           FROM device_snapshot
          WHERE device_snapshot.source = 'TELECOM'::source_system AND device_snapshot.imei IS NOT NULL
          ORDER BY device_snapshot.imei, device_snapshot.rented_on DESC NULLS LAST, device_snapshot.source_id DESC
        ), doi_may AS (
         SELECT DISTINCT ON (device_snapshot.imei) device_snapshot.imei,
            device_snapshot.model,
            device_snapshot.device_type
           FROM device_snapshot
          WHERE device_snapshot.source = 'TELECOM'::source_system AND device_snapshot.imei IS NOT NULL AND device_snapshot.model IS NOT NULL
          ORDER BY device_snapshot.imei, device_snapshot.rented_on DESC NULLS LAST, device_snapshot.source_id DESC
        ), tong_luot AS (
         SELECT device_snapshot.imei,
            count(*) AS so_luot_thue,
            min(device_snapshot.rented_on) AS thue_lan_dau
           FROM device_snapshot
          WHERE device_snapshot.source = 'TELECOM'::source_system AND device_snapshot.imei IS NOT NULL
          GROUP BY device_snapshot.imei
        ), gan AS (
         SELECT sd.imei,
            count(*) AS so_lan_gan,
            count(DISTINCT sd.subscription_source_id) AS so_thue_bao
           FROM subscription_device_snapshot sd
          WHERE sd.source = 'TELECOM'::source_system
          GROUP BY sd.imei
        ), gan_cuoi AS (
         SELECT DISTINCT ON (sd.imei) sd.imei,
            sd.subscription_source_id,
            sd.started_on,
            s_1.status AS trang_thai_tb,
            s_1.monthly_price
           FROM subscription_device_snapshot sd
             LEFT JOIN subscription_snapshot s_1 ON s_1.source = 'TELECOM'::source_system AND s_1.source_id = sd.subscription_source_id
          WHERE sd.source = 'TELECOM'::source_system
          ORDER BY sd.imei, sd.started_on DESC NULLS LAST, sd.source_id DESC
        ), kx AS (
         SELECT DISTINCT ON ((ltrim(xc.device_code, '0'::text))) ltrim(xc.device_code, '0'::text) AS ma_chuan,
            pt.display_name AS khach,
            ps_1.customer_code AS ma_khach,
            ps_1.customer_type AS loai_khach
           FROM v_kho_xuat_cuoi xc
             LEFT JOIN party pt ON pt.id = xc.party_id
             LEFT JOIN party_source ps_1 ON ps_1.source = 'TELECOM'::source_system AND ps_1.party_id = xc.party_id AND ps_1.status <> 'REJECTED'::text
          WHERE xc.party_id IS NOT NULL
          ORDER BY (ltrim(xc.device_code, '0'::text)), xc.doc_date DESC NULLS LAST, xc.device_code
        ), cuoc AS (
         SELECT v_telecom_may_ky.imei,
            count(*) AS so_ky,
            min(v_telecom_may_ky.ky) AS ky_dau,
            max(v_telecom_may_ky.ky) AS ky_cuoi,
            round(sum(v_telecom_may_ky.tien)) AS phai_thu,
            round(sum(v_telecom_may_ky.tien) FILTER (WHERE v_telecom_may_ky.trang_thai_hd = 'PAID'::text)) AS da_thu,
            round(sum(v_telecom_may_ky.tien) FILTER (WHERE v_telecom_may_ky.trang_thai_hd = 'ISSUED'::text)) AS chua_thu,
            round(sum(v_telecom_may_ky.tien) FILTER (WHERE v_telecom_may_ky.trang_thai_hd = 'UNPAYABLE'::text)) AS mat_trang
           FROM v_telecom_may_ky
          GROUP BY v_telecom_may_ky.imei
        ), nen AS (
         SELECT l_1.imei,
            l_1.status AS trang_thai,
            c_1.ky_cuoi,
            gc_1.trang_thai_tb,
            gc_1.monthly_price,
            gc_1.started_on,
            COALESCE(g_1.so_lan_gan, 0::bigint) AS co_gan,
            COALESCE((to_date(c_1.ky_cuoi, 'YYYY-MM'::text) + '1 mon'::interval)::timestamp with time zone, date_trunc('month'::text, gc_1.started_on::timestamp with time zone))::date AS tu_thang
           FROM luot l_1
             LEFT JOIN cuoc c_1 ON c_1.imei = l_1.imei
             LEFT JOIN gan g_1 ON g_1.imei = l_1.imei
             LEFT JOIN gan_cuoi gc_1 ON gc_1.imei = l_1.imei
        ), xep AS (
         SELECT n.imei,
            n.trang_thai,
            n.ky_cuoi,
            n.trang_thai_tb,
            n.monthly_price,
            n.started_on,
            n.co_gan,
            n.tu_thang,
                CASE
                    WHEN n.trang_thai = 'RETURNED'::text THEN 'DA_TRA'::text
                    WHEN n.co_gan = 0 THEN 'CHUA_GAN'::text
                    WHEN n.trang_thai_tb IS NULL THEN 'TB_DA_XOA'::text
                    WHEN n.trang_thai_tb <> 'ACTIVE'::text THEN 'HUY_CHUA_THU_MAY'::text
                    WHEN n.ky_cuoi >= to_char(CURRENT_DATE::timestamp with time zone, 'YYYY-MM'::text) THEN 'DANG_RA_CUOC'::text
                    ELSE 'HUT_CUOC'::text
                END AS tinh_trang_cuoc,
            GREATEST(0, (EXTRACT(year FROM age(date_trunc('month'::text, CURRENT_DATE::timestamp with time zone), n.tu_thang::timestamp with time zone)) * 12::numeric + EXTRACT(month FROM age(date_trunc('month'::text, CURRENT_DATE::timestamp with time zone), n.tu_thang::timestamp with time zone)))::integer + 1) AS thang_ho
           FROM nen n
        )
select l.imei,
    l.may_id AS luot_moi_nhat_id,
    dm.model,
    dm.device_type AS nhom_may,
    l.status AS trang_thai,
        CASE
            WHEN l.deposit_status = 'PENDING'::text THEN round(l.deposit)
            ELSE 0::numeric
        END AS coc,
    l.deposit_status AS trang_thai_coc,
    t.thue_lan_dau AS ngay_thue,
    l.returned_on AS ngay_tra,
    t.so_luot_thue,
    l.subscription_source_id AS thue_bao_hien_tai,
    s.service_type AS dich_vu,
    s.plan_name AS goi,
    s.status AS trang_thai_thue_bao,
    COALESCE(p.display_name, NULLIF(tb.khach, 'khách chưa có tên'::text), kx.khach, ( SELECT max(p2.display_name) AS max
           FROM party_source ps2
             JOIN party p2 ON p2.id = ps2.party_id
          WHERE ps2.source = 'TELECOM'::source_system AND ps2.status <> 'REJECTED'::text AND ps2.customer_code = COALESCE(ps.customer_code, tb.ma_khach, kx.ma_khach)), 'khách chưa có tên'::text) AS khach,
    COALESCE(ps.customer_code, tb.ma_khach, kx.ma_khach) AS ma_khach,
    COALESCE(ps.customer_type, tb.loai_khach, kx.loai_khach) AS loai_khach,
    COALESCE(g.so_lan_gan, 0::bigint) AS so_lan_gan,
    COALESCE(g.so_thue_bao, 0::bigint) AS so_thue_bao,
    COALESCE(c.so_ky, 0::bigint) AS so_ky,
    c.ky_dau,
    c.ky_cuoi,
    COALESCE(c.phai_thu, 0::numeric) AS phai_thu,
    COALESCE(c.da_thu, 0::numeric) AS da_thu,
    COALESCE(c.chua_thu, 0::numeric) AS chua_thu,
    COALESCE(c.mat_trang, 0::numeric) AS mat_trang,
    l.status <> 'RETURNED'::text AND COALESCE(c.so_ky, 0::bigint) = 0 AS chua_ra_cuoc,
    CASE
        WHEN COALESCE(s.cho_muon_cd, false) THEN telecom_url('cho_muon'::text, l.imei)
        ELSE telecom_url('thue_bao'::text, l.subscription_source_id)
    END AS link_cms,
    x.tinh_trang_cuoc,
    gc.subscription_source_id AS thue_bao_gan_cuoi,
    x.trang_thai_tb AS trang_thai_tb_gan_cuoi,
        CASE
            WHEN x.tinh_trang_cuoc = ANY (ARRAY['DANG_RA_CUOC'::text, 'DA_TRA'::text]) THEN 0
            ELSE x.thang_ho
        END AS thang_hut,
        CASE
            WHEN x.tinh_trang_cuoc = 'HUT_CUOC'::text THEN round(COALESCE(x.monthly_price, 0::numeric) * x.thang_ho::numeric)
            ELSE 0::numeric
        END AS tien_hut_uoc,
    ( SELECT max(ps2.customer_group) AS max
           FROM party_source ps2
          WHERE ps2.source = 'TELECOM'::source_system AND ps2.status <> 'REJECTED'::text AND ps2.customer_code = COALESCE(ps.customer_code, tb.ma_khach, kx.ma_khach)) AS nhom_khach,
    COALESCE(l.cho_muon_cd, false) AS cho_muon,
    (EXISTS ( SELECT 1
           FROM stock_move_snapshot sm
          WHERE sm.source = 'TELECOM'::source_system AND sm.is_no_recall AND ltrim(sm.device_code, '0'::text) = ltrim(l.imei, '0'::text))) AS khong_thu_hoi
   FROM luot l
     JOIN tong_luot t ON t.imei = l.imei
     JOIN xep x ON x.imei = l.imei
     LEFT JOIN gan g ON g.imei = l.imei
     LEFT JOIN gan_cuoi gc ON gc.imei = l.imei
     LEFT JOIN doi_may dm ON dm.imei = l.imei
     LEFT JOIN v_tb_ma tb ON tb.ma_chuan = ltrim(l.imei, '0'::text)
     LEFT JOIN kx ON kx.ma_chuan = ltrim(l.imei, '0'::text)
     LEFT JOIN cuoc c ON c.imei = l.imei
     LEFT JOIN subscription_snapshot s ON s.source = 'TELECOM'::source_system AND s.source_id = l.subscription_source_id
     LEFT JOIN party_source ps ON ps.source = 'TELECOM'::source_system AND ps.source_customer_id = s.source_customer_id AND ps.status <> 'REJECTED'::text
     LEFT JOIN party p ON p.id = ps.party_id;
