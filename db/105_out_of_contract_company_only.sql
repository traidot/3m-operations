-- Bỏ hợp đồng của đại lý khỏi danh sách thu ngoài hợp đồng.
--
-- Đại lý tự thu, mình không quản cước của họ — đã chốt ở 087 cho wifi cố định
-- và 097 cho cầm tay. Để một nhóm "hợp đồng của đại lý" trong danh sách việc
-- phải xử lý là đi ngược luật đó: nhìn thấy nhưng không làm gì được, chỉ tổ
-- chiếm chỗ. Bớt 2 kỳ của HH000025, 4.000 yên.

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
   and o.do_cong_ty
   -- Trả trước cho tháng tương lai: vẫn trong khoảng hợp đồng, không phải lỗi.
   and not (c.fee_start_on is not null and coalesce(c.cuoc_thang, 0) > 0
            and p.ky >= to_char(c.fee_start_on, 'YYYY-MM')
            and (c.fee_end_on is null or p.ky <= to_char(c.fee_end_on, 'YYYY-MM'))
            and (c.ngay_lap_xong is null or p.ky >= to_char(c.ngay_lap_xong, 'YYYY-MM')));
