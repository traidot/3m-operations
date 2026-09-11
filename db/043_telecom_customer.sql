-- Danh sách thuê bao coi mỗi thuê bao là một dòng, nên một khách dùng nhiều
-- dịch vụ hiện ra nhiều lần và không ai biết tổng nợ của người đó là bao
-- nhiêu. Đòi tiền là đòi một người, không đòi một thuê bao.
--
-- Số liệu cho thấy phải tách hai mức thật: 1.703 khách có đúng một thuê bao,
-- nhưng có party giữ 802 thuê bao, cái khác 180 và 104 — đó là tài khoản CTV
-- hoặc đại lý chứ không phải khách lẻ.

drop view if exists v_telecom_customer;
create view v_telecom_customer as
-- Gom cảnh báo ở CTE riêng: bung mảng ngay trong FROM sẽ nhân đôi dòng và làm
-- sai mọi phép đếm, phép cộng bên dưới.
with cb as (
  select s.party_id, array_agg(distinct u.cb) as canh_bao
    from v_telecom_subscription s, unnest(s.canh_bao) as u(cb)
   where s.party_id is not null
   group by 1
)
select
  p.id                                                            as party_id,
  coalesce(p.display_name, 'khách chưa có tên')                   as khach,
  p.phone_norm                                                    as dien_thoai,
  count(*)                                                        as so_thue_bao,
  count(*) filter (where s.trang_thai = 'ACTIVE')                 as dang_chay,
  array_agg(distinct s.service_type) filter (where s.service_type is not null) as dich_vu,
  round(sum(s.da_thu))                                            as da_thu,
  round(sum(s.con_no))                                            as con_no,
  round(sum(s.tien_mat))                                          as tien_mat,
  sum(s.may_chua_tra)                                             as may_chua_tra,
  max(s.ngay_qua_han)                                             as ngay_qua_han,
  max(s.ky_gan_nhat_den)                                          as ky_gan_nhat_den,
  coalesce(cb.canh_bao, '{}')                                     as canh_bao
from v_telecom_subscription s
join party p on p.id = s.party_id
left join cb on cb.party_id = p.id
group by p.id, p.display_name, p.phone_norm, cb.canh_bao;

/** Thuê bao của một khách, cho ngăn kéo. */
drop view if exists v_telecom_customer_sub;
create view v_telecom_customer_sub as
select party_id, subscription_id, service_type, goi, trang_thai, gia_thang,
       ngay_kich_hoat, ngay_ngung, ma_may, so_hoa_don, da_thu, con_no, tien_mat,
       ky_gan_nhat_den, ngay_qua_han, canh_bao
from v_telecom_subscription;
