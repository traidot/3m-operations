-- Cắt đuôi tháng tương lai ở báo cáo cước theo dịch vụ của wifi cầm tay.
--
-- Cầm tay thu cước TRƯỚC một tháng: mùng 5 và 15 xuất phiếu cho tháng sau. Nên
-- mốc xa nhất có nghĩa là tháng hiện tại + 1. Xa hơn nữa là khách đóng trước
-- nhiều tháng — sổ có dòng tới tận 2027-09 với vài nghìn yên, bày ra thành cái
-- đuôi teo dần, không đọc được nhịp thu của tháng nào cả.
--
-- Số liệu vẫn nằm nguyên trong fee_line_snapshot, chỉ thôi bày. Muốn xem lại
-- thì bỏ mệnh đề WHERE cuối view.

create or replace view v_telecom_month_service as
 WITH ky AS (
         SELECT generate_series(date_trunc('month'::text, (( SELECT min(make_date(fee_line_snapshot.nam, fee_line_snapshot.thang, 1)) AS min
                   FROM fee_line_snapshot
                  WHERE fee_line_snapshot.source = 'TELECOM'::source_system))::timestamp with time zone), date_trunc('month'::text, (( SELECT max(make_date(fee_line_snapshot.nam, fee_line_snapshot.thang, 1)) AS max
                   FROM fee_line_snapshot
                  WHERE fee_line_snapshot.source = 'TELECOM'::source_system))::timestamp with time zone), '1 mon'::interval)::date AS d1
        ), moc AS (
         SELECT ky.d1,
            (ky.d1 + '1 mon -1 days'::interval)::date AS d2,
            to_char(ky.d1::timestamp with time zone, 'YYYY-MM'::text) AS ky
           FROM ky
        ), chay AS (
         SELECT m.ky,
            s.service_type AS dich_vu,
            count(*) AS thue_bao_chay
           FROM moc m
             JOIN subscription_snapshot s ON s.source = 'TELECOM'::source_system AND s.activated_on <= m.d2 AND s.status <> 'PENDING'::text
             JOIN v_telecom_sub_ngung n ON n.subscription_id = s.source_id AND (n.ngung IS NULL OR n.ngung >= m.d1)
          GROUP BY m.ky, s.service_type
        ), dong AS (
         SELECT f.nam,
            f.thang,
            s.service_type AS dich_vu,
            s.source_customer_id,
            f.subscription_source_id,
            i.status,
            f.amount,
                CASE
                    WHEN i.status = 'UNPAYABLE'::text THEN 0::numeric
                    WHEN COALESCE(i.total_amount, 0::numeric) <= 0::numeric THEN 0::numeric
                    ELSE f.amount / i.total_amount * COALESCE(i.paid_amount, 0::numeric)
                END AS da_thu
           FROM fee_line_snapshot f
             JOIN invoice_snapshot i ON i.source = 'TELECOM'::source_system AND i.source_id = f.invoice_source_id AND i.status <> 'VOID'::text
             JOIN subscription_snapshot s ON s.source = 'TELECOM'::source_system AND s.source_id = f.subscription_source_id
          WHERE f.source = 'TELECOM'::source_system
        ), cuoc AS (
         SELECT to_char(make_date(dong.nam, dong.thang, 1)::timestamp with time zone, 'YYYY-MM'::text) AS ky,
            dong.dich_vu,
            count(*) AS so_dong,
            count(DISTINCT dong.subscription_source_id) AS thue_bao_co_cuoc,
            count(DISTINCT dong.source_customer_id) AS so_khach,
            round(sum(dong.amount)) AS phai_thu,
            round(sum(dong.da_thu)) AS da_thu,
            round(sum(
                CASE
                    WHEN dong.status = 'ISSUED'::text THEN GREATEST(dong.amount - dong.da_thu, 0::numeric)
                    ELSE 0::numeric
                END)) AS chua_thu,
            round(sum(
                CASE
                    WHEN dong.status = 'UNPAYABLE'::text THEN dong.amount
                    ELSE 0::numeric
                END)) AS khong_doi_duoc,
            count(DISTINCT dong.source_customer_id) FILTER (WHERE dong.amount > 0::numeric AND dong.status = 'PAID'::text) AS khach_da_thu,
            count(DISTINCT dong.source_customer_id) FILTER (WHERE dong.amount > 0::numeric AND dong.status = 'ISSUED'::text) AS khach_chua_thu,
            round(100.0 * sum(dong.da_thu) / NULLIF(sum(dong.amount), 0::numeric), 1) AS ty_le_thu
           FROM dong
          GROUP BY (to_char(make_date(dong.nam, dong.thang, 1)::timestamp with time zone, 'YYYY-MM'::text)), dong.dich_vu
        )
 SELECT COALESCE(c.ky, h.ky) AS ky,
    COALESCE(c.dich_vu, h.dich_vu) AS dich_vu,
    COALESCE(h.thue_bao_chay, 0::bigint) AS thue_bao_chay,
    COALESCE(c.thue_bao_co_cuoc, 0::bigint) AS thue_bao_co_cuoc,
        CASE
            WHEN COALESCE(c.ky, h.ky) <= to_char(CURRENT_DATE::timestamp with time zone, 'YYYY-MM'::text) THEN COALESCE(h.thue_bao_chay, 0::bigint) - COALESCE(c.thue_bao_co_cuoc, 0::bigint)
            ELSE NULL::bigint
        END AS chenh,
    COALESCE(c.so_dong, 0::bigint) AS so_dong,
    COALESCE(c.so_khach, 0::bigint) AS so_khach,
    COALESCE(c.phai_thu, 0::numeric) AS phai_thu,
    COALESCE(c.da_thu, 0::numeric) AS da_thu,
    COALESCE(c.chua_thu, 0::numeric) AS chua_thu,
    COALESCE(c.khong_doi_duoc, 0::numeric) AS khong_doi_duoc,
    COALESCE(c.khach_da_thu, 0::bigint) AS khach_da_thu,
    COALESCE(c.khach_chua_thu, 0::bigint) AS khach_chua_thu,
    c.ty_le_thu
   FROM cuoc c
     FULL JOIN chay h ON h.ky = c.ky AND h.dich_vu = c.dich_vu
  -- Cầm tay thu cước TRƯỚC một tháng, nên mốc xa nhất có nghĩa là tháng sau.
  -- Cắt ở đây chứ không ở khối ky: phần tiền lấy thẳng từ fee_line_snapshot nên
  -- không đi qua khối đó, cắt trên kia thì tháng tương lai vẫn lọt qua FULL JOIN.
  WHERE COALESCE(c.ky, h.ky)
        <= to_char(date_trunc('month', CURRENT_DATE) + '1 mon'::interval, 'YYYY-MM');
