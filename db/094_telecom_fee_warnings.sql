-- Bỏ cảnh báo THIEU_GIA, thay bằng hai cảnh báo đo trên dữ liệu cước thật.
--
-- THIEU_GIA đọc packagePrice trên thuê bao, mà CMS không xuất cước từ trường
-- đó: trong 460 thuê bao đang chạy còn hạn mà trống packagePrice, 249 vẫn ra
-- cước bình thường tháng 9 (811.104 yên). Hơn nửa số cảnh báo là báo oan, nên
-- nhìn vào không biết cái nào thật.
--
-- Hai cảnh báo thay thế, loại trừ nhau:
--   HET_HAN        ACTIVE mà expirationDate đã qua — 238 thuê bao. Ví dụ đại lý
--                  Tebi có 62 thuê bao trống giá thì 51 cái đã hết hạn từ lâu,
--                  dòng cước cuối T4/2026, mà CMS vẫn để ACTIVE.
--   KHONG_RA_CUOC  còn hạn, đang chạy, mà kỳ tháng này không ra dòng cước nào
--                  — 211 thuê bao, trong đó 102 đã kêu THIEU_HOA_DON rồi nên
--                  chỉ bày 109 cái còn lại.
--
-- Cảnh báo này không phân biệt loại khách: bên cầm tay đại lý là khách trả tiền
-- thật cho 3M (khác wifi cố định, nơi đại lý tự thu của khách), nên vẫn kiểm
-- tra cước với họ như mọi khách khác.

