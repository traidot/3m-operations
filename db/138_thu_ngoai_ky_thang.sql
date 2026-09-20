-- Tổng tháng bỏ sót tiền thu cho kỳ nằm ngoài khoảng tính cước.
--
-- v_fixed_monthly_billing đi từ v_fixed_expected_fee — tức là từ những kỳ ĐÁNG
-- LẼ phải thu. Tiền thu cho kỳ không nằm trong tập đó thì không có chỗ nào để
-- rơi vào, nên tổng tháng không thấy. Trong khi bảng kỳ của từng hợp đồng
-- (v_fixed_contract_period) lại có. Hai màn hình đọc lệch nhau 129.150 yên.
--
-- Tách ra làm gì chứ không nhét vào `da_thu`: phần lớn số này là thu TRƯỚC.
--   124.000  62 dòng, kỳ 2026-11 → 2027-02 — khách trả trước, hợp lệ
--     5.150   4 dòng, kỳ đã qua            — đây mới là chỗ đáng nghi
-- Cộng thẳng vào đã thu thì tỉ lệ thu của tháng này bị tiền tháng sau kéo lên.

create or replace view v_fixed_thu_ngoai_ky as
select ky,
       count(*)                                     as so_dong,
       count(distinct subscription_id)              as so_hop_dong,
       round(sum(tien))                             as tien,
       ky > to_char(CURRENT_DATE, 'YYYY-MM')        as la_thu_truoc
  from v_fixed_contract_period
 where ngoai_ky_tinh and coalesce(tien, 0) > 0
 group by ky;

comment on view v_fixed_thu_ngoai_ky is
  'Tiền đã thu cho kỳ nằm ngoài khoảng tính cước, tách theo kỳ — tổng tháng không tính số này';

/** Tổng tháng, kèm phần thu ngoài kỳ để cộng lại là đủ mọi đồng đã thu. */
create or replace view v_fixed_monthly_total as
select b.ky,
       sum(b.so_hop_dong)                              as so_hop_dong,
       sum(b.phai_thu)                                 as phai_thu,
       sum(b.tien_mien_phi)                            as tien_mien_phi,
       sum(b.da_thu)                                   as da_thu,
       sum(b.con_thieu)                                as con_thieu,
       round(100.0 * sum(b.da_thu)
             / nullif(sum(b.phai_thu) - coalesce(sum(b.tien_mien_phi), 0), 0), 1) as ty_le_thu,
       sum(b.thu_thieu)                                as thu_thieu,
       sum(b.cho_duyet)                                as cho_duyet,
       sum(b.ghi_chu)                                  as ghi_chu,
       sum(b.giam_tru)                                 as giam_tru,
       coalesce(n.tien, 0)                             as thu_ngoai_ky,
       coalesce(n.so_dong, 0)                          as so_dong_ngoai_ky,
       coalesce(n.la_thu_truoc, false)                 as ngoai_ky_la_thu_truoc
  from v_fixed_monthly_billing b
  left join v_fixed_thu_ngoai_ky n on n.ky = b.ky
 group by b.ky, n.tien, n.so_dong, n.la_thu_truoc;
