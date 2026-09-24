-- "Tổng tiền đã thu" của Báo cáo thống kê cước phí, dựng lại đúng bản CMS mới.
--
-- Báo cáo đó KHÔNG đo tiền thực nhận. Nó đo cước phải thu đã hoàn thành, nên:
--   - Cap theo cước tháng: khách trả dư hay nộp gộp thì phần vượt không được
--     tính vào tháng đó (code: `amount >= monthlyFee` thì chỉ cộng monthlyFee).
--   - Trục là KỲ CƯỚC (paymentMonth), không phải ngày tiền về.
--   - Không chia được theo tài khoản thu, vì cap diễn ra ở mức (hợp đồng, kỳ).
-- Vì vậy đừng đặt nó cạnh sao kê ngân hàng để soát tiền; chỗ của nó là đối
-- chiếu với Báo cáo tài khoản thu theo kỳ cước.
--
-- Bản CMS mới tin thẳng bảng ĐỢT chứ không tin dòng cha ("dòng cha chỉ là
-- CACHE của tổng các đợt đã duyệt"), nên ở đây cũng cộng từ đợt APPROVED.
-- Không cap khi phiếu là "tùy chỉnh số tiền thu" hoặc hợp đồng không có cước
-- tháng — mirror đúng hai nhánh nới trong code.
--
-- Kiểm chứng 2026: T1..T10 cộng lại ra 5.096.003, khớp từng đồng ô "Tổng tiền
-- đã thu" trên màn hình.

create or replace view v_fixed_da_thu_cuoc as
with dot as (
  select i.contract_id,
         i.ky,
         sum(i.amount) filter (where i.status = 'APPROVED')   as da_duyet,
         bool_or(coalesce(fp.tuy_chinh, false))               as tuy_chinh
    from fixed_fee_installment i
    left join fee_period_snapshot fp
      on fp.source = 'FIXED' and fp.source_id = i.fee_period_id
   where i.source = 'FIXED' and i.amount > 0
   group by 1, 2
  union all
  -- Phiếu tất toán tay không sinh đợt nào: tiền ghi thẳng trên dòng cha.
  select fp.subscription_source_id, fp.period, fp.amount, true
    from fee_period_snapshot fp
   where fp.source = 'FIXED'
     and coalesce(fp.tuy_chinh, false)
     and fp.amount > 0
     and not coalesce(fp.is_free, false)
     and not exists (select 1 from fixed_fee_installment i
                      where i.source = 'FIXED' and i.fee_period_id = fp.source_id)
)
select d.contract_id,
       hd.contract_code                       as ma_hd,
       d.ky,
       d.da_duyet                             as tien_dot_da_duyet,
       coalesce(s.monthly_price, 0)           as cuoc_thang,
       case
         when coalesce(s.monthly_price, 0) > 0 and not d.tuy_chinh
           then least(d.da_duyet, s.monthly_price)
         else d.da_duyet
       end                                    as da_thu
  from dot d
  left join subscription_snapshot s
    on s.source = 'FIXED' and s.source_id = d.contract_id
  left join v_fixed_contract hd on hd.subscription_id = d.contract_id
 where coalesce(d.da_duyet, 0) > 0;

comment on view v_fixed_da_thu_cuoc is
  'Đã thu theo Báo cáo thống kê cước phí: cap theo cước tháng, trục kỳ cước, không chia theo tài khoản';
