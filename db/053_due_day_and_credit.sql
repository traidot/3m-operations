-- Áp hạn đóng và tiền cọc vào công nợ wifi cố định.
--
-- Kỳ mới nhất còn có thể phán "nợ" là kỳ đã qua hạn. Hạn của kỳ M là ngày
-- `fixed_due_day` (mùng 10) của tháng M+1, và "sau ngày này mới là không kịp"
-- nên đúng ngày 10 vẫn còn hạn. Tính một lần thành mốc `ky_chot` rồi so chuỗi,
-- nhanh hơn gọi hàm cho từng kỳ của 6.658 hợp đồng.
--
--   hôm nay 14/9 → ky_chot = 2026-08: kỳ tháng 8 tính nợ, tháng 9 chưa tới hạn
--   hôm nay  5/9 → ky_chot = 2026-07: tháng 8 còn hạn tới 10/9

create or replace view v_fixed_ky_chot as
select to_char(
         case when extract(day from current_date) > n.due_day
              then current_date - interval '1 month'
              else current_date - interval '2 months'
         end, 'YYYY-MM') as ky_chot
  from (select value::int as due_day from threshold where key = 'fixed_due_day') n;

create or replace view v_fixed_debt as
select e.subscription_id,
       e.contract_code,
       count(*)                                                    as so_ky,
       count(*) filter (where st.mien_phi)                         as so_ky_mien_phi,
       count(*) filter (where st.ky is null and e.ky <= c.ky_chot) as so_ky_no,
       sum(e.phai_thu) filter (where st.ky is null and e.ky <= c.ky_chot) as con_no,
       coalesce(sum(st.tien_thu), 0::numeric)                      as tong_da_thu,
       -- Kỳ chưa có tiền nhưng cũng chưa tới hạn: không phải nợ, chỉ là chưa đến lượt.
       count(*) filter (where st.ky is null and e.ky > c.ky_chot)  as so_ky_chua_den_han,
       sum(e.phai_thu) filter (where st.ky is null and e.ky > c.ky_chot) as tien_chua_den_han
  from v_fixed_expected_fee e
 cross join v_fixed_ky_chot c
  left join v_fixed_settled_fee st
         on st.subscription_id = e.subscription_id and st.ky = e.ky
 group by e.subscription_id, e.contract_code;
