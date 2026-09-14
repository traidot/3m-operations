-- Đưa hạn đóng và tiền cọc xuống mức từng kỳ, để ngăn kéo hợp đồng nói được
-- vì sao một tháng chưa có tiền: đã quá hạn thật, hay chỉ là chưa tới lượt, hay
-- tiền đã nộp rồi mà còn nằm chờ duyệt.
--
-- Trạng thái kỳ giữ nguyên bộ cũ. Tiền cọc đi thành cột số riêng chứ không đẻ
-- thêm một trạng thái nữa — báo cáo tháng đang đếm theo trạng thái, thêm giá
-- trị mới vào đó là lặng lẽ đổi mọi con số tổng.

create or replace view v_fixed_contract_period as
WITH so AS (
         SELECT fee_period_snapshot.subscription_source_id AS subscription_id,
            fee_period_snapshot.period AS ky,
            bool_or(fee_period_snapshot.status = 'APPROVED'::text AND fee_period_snapshot.is_free) AS co_mien_phi,
            bool_or(fee_period_snapshot.status = 'APPROVED'::text AND NOT fee_period_snapshot.is_free) AS co_duyet,
            bool_or(fee_period_snapshot.status = 'PENDING_APPROVAL'::text) AS co_cho_duyet,
            bool_or(fee_period_snapshot.status = 'NOTE_ONLY'::text) AS co_ghi_chu,
            sum(
                CASE
                    WHEN fee_period_snapshot.status = 'APPROVED'::text AND NOT fee_period_snapshot.is_free THEN fee_period_snapshot.amount
                    ELSE 0::numeric
                END) AS tien,
            max(fee_period_snapshot.paid_at) AS thu_luc,
            max(fee_period_snapshot.channel) AS kenh,
            max(fee_period_snapshot.created_by_src) AS nguoi_nhap_id
           FROM fee_period_snapshot
          WHERE fee_period_snapshot.source = 'FIXED'::source_system
          GROUP BY fee_period_snapshot.subscription_source_id, fee_period_snapshot.period
        )
 SELECT COALESCE(e.subscription_id, so.subscription_id) AS subscription_id,
    COALESCE(e.ky, so.ky) AS ky,
    e.phai_thu,
        CASE
            WHEN so.co_mien_phi THEN 'MIEN_PHI'::text
            WHEN so.co_duyet THEN 'DA_THU'::text
            WHEN so.co_cho_duyet THEN 'CHO_DUYET'::text
            WHEN so.co_ghi_chu THEN 'GHI_CHU'::text
            ELSE 'NO'::text
        END AS trang_thai,
    e.ky IS NULL AS ngoai_ky_tinh,
    so.tien,
    so.thu_luc,
    so.kenh,
    COALESCE(nv.display_name, so.nguoi_nhap_id) AS nguoi_nhap,
    e.ky IS NOT NULL AND e.ky <= c.ky_chot AS qua_han,
    COALESCE(dp.tien, 0::numeric) AS coc_cho_duyet
   FROM v_fixed_expected_fee e
     FULL JOIN so ON so.subscription_id = e.subscription_id AND so.ky = e.ky
     LEFT JOIN staff_snapshot nv ON nv.source = 'FIXED'::source_system AND nv.source_id = so.nguoi_nhap_id
     CROSS JOIN v_fixed_ky_chot c
     LEFT JOIN v_fixed_deposit_period dp
            ON dp.subscription_id = COALESCE(e.subscription_id, so.subscription_id)
           AND dp.ky = COALESCE(e.ky, so.ky);
