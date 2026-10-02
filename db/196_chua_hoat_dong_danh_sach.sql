-- Danh sách hợp đồng chưa hoạt động, để mở từ màn hình Hôm nay.
--
-- Chỉ hợp đồng của công ty: hợp đồng đại lý không phải việc của bên mình.
--
-- Hai nhóm tách bằng chính dữ liệu, không bằng phỏng đoán: có ghi lý do là
-- đang chờ thật, không ghi gì là không ai biết nó đợi điều gì. Nhóm sau mới là
-- việc phải làm, và nó càng cũ càng đáng ngờ — tiền đã lắp xong mà chưa thu
-- được đồng nào.

create or replace view v_fixed_chua_hoat_dong as
select c.subscription_id,
       c.contract_code                        as ma_hd,
       c.dia_chi,
       c.cuoc_thang,
       c.ngay_lap_xong,
       (current_date - c.ngay_lap_xong)       as sau_lap_ngay,
       c.fee_start_on                         as ngay_bat_dau_thu,
       c.ly_do_chua_lap_xong                  as ly_do,
       c.nguoi_nhap,
       contract_url(c.subscription_id)        as url
  from v_fixed_contract c
  join v_fixed_contract_owner o using (subscription_id)
 where o.do_cong_ty and c.trang_thai_van_hanh = 'CHUA_HOAT_DONG';

comment on view v_fixed_chua_hoat_dong is
  'Hợp đồng của công ty đã lắp xong nhưng chưa tới ngày bắt đầu thu';
