-- Tiền chưa gán hoá đơn không phải một kênh thu.
--
-- Nó đang nằm trong dãy kênh cạnh tiền mặt, GMO, SBI, Yucho nên bị cộng vào
-- tổng lần thứ hai: tiền đã về qua một kênh rồi, chưa gán hoá đơn là tính chất
-- của khoản tiền đó chứ không phải chỗ tiền đi vào. Ngày 13/10 hai khoản chưa
-- gán 5.250 và 4.292 đều là YOUCHO_ARAI và đã nằm trong cột Yucho, nên tổng
-- hiện 145.570 trong khi thật ra là 136.028, và 48 đợt trong khi thật ra 46.
--
-- Thay bằng cách chẻ đôi chính cột tiền: tien_duyet giờ là phần đã cấn vào hoá
-- đơn, để bảng đọc thành "đã cấn / tổng về". Nhận "đã cấn" đúng như
-- v_telecom_thu_chua_can_tru: phải có dòng đối soát trỏ tới hoá đơn còn tồn
-- tại, hoá đơn bị xoá thì không tính là đã cấn.

create or replace view v_telecom_ngay_28 as
WITH ngay AS (
         SELECT generate_series((CURRENT_DATE - 27)::timestamp with time zone, CURRENT_DATE::timestamp with time zone, '1 day'::interval)::date AS ngay
        ), su_kien AS (
         SELECT 'tien'::text AS nhom,
            kenh_thu_chuan(p.channel) AS chi_so,
            'yên'::text AS don_vi,
            1 AS thu_tu,
            p.paid_at::date AS ngay,
            p.amount AS tien
           FROM payment_snapshot p
          WHERE p.source = 'TELECOM'::source_system AND p.amount > 0::numeric
        UNION ALL
         SELECT 'hoa_don'::text,
            'Phát hành'::text,
            'hoá đơn'::text,
            1,
            i.issued_on,
            i.total_amount
           FROM invoice_snapshot i
          WHERE i.source = 'TELECOM'::source_system
        UNION ALL
         SELECT 'thue_bao'::text,
            'Kích hoạt mới'::text,
            'thuê bao'::text,
            1,
            s.activated_on,
            0
           FROM subscription_snapshot s
          WHERE s.source = 'TELECOM'::source_system AND s.activated_on IS NOT NULL
        UNION ALL
         SELECT 'thue_bao'::text,
            'Ngừng'::text,
            'thuê bao'::text,
            2,
            s.terminated_on,
            0
           FROM subscription_snapshot s
          WHERE s.source = 'TELECOM'::source_system AND s.terminated_on IS NOT NULL AND s.terminated_on <= CURRENT_DATE
        UNION ALL
         SELECT 'kho_ra'::text,
            kho_ly_do(k_1.reason_type) AS kho_ly_do,
            'máy'::text,
                CASE k_1.reason_type
                    WHEN 'ISSUE_FOR_ORDER'::text THEN 1
                    WHEN 'ISSUE_FOR_SOFTWARE_RECONCILE'::text THEN 2
                    WHEN 'ISSUE_FOR_PRODUCT_CONVERSION'::text THEN 3
                    ELSE 4
                END AS "case",
            k_1.doc_date,
            0
           FROM stock_move_snapshot k_1
          WHERE k_1.source = 'TELECOM'::source_system AND k_1.doc_type = 'INVENTORY_OUT'::text
        UNION ALL
         SELECT 'kho_vao'::text,
            kho_ly_do(k_1.reason_type) AS kho_ly_do,
            'máy'::text,
                CASE k_1.reason_type
                    WHEN 'RECEIPT_FOR_CANCELLED_SUBSCRIPTION'::text THEN 1
                    WHEN 'RECEIPT_FOR_FIXED_WIFI_LOAN'::text THEN 2
                    WHEN 'RECEIPT_FOR_PURCHASE'::text THEN 3
                    WHEN 'RECEIPT_FOR_PRODUCT_CONVERSION'::text THEN 4
                    ELSE 5
                END AS "case",
            k_1.doc_date,
            0
           FROM stock_move_snapshot k_1
          WHERE k_1.source = 'TELECOM'::source_system AND k_1.doc_type = 'INVENTORY_IN'::text
        ), da_can AS (
         SELECT p.paid_at::date AS ngay,
            kenh_thu_chuan(p.channel) AS chi_so,
            sum(p.amount) AS tien
           FROM payment_snapshot p
          WHERE p.source = 'TELECOM'::source_system AND p.amount > 0::numeric
            AND (EXISTS ( SELECT 1
               FROM payment_reconcile_snapshot r
                 JOIN invoice_snapshot i ON i.source = 'TELECOM'::source_system AND i.source_id = r.invoice_source_id
              WHERE r.source = 'TELECOM'::source_system AND r.payment_source_id = p.source_id))
          GROUP BY (p.paid_at::date), (kenh_thu_chuan(p.channel))
        ), khung AS (
         SELECT DISTINCT e_1.nhom,
            e_1.chi_so,
            e_1.don_vi,
            e_1.thu_tu,
            n.ngay
           FROM su_kien e_1
             CROSS JOIN ngay n
          WHERE e_1.ngay >= (CURRENT_DATE - 89)
        )
 SELECT k.nhom,
    k.chi_so,
    k.don_vi,
    k.ngay,
    count(e.*) AS so_luong,
    COALESCE(sum(e.tien), 0::numeric) AS tien,
    COALESCE(sum(e.tien), 0::numeric) AS tien_that,
    k.thu_tu,
        CASE
            WHEN k.nhom = 'tien'::text THEN COALESCE(max(c.tien), 0::numeric)
            ELSE COALESCE(sum(e.tien), 0::numeric)
        END AS tien_duyet
   FROM khung k
     LEFT JOIN su_kien e ON e.nhom = k.nhom AND e.chi_so = k.chi_so AND e.ngay = k.ngay
     LEFT JOIN da_can c ON c.ngay = k.ngay AND c.chi_so = k.chi_so
  GROUP BY k.nhom, k.chi_so, k.don_vi, k.ngay, k.thu_tu;
