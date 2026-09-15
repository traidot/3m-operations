-- Sinh kỳ cước tới hết tháng sau, không dừng ở tháng hiện tại.
--
-- 3M thu trước: ngay trong tháng 9 sổ cước đã có 89 hợp đồng đóng tiền cho kỳ
-- tháng 10, và CMS cũng bày tháng 10. Bảng của mình cắt ở current_date nên
-- tháng 10 biến mất, nhìn như chưa ai thu gì.
--
-- Không ảnh hưởng công nợ: kỳ tháng M chỉ thành nợ sau mùng 10 tháng M+1
-- (migration 053), nên kỳ tháng sau luôn nằm trong nhóm "chưa tới hạn".

create or replace view v_fixed_expected_fee as
select s.source,
       s.source_id                     as subscription_id,
       s.source_customer_id            as contract_code,
       to_char(thang.thang, 'YYYY-MM') as ky,
       s.monthly_price                 as phai_thu
  from subscription_snapshot s
  join install_order_snapshot o on o.source = 'FIXED' and o.source_id = s.source_id
  join v_fixed_sub_owner w on w.subscription_id = s.source_id and w.do_cong_ty
 cross join lateral generate_series(
        date_trunc('month', s.fee_start_on::timestamptz),
        date_trunc('month', least(coalesce(s.fee_end_on, current_date + interval '1 month'),
                                  current_date + interval '1 month')::timestamptz),
        '1 mon'::interval) thang(thang)
 where s.source = 'FIXED' and o.status = 'DONE'
   and s.fee_start_on is not null and s.monthly_price > 0;
