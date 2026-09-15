-- Bỏ nốt kỳ thu trước ngày bắt đầu thu khỏi danh sách.
--
-- Đó là khách đóng sớm: tiền vẫn thuộc đúng hợp đồng, không phải hoàn cũng
-- không phải đòi. Danh sách này để xử lý tiền sai chỗ, giữ lại chỉ làm loãng.
-- Bớt 1 kỳ của HD002495, 1.000 yên.
--
-- Còn đúng hai tình huống, cả hai đều là tiền phải động tới:
--   THU_SAU_HUY        huỷ rồi mà vẫn thu tiếp
--   THU_TRUOC_ROI_HUY  thu gộp xong mới huỷ
-- Hai nhánh CHUA_DAT_COC và THU_TRUOC_LAP giữ trong luật dù hiện không có dòng
-- nào — đó là lỗi thật, mai có thì phải bắt được ngay.

create or replace view v_fixed_thu_ngoai_hop_dong as
select c.subscription_id,
       c.contract_code            as ma_hop_dong,
       c.dia_chi,
       coalesce(o.do_cong_ty, false) as do_cong_ty,
       p.ky,
       p.tien,
       p.thu_luc::date            as ngay_thu,
       p.kenh,
       p.nguoi_nhap,
       c.fee_start_on,
       c.fee_end_on,
       c.ngay_lap_xong,
       c.ngay_huy,
       c.trang_thai_hop_dong,
       case
         when c.cuoc_thang is null or c.cuoc_thang = 0
           or c.fee_start_on is null                                  then 'CHUA_DAT_COC'
         when c.ngay_lap_xong is not null
          and p.ky < to_char(c.ngay_lap_xong, 'YYYY-MM')              then 'THU_TRUOC_LAP'
         when c.fee_end_on is not null
          and p.ky > to_char(c.fee_end_on, 'YYYY-MM')
          and c.ngay_huy is not null
          and p.thu_luc::date > c.ngay_huy                            then 'THU_SAU_HUY'
         when c.fee_end_on is not null
          and p.ky > to_char(c.fee_end_on, 'YYYY-MM')                 then 'THU_TRUOC_ROI_HUY'
       end                        as tinh_huong,
       contract_url(c.subscription_id) as link_cms
  from v_fixed_contract_period p
  join v_fixed_contract c using (subscription_id)
  left join v_fixed_contract_owner o on o.subscription_id = c.subscription_id
 where p.ngoai_ky_tinh
   and coalesce(p.tien, 0) > 0
   and o.do_cong_ty
   -- Kỳ trước ngày bắt đầu thu: khách đóng sớm, tiền vẫn của hợp đồng đó,
   -- không có gì phải hoàn hay đòi. Ví dụ HD002495 bắt đầu thu 01/06 mà có kỳ
   -- T05 — đóng trước một tháng, chuyện bình thường.
   and (c.fee_start_on is null or p.ky >= to_char(c.fee_start_on, 'YYYY-MM'))
   -- Trả trước cho tháng tương lai: vẫn trong khoảng hợp đồng, không phải lỗi.
   and not (c.fee_start_on is not null and coalesce(c.cuoc_thang, 0) > 0
            and p.ky >= to_char(c.fee_start_on, 'YYYY-MM')
            and (c.fee_end_on is null or p.ky <= to_char(c.fee_end_on, 'YYYY-MM'))
            and (c.ngay_lap_xong is null or p.ky >= to_char(c.ngay_lap_xong, 'YYYY-MM')));
