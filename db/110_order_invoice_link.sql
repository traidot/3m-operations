-- Hoá đơn "không gắn thuê bao" phần lớn là gắn qua ĐƠN HÀNG.
--
-- CMS xuất hoá đơn gói thu một lần (SIM năm, gói trả trước) theo đơn hàng chứ
-- không theo thuê bao, nên subscriptionId để trống còn orderId thì có. Đối
-- chiếu orderId với orderRef của thuê bao:
--   3.203 hoá đơn ra đúng một thuê bao
--      45 ra nhiều thuê bao (một đơn sinh nhiều thuê bao, cao nhất 100)
--     649 không ra thuê bao nào — đây mới thật sự là thu lẻ
--
-- Nhãn cũ gọi cả 3.298 cái là "không gắn thuê bao" nên người đọc tưởng không
-- biết tiền của ai, trong khi 98,6% có chủ rõ ràng.
--
-- Chỉ thêm cột, không đổi cách tính tiền: 073 đã chốt là nối qua đơn hàng chỉ
-- để lấy mốc thời gian, không cộng tiền, vì một đơn nhiều thuê bao thì cộng
-- vào là đếm trùng.

create or replace view v_telecom_invoice as
 SELECT i.subscription_source_id AS subscription_id,
    i.source_id AS invoice_id,
    i.number AS so_hoa_don,
    i.issued_on AS ngay_lap,
    d.han_tra,
    i.period_start AS ky_tu,
    i.period_end AS ky_den,
    i.total_amount AS tien,
    i.paid_amount AS da_tra,
    i.total_amount - i.paid_amount AS con_lai,
    i.status AS trang_thai,
    ( SELECT string_agg(DISTINCT pm.channel, ', '::text) AS string_agg
           FROM payment_snapshot pm
          WHERE pm.source = 'TELECOM'::source_system AND pm.invoice_source_id = i.source_id) AS kenh_thu,
    CURRENT_DATE > d.han_tra AND NOT d.la_hoan_tien AS qua_han,
    telecom_url('hoa_don'::text, i.source_id) AS link_cms,
    i.party_id,
    i.invoice_type AS loai,
    -- Hoá đơn loại ORDER không điền subscriptionId, nhưng orderId của nó khớp
    -- orderRef của thuê bao. 3.253/3.298 cái nối được về đúng thuê bao — gọi
    -- chúng là "không gắn thuê bao" là sai, chỉ là gắn qua đơn hàng.
    don.so_thue_bao,
    don.thue_bao_don
   FROM invoice_snapshot i
     LEFT JOIN LATERAL (
       SELECT count(*)::int AS so_thue_bao,
              CASE WHEN count(*) = 1 THEN min(s.source_id) END AS thue_bao_don
         FROM subscription_snapshot s
        WHERE s.source = 'TELECOM'::source_system
          AND i.order_id IS NOT NULL AND s.order_ref = i.order_id
     ) don ON true
     JOIN v_telecom_invoice_due d ON d.source_id = i.source_id
  WHERE i.source = 'TELECOM'::source_system;
