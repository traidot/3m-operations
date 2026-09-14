-- Cờ "đang chạy mà không có hoá đơn" phải tính cả hoá đơn đến qua đơn hàng.
--
-- Gói SIM năm thu một lần: hoá đơn mang loại ORDER, gắn orderId, subscriptionId
-- để trống. Quy tắc cũ chỉ tìm theo subscriptionId nên không thấy gì.
-- Ví dụ thuê bao 1968: hoá đơn HD30883 phủ kỳ 06/12/2025–30/11/2026, đã trả đủ
-- 8.005, mà màn hình vẫn kêu "không có hoá đơn".
--
-- Đo lại thì cờ này chạy từ 235 lên 309, gồm hai chiều ngược nhau:
--   −17  hết báo oan, đúng nhóm có hoá đơn đơn hàng còn hiệu lực
--   +91  trước đây bị NULL nuốt: thuê bao vừa không có hoá đơn cước vừa không
--        có ngày kích hoạt thì cả biểu thức ra NULL, so sánh ra NULL, không
--        bao giờ báo. 210 thuê bao đang chạy thiếu ngày kích hoạt.
--
-- Liên kết qua đơn hàng chỉ dùng để lấy MỐC THỜI GIAN, không cộng tiền: 39 đơn
-- hàng sinh nhiều thuê bao, cộng vào là một hoá đơn bị đếm mấy lần.

create or replace view v_telecom_subscription as
WITH don AS (
         -- Hoá đơn loại ORDER gắn vào đơn hàng, không gắn thuê bao. Gói SIM năm
         -- và gói trả trước thu một lần kiểu này. Chỉ lấy MỐC THỜI GIAN để biết
         -- thuê bao có chứng cứ thu tiền hay chưa — không cộng tiền, vì 39 đơn
         -- sinh nhiều thuê bao thì cộng là đếm trùng.
         SELECT sub.source_id AS sid,
                count(*) AS so_hoa_don_don_hang,
                max(coalesce(i.period_end, i.issued_on)) AS moc_gan_nhat
           FROM subscription_snapshot sub
           JOIN invoice_snapshot i
             ON i.source = 'TELECOM' AND i.order_id = sub.order_ref
            AND i.status <> 'VOID'
          WHERE sub.source = 'TELECOM' AND sub.order_ref IS NOT NULL
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
            -- Đo từ mốc GẦN NHẤT mà mình biết có chuyện gì đó xảy ra: kỳ cước
            -- cuối, hoá đơn đơn hàng, hoặc ngày kích hoạt. GREATEST bỏ qua NULL
            -- nên chỉ cần cả ba cùng rỗng mới không đo được — luật cũ dùng
            -- COALESCE nên 91 thuê bao thiếu ngày kích hoạt bị NULL nuốt mất,
            -- không bao giờ báo.
            WHEN s.status = 'ACTIVE'::text
             AND CURRENT_DATE - GREATEST(hd.ky_gan_nhat_den, don.moc_gan_nhat, s.activated_on)
                 > ((SELECT nguong.an_han FROM nguong))
            THEN 'THIEU_HOA_DON'::text
            ELSE NULL::text
        END,
        CASE
            WHEN s.status = 'ACTIVE'::text AND (s.monthly_price IS NULL OR s.monthly_price = 0::numeric) THEN 'THIEU_GIA'::text
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
  WHERE s.source = 'TELECOM'::source_system;
