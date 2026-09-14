-- Trừ tiền cọc vào công nợ, và chốt lại thế nào là "quá hạn".
--
-- HAI THAY ĐỔI
--
-- 1. Cọc chờ duyệt. Phiếu GMO đã duyệt thì bên nguồn sinh dòng cước nên kho đã
--    đếm; phiếu CHỜ DUYỆT thì tiền đã vào tài khoản mà kỳ cước vẫn bị coi là
--    chưa thu. Đó là tiền của khách đang bị mình xếp vào danh sách đi đòi.
--
-- 2. Hạn đóng. Trước đây kỳ nào không có dòng cước là tính nợ ngay, kể cả
--    tháng đang chạy — hôm nay mùng 1 thì cả tháng này đã thành nợ. Quy tắc
--    thật của 3M: khách đóng trước dùng sau, hạn của kỳ M là ngày `due_day`
--    của tháng M+1. Wifi cố định lấy mùng 10. Ví dụ hôm nay 14/9: kỳ tháng 8
--    hết hạn 10/9 nên tính nợ; kỳ tháng 9 hạn 10/10 nên chưa.

insert into threshold (key, value, unit, note) values
  ('fixed_due_day', 10, 'ngày',
   'Wifi cố định: kỳ tháng M phải đóng xong trước ngày này của tháng M+1')
on conflict (key) do update set value = excluded.value, note = excluded.note;

/** Hạn đóng của một kỳ: ngày `due_day` của tháng kế tiếp. */
create or replace function fixed_fee_due_date(p_ky text)
returns date language sql stable as $$
  select (to_date(p_ky, 'YYYY-MM')
          + interval '1 month'
          + ((select value::int from threshold where key = 'fixed_due_day') - 1)
            * interval '1 day')::date;
$$;

/** Tiền cọc còn chờ duyệt, đã chỉ rõ gán vào tháng nào. */
create or replace view v_fixed_deposit_period as
select da.subscription_source_id          as subscription_id,
       a->>'month'                        as ky,
       sum((a->>'amount')::numeric)       as tien
  from deposit_allocation_snapshot da
 cross join lateral jsonb_array_elements(da.allocations) a
 where da.source = 'FIXED' and da.status = 'PENDING'
 group by 1, 2;

/** Tiền cọc đã nhận mà chưa gán vào tháng nào — không trừ được vào kỳ cụ thể. */
create or replace view v_fixed_deposit_loose as
select subscription_source_id   as subscription_id,
       sum(amount)              as tien,
       count(*)                 as so_phieu
  from deposit_allocation_snapshot
 where source = 'FIXED' and status = 'PENDING'
   and jsonb_array_length(allocations) = 0
 group by 1;

/** Tổng cọc chờ duyệt của một hợp đồng, cả có gán lẫn chưa gán tháng. */
create or replace view v_fixed_deposit as
select subscription_source_id             as subscription_id,
       sum(amount)                        as coc_cho_duyet,
       count(*)                           as so_phieu_cho,
       min(paid_at)                       as nop_som_nhat
  from deposit_allocation_snapshot
 where source = 'FIXED' and status = 'PENDING'
 group by 1;
