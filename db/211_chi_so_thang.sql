-- Bốn con số của tháng, cho thẻ đầu màn Hôm nay.
--
-- Chỉ hợp đồng CỦA CÔNG TY. Khác biệt không nhỏ: tháng này 212 hợp đồng huỷ
-- thì 189 là của đại lý, phần của mình chỉ 23. Bảng /thang không lọc nên con
-- số bên đó lớn hơn — hai nơi trả lời hai câu khác nhau, không phải lệch.
--
-- Tiền thì không cần lọc vì đại lý không có đợt thu nào chạy qua tài khoản
-- 3M, nhưng vẫn lọc cho cùng một luật, phòng khi sau này có.
--
-- "Chưa thu" đếm theo KỲ CƯỚC của tháng đó (tháng đáng lẽ phải thu), còn
-- doanh thu đếm theo NGÀY TIỀN VỀ. Hai trục khác nhau nên hai số này không
-- cộng trừ được với nhau.
--
-- Thu hồi thiết bị: CMS có sẵn bốn bảng (devices, device_loans,
-- device_loan_status_histories, device_deposits) nhưng cả bốn đều rỗng, và
-- contracts chỉ có equipmentShippedDate — ngày gửi đi, không có ngày nhận về.
-- Nên không có cột nào ở đây; màn hình nói thẳng là nguồn chưa ghi nhận thay
-- vì hiện số 0 trông như đã thu hồi hết.

create or replace view v_fixed_chi_so_thang as
with thang as (
  select generate_series(
           date_trunc('month', current_date) - interval '11 months',
           date_trunc('month', current_date),
           interval '1 month')::date as dau_thang
),
cty as (
  select subscription_id from v_fixed_contract_owner where do_cong_ty
)
select to_char(t.dau_thang, 'YYYY-MM')                                as ky,
       -- Doanh thu: tiền thật về trong tháng, bất kể của kỳ nào.
       coalesce((select sum(i.amount) from fixed_fee_installment i
                  where i.source = 'FIXED' and i.amount > 0
                    and i.contract_id in (select subscription_id from cty)
                    and date_trunc('month', i.paid_at)::date = t.dau_thang), 0)
                                                                      as doanh_thu,
       (select count(*) from v_fixed_contract c
         where c.subscription_id in (select subscription_id from cty)
           and date_trunc('month', c.ngay_huy)::date = t.dau_thang)   as huy,
       (select count(*) from v_fixed_contract c
         where c.subscription_id in (select subscription_id from cty)
           and date_trunc('month', c.ngay_ky)::date = t.dau_thang)    as ky_moi,
       -- Chưa thu: kỳ cước CỦA tháng đó mà tới giờ vẫn chưa ai chốt.
       coalesce((select sum(e.phai_thu) from v_fixed_expected_fee e
                  left join v_fixed_settled_fee s
                    on s.subscription_id = e.subscription_id and s.ky = e.ky
                 where e.subscription_id in (select subscription_id from cty)
                   and e.ky = to_char(t.dau_thang, 'YYYY-MM')
                   and s.ky is null), 0)                              as tien_chua_thu,
       (select count(*) from v_fixed_expected_fee e
         left join v_fixed_settled_fee s
           on s.subscription_id = e.subscription_id and s.ky = e.ky
        where e.subscription_id in (select subscription_id from cty)
          and e.ky = to_char(t.dau_thang, 'YYYY-MM')
          and s.ky is null)                                           as ky_chua_thu
  from thang t;

comment on view v_fixed_chi_so_thang is
  'Doanh thu, huỷ, hợp đồng mới và cước chưa thu theo tháng — chỉ hợp đồng của công ty';

-- Tháng này so với CÙNG SỐ NGÀY ĐẦU của tháng trước.
--
-- So với cả tháng trước là so lệch: mùng 3 thì mới có ba ngày, nhìn vào đâu
-- cũng thấy sụt. Cắt tháng trước đúng tới ngày thứ N mới so được.
create or replace view v_fixed_thang_nay as
with moc as (
  select date_trunc('month', current_date)::date                        as dau_thang,
         current_date                                                   as den,
         (current_date - date_trunc('month', current_date)::date + 1)    as ngay_da_qua,
         (date_trunc('month', current_date) - interval '1 month')::date  as dau_truoc
),
cty as (select subscription_id from v_fixed_contract_owner where do_cong_ty)
select m.ngay_da_qua,
       to_char(m.dau_thang, 'YYYY-MM')                                   as ky,
       t.doanh_thu, t.huy, t.ky_moi, t.tien_chua_thu, t.ky_chua_thu,
       -- Cùng kỳ tháng trước: từ mùng 1 tới ngày thứ N của tháng đó. Dùng
       -- least() để tháng trước ngắn hơn (28, 30 ngày) không bị tràn sang
       -- tháng sau.
       coalesce((select sum(i.amount) from fixed_fee_installment i
                  where i.source = 'FIXED' and i.amount > 0
                    and i.contract_id in (select subscription_id from cty)
                    and i.paid_at::date >= m.dau_truoc
                    and i.paid_at::date <= least(
                          m.dau_truoc + (m.ngay_da_qua - 1),
                          (m.dau_truoc + interval '1 month' - interval '1 day')::date)), 0)
                                                                         as doanh_thu_cung_ky,
       (select count(*) from v_fixed_contract c
         where c.subscription_id in (select subscription_id from cty)
           and c.ngay_huy >= m.dau_truoc
           and c.ngay_huy <= least(
                 m.dau_truoc + (m.ngay_da_qua - 1),
                 (m.dau_truoc + interval '1 month' - interval '1 day')::date))
                                                                         as huy_cung_ky
  from moc m
  join v_fixed_chi_so_thang t on t.ky = to_char(m.dau_thang, 'YYYY-MM');

comment on view v_fixed_thang_nay is
  'Chỉ số tháng đang chạy, kèm cùng số ngày đầu của tháng trước để so cho công bằng';