create or replace view v_telecom_subscription as
 WITH don AS (
         SELECT sub.source_id AS sid,
            count(*) AS so_hoa_don_don_hang,
            max(COALESCE(i.period_end, i.issued_on)) AS moc_gan_nhat
           FROM subscription_snapshot sub
             JOIN invoice_snapshot i ON i.source = 'TELECOM'::source_system AND i.order_id = sub.order_ref AND i.status <> 'VOID'::text
          WHERE sub.source = 'TELECOM'::source_system AND sub.order_ref IS NOT NULL
          GROUP BY sub.source_id
        ), hd AS (
         SELECT i.subscription_source_id AS sid,
            count(*) AS so_hoa_don,
            count(*) FILTER (WHERE i.status = 'ISSUED'::text) AS hoa_don_dang_doi,
            round(sum(i.con_lai) FILTER (WHERE i.status = 'ISSUED'::text AND CURRENT_DATE > i.han_tra)) AS con_no,
            round(sum(i.con_lai) FILTER (WHERE i.status = 'ISSUED'::text AND CURRENT_DATE <= i.han_tra)) AS chua_toi_han,
            count(*) FILTER (WHERE i.status = 'UNPAYABLE'::text) AS hoa_don_mat,
            round(sum(i.con_lai) FILTER (WHERE i.status = 'UNPAYABLE'::text)) AS tien_mat,
            round(sum(i.paid_amount)) AS da_thu,
            max(i.period_end) AS ky_gan_nhat_den,
            max(CURRENT_DATE - i.han_tra) FILTER (WHERE i.status = 'ISSUED'::text) AS ngay_qua_han
           FROM v_telecom_invoice_due i
          WHERE i.status <> 'VOID'::text
          GROUP BY i.subscription_source_id
        ), may AS (
         SELECT device_snapshot.subscription_source_id AS sid,
            count(*) FILTER (WHERE device_snapshot.status = 'NOT_RETURNED'::text) AS may_chua_tra
           FROM device_snapshot
          WHERE device_snapshot.source = 'TELECOM'::source_system AND device_snapshot.subscription_source_id IS NOT NULL
          GROUP BY device_snapshot.subscription_source_id
        ), ky_nay AS (
         -- Có dòng cước nào cho kỳ tháng này chưa. Đây mới là chứng cứ "hệ
         -- thống tính được tiền cho thuê bao này", chứ không phải packagePrice.
         SELECT fl.subscription_source_id AS sid,
                count(*) AS so_dong
           FROM fee_line_snapshot fl
          WHERE fl.source = 'TELECOM'::source_system
            AND fl.subscription_source_id IS NOT NULL
            AND make_date(fl.nam, fl.thang, 1) >= date_trunc('month', CURRENT_DATE)::date
          GROUP BY fl.subscription_source_id
        ), nguong AS (
         SELECT ( SELECT threshold.value::integer AS value
                   FROM threshold
                  WHERE threshold.key = 'ar_overdue_days'::text) AS qua_han,
            ( SELECT threshold.value::integer AS value
                   FROM threshold
                  WHERE threshold.key = 'invoice_grace_days'::text) AS an_han
        )
 SELECT s.source_id AS subscription_id,
    s.party_id,
    p.display_name AS khach,
    ps.customer_type AS loai_khach,
    customer_type_label(ps.customer_type) AS loai_khach_chu,
    ps.customer_group AS nhom_khach,
    s.service_type,
    s.plan_name AS goi,
    s.status AS trang_thai,
    s.monthly_price AS gia_thang,
    s.activated_on AS ngay_kich_hoat,
    s.terminated_on AS ngay_ngung,
    s.device_ref AS ma_may,
    COALESCE(hd.so_hoa_don, 0::bigint) AS so_hoa_don,
    COALESCE(hd.hoa_don_dang_doi, 0::bigint) AS hoa_don_dang_doi,
    COALESCE(hd.con_no, 0::numeric) AS con_no,
    COALESCE(hd.hoa_don_mat, 0::bigint) AS hoa_don_mat,
    COALESCE(hd.tien_mat, 0::numeric) AS tien_mat,
    COALESCE(hd.da_thu, 0::numeric) AS da_thu,
    hd.ky_gan_nhat_den,
    COALESCE(hd.ngay_qua_han, 0) AS ngay_qua_han,
    COALESCE(may.may_chua_tra, 0::bigint) AS may_chua_tra,
    COALESCE(CURRENT_DATE - hd.ky_gan_nhat_den, CURRENT_DATE - s.activated_on) AS ngay_khong_co_cuoc,
    array_remove(ARRAY[
        CASE
            WHEN COALESCE(hd.ngay_qua_han, 0) > (( SELECT nguong.qua_han
               FROM nguong)) THEN 'NO_QUA_HAN'::text
            ELSE NULL::text
        END,
        CASE
            WHEN COALESCE(hd.hoa_don_mat, 0::bigint) > 0 THEN 'KHONG_DOI_DUOC'::text
            ELSE NULL::text
        END,
        CASE
            WHEN s.status = 'ACTIVE'::text AND (CURRENT_DATE - GREATEST(hd.ky_gan_nhat_den, don.moc_gan_nhat, s.activated_on)) > (( SELECT nguong.an_han
               FROM nguong)) THEN 'THIEU_HOA_DON'::text
            ELSE NULL::text
        END,
        CASE
            WHEN s.status = 'ACTIVE'::text AND s.expire_on < CURRENT_DATE
            THEN 'HET_HAN'::text
            ELSE NULL::text
        END,
        CASE
            -- Còn hạn, đang chạy, mà kỳ tháng này không ra được dòng cước nào.
            -- Nhường chỗ cho THIEU_HOA_DON: đó là bệnh kinh niên, cái này là
            -- chuyện của kỳ trước mắt, bày cả hai trên một dòng chỉ thành nhiễu.
            WHEN s.status = 'ACTIVE'::text
             AND (s.expire_on IS NULL OR s.expire_on >= CURRENT_DATE)
             AND COALESCE(ky_nay.so_dong, 0) = 0
             -- coalesce ra false: thuê bao không có mốc nào thì GREATEST ra
             -- NULL, NOT NULL vẫn là NULL, và nó rơi mất khỏi cả hai cảnh báo.
             AND NOT COALESCE(
                   CURRENT_DATE - GREATEST(hd.ky_gan_nhat_den, don.moc_gan_nhat, s.activated_on)
                   > ((SELECT nguong.an_han FROM nguong)), false)
            THEN 'KHONG_RA_CUOC'::text
            ELSE NULL::text
        END,
        CASE
            WHEN COALESCE(may.may_chua_tra, 0::bigint) > 0 THEN 'MAY_CHUA_TRA'::text
            ELSE NULL::text
        END], NULL::text) AS canh_bao,
    ps.customer_code AS ma_khach,
    COALESCE(hd.chua_toi_han, 0::numeric) AS chua_toi_han,
    COALESCE(don.so_hoa_don_don_hang, 0::bigint) AS hoa_don_don_hang
   FROM subscription_snapshot s
     LEFT JOIN party p ON p.id = s.party_id
     LEFT JOIN party_source ps ON ps.source = 'TELECOM'::source_system AND ps.source_customer_id = s.source_customer_id AND ps.status <> 'REJECTED'::text
     LEFT JOIN hd ON hd.sid = s.source_id
     LEFT JOIN may ON may.sid = s.source_id
     LEFT JOIN don ON don.sid = s.source_id
     LEFT JOIN ky_nay ON ky_nay.sid = s.source_id
  WHERE s.source = 'TELECOM'::source_system;
