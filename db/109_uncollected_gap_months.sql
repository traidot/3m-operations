-- Tháng dịch vụ còn chạy mà sổ cước không thu được đồng nào.
--
-- Sinh ra từ khoảng lệch của 107: từ tháng sau ngày kết thúc thu tới tháng huỷ,
-- khách vẫn dùng dịch vụ nhưng khoảng thu trên hợp đồng đã đóng, nên luật sinh
-- kỳ của mình không đẻ kỳ nào cho quãng đó. Mọi cột tiền trên màn hình cước đều
-- không thấy quãng này — nó nằm ngoài cả "phải thu" lẫn "còn thiếu".
--
-- 157 tháng như vậy, chia theo sổ ghi gì:
--   106 chỉ ghi chú 0 yên — có người đụng vào nhưng không thu
--    41 không có dòng nào   — 82.000 yên, không ai đụng tới
--     8 được miễn
--     2 thu thật 2.000
--
-- Chỉ lấy hợp đồng công ty: đại lý tự thu.

create or replace view v_fixed_ky_hut as
with hd as (
  select c.subscription_id, c.contract_code, c.dia_chi, c.cuoc_thang,
         c.fee_start_on, c.fee_end_on, c.ngay_huy, c.ngay_lap_xong,
         c.ly_do_huy, c.nhom_ly_do_huy
    from v_fixed_contract c
    join v_fixed_contract_owner o using (subscription_id)
   where o.do_cong_ty
     and 'HUY_LECH_KY' = any(c.canh_bao)
     and c.fee_end_on < c.ngay_huy
), ky as (
  select hd.*, to_char(g, 'YYYY-MM') as ky
    from hd cross join lateral generate_series(
           date_trunc('month', hd.fee_end_on) + interval '1 month',
           date_trunc('month', hd.ngay_huy), interval '1 month') g
), so as (
  select f.subscription_source_id as sid, f.period as ky,
         bool_or(f.status = 'APPROVED' and not f.is_free) as co_thu,
         bool_or(f.is_free)                               as co_mien,
         bool_or(f.status = 'PENDING_APPROVAL')           as co_cho,
         bool_or(f.status = 'NOTE_ONLY')                  as co_ghi_chu,
         sum(case when f.status = 'APPROVED' and not f.is_free
                  then f.amount else 0 end)               as tien_thu
    from fee_period_snapshot f
   where f.source = 'FIXED'
   group by f.subscription_source_id, f.period
)
select k.subscription_id, k.contract_code as ma_hop_dong, k.dia_chi, k.ky,
       k.cuoc_thang                                    as tien_le_ra,
       coalesce(so.tien_thu, 0)                        as tien_da_thu,
       k.fee_start_on, k.fee_end_on, k.ngay_lap_xong, k.ngay_huy,
       (k.ngay_huy - k.fee_end_on)::int                as so_ngay_lech,
       k.ly_do_huy, k.nhom_ly_do_huy,
       case when so.co_thu     then 'DA_THU'
            when so.co_mien    then 'MIEN_PHI'
            when so.co_cho     then 'CHO_DUYET'
            when so.co_ghi_chu then 'GHI_CHU'
            else 'KHONG_CO_DONG' end                   as trang_thai_so,
       contract_url(k.subscription_id)                 as link_cms
  from ky k
  left join so on so.sid = k.subscription_id and so.ky = k.ky;

comment on view v_fixed_ky_hut is
  'Tháng wifi cố định còn chạy giữa ngày kết thúc thu và ngày huỷ, kèm sổ cước ghi gì';
