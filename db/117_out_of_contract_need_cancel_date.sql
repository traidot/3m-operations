-- Hợp đồng không có ngày huỷ thì không kết luận được tiền thu là sai chỗ.
--
-- Nhánh "thu trước rồi mới huỷ" của 103 không kiểm ngay_huy nên gán cả cho hợp
-- đồng chưa có ngày huỷ. HH000006 dính đúng cái đó: trạng thái CANCELLED nhưng
-- cancelDate và lineCancellationDate đều trống, thu 150 yên ngày 01/04 sau khi
-- kết thúc thu 31/03 — bị gọi là "thu trước rồi mới huỷ" trong khi không ai
-- biết nó huỷ lúc nào.
--
-- Cả kho có 45 hợp đồng đã huỷ mà không có ngày huỷ. Với chúng, thu sau ngày
-- kết thúc thu có thể hoàn toàn hợp lệ vì dịch vụ còn chạy tới lúc huỷ thật.
-- Bỏ ra khỏi danh sách việc chứ không đoán.
--
-- Nhân tiện loại luôn kỳ được đánh dấu tuỳ chỉnh hoặc không thu: đó là quyết
-- định có chủ ý bên CMS, không phải tiền sai chỗ.
--
-- Danh sách còn 9 kỳ, tất cả đều có ngày huỷ rõ ràng.

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
          and p.ky > to_char(c.fee_end_on, 'YYYY-MM')
          and c.ngay_huy is not null                                  then 'THU_TRUOC_ROI_HUY'
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
   -- Phải biết ngày huỷ mới kết luận được tiền thu là trước hay sau khi dịch
   -- vụ dừng. 45 hợp đồng trong kho ở trạng thái đã huỷ mà cancelDate lẫn
   -- lineCancellationDate đều trống — với chúng thì không đủ căn cứ để gọi là
   -- thu nhầm, bỏ ra khỏi danh sách việc thay vì đoán.
   and c.ngay_huy is not null
   -- Kỳ bên CMS đã bật "tuỳ chỉnh số tiền thu" hay "không thu cước" là quyết
   -- định có chủ ý, không phải tiền sai chỗ. Xem db/114.
   and not p.tuy_chinh
   and not p.khong_thu
   -- Trả trước cho tháng tương lai: vẫn trong khoảng hợp đồng, không phải lỗi.
   and not (c.fee_start_on is not null and coalesce(c.cuoc_thang, 0) > 0
            and p.ky >= to_char(c.fee_start_on, 'YYYY-MM')
            and (c.fee_end_on is null or p.ky <= to_char(c.fee_end_on, 'YYYY-MM'))
            and (c.ngay_lap_xong is null or p.ky >= to_char(c.ngay_lap_xong, 'YYYY-MM')));
