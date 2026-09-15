-- Danh sách kỳ đã thu tiền nhưng nằm ngoài khoảng thu của hợp đồng.
--
-- Cột "sổ CMS ⚠" ở màn hình cước chỉ đếm được bao nhiêu cái; đây là chỗ xem
-- từng cái và mở sang CMS xử lý.
--
-- Chia theo tình huống vì cách xử lý khác hẳn nhau:
--   THU_SAU_HUY        hợp đồng huỷ rồi mà vẫn thu tiếp — thu nhầm, khách đòi được
--   THU_TRUOC_ROI_HUY  thu gộp nhiều tháng xong mới huỷ — tiền thừa, phải hoàn
--   THU_TRUOC_LAP      thu cho tháng máy chưa về nhà khách
--   THU_TRUOC_KY       thu trước ngày bắt đầu thu ghi trên hợp đồng
--   CHUA_DAT_CUOC      hợp đồng chưa điền giá hoặc ngày thu nên không có khoảng nào
--   DAI_LY             hợp đồng của đại lý, mình không quản cước
--
-- Cố ý BỎ trường hợp trả trước cho tháng tương lai: kỳ vẫn nằm trong khoảng
-- hợp đồng, chỉ là xa hơn mốc sinh kỳ của mình (hết tháng sau). 46 kỳ, 92.000
-- yên — bình thường, đưa vào danh sách việc chỉ tổ nhiễu.

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
         when o.do_cong_ty is not true                                then 'DAI_LY'
         when c.cuoc_thang is null or c.cuoc_thang = 0
           or c.fee_start_on is null                                  then 'CHUA_DAT_COC'
         when p.ky < to_char(c.fee_start_on, 'YYYY-MM')               then 'THU_TRUOC_KY'
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
   -- Trả trước cho tháng tương lai: vẫn trong khoảng hợp đồng, không phải lỗi.
   and not (coalesce(o.do_cong_ty, false)
            and c.fee_start_on is not null and coalesce(c.cuoc_thang, 0) > 0
            and p.ky >= to_char(c.fee_start_on, 'YYYY-MM')
            and (c.fee_end_on is null or p.ky <= to_char(c.fee_end_on, 'YYYY-MM'))
            and (c.ngay_lap_xong is null or p.ky >= to_char(c.ngay_lap_xong, 'YYYY-MM')));

comment on view v_fixed_thu_ngoai_hop_dong is
  'Kỳ cước wifi cố định đã thu tiền nhưng nằm ngoài khoảng thu ghi trên hợp đồng';
