-- Danh sách đơn đang chờ lắp theo nhóm thời gian chờ, cho ngăn kéo.
--
-- Cùng cách chia nhóm với v_fixed_install_pending — sửa mốc thì phải sửa cả hai,
-- nên để chung một hàm tính nhóm.

create or replace function fixed_install_nhom_cho(p_ngay int)
returns text language sql immutable as $$
  select case when p_ngay <= 7  then '1'
              when p_ngay <= 30 then '2'
              when p_ngay <= 60 then '3'
              else '4' end;
$$;

create or replace function fixed_install_pending_list(p_nhom text)
returns table (
  subscription_id text, ma_hop_dong text, dia_chi text, do_cong_ty boolean,
  nguoi_tao text, trang_thai_lap_dat text, trang_thai_hop_dong text,
  ngay_ky date, ngay_lap_xong date, ngay_huy date, so_ngay_cho int,
  ly_do_huy text, nhom_ly_do_huy text, tinh_huong text, link_cms text
) language sql stable as $$
  select c.subscription_id, c.contract_code, c.dia_chi, c.do_cong_ty,
         c.nguoi_nhap, c.trang_thai_lap_dat, c.trang_thai_hop_dong,
         c.ngay_ky, c.ngay_lap_xong, c.ngay_huy,
         (current_date - c.ngay_ky)::int,
         c.ly_do_huy, c.nhom_ly_do_huy, 'CHO_LAP',
         contract_url(c.subscription_id)
    from v_fixed_contract c
   where c.trang_thai_lap_dat = 'SURVEY'
     and c.trang_thai_hop_dong <> 'TERMINATED'
     and c.ngay_ky is not null
     and (p_nhom = '' or fixed_install_nhom_cho((current_date - c.ngay_ky)::int) = p_nhom)
$$;
