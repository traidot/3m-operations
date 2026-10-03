-- Hàng đợi việc phải làm, một dòng một việc — không phải báo cáo để đọc.
--
-- Khác mọi màn khác ở chỗ: mỗi dòng phải ĐÓNG ĐƯỢC. Có mã để tra, có tên để
-- nhận ra, có tuổi để biết cái nào gấp, có link sang CMS để làm ngay, và có
-- tên người nếu nguồn ghi. Con số tổng ở đây vô dụng — người ta cần danh sách.
--
-- Ba luật:
--
-- (1) Chỉ việc QUÁ NGƯỠNG. Phiếu mới nộp hôm qua không phải việc tồn, nó đang
--     được xử lý bình thường. Ngưỡng để ở bảng threshold cho sửa được.
--
-- (2) Bỏ đại lý. Việc của đại lý không phải việc của 3M.
--
-- (3) Một hợp đồng có thể nằm ở NHIỀU hàng đợi cùng lúc (vừa thiếu giá cước
--     vừa chưa bật thu). Đó là đúng — hai việc khác nhau — nên đừng cộng số
--     dòng của các hàng đợi lại để ra "tổng số hợp đồng có vấn đề".
--
-- Đòi nợ cố ý KHÔNG có ở đây: màn /thu-cuoc đã là hàng đợi đòi nợ đầy đủ hơn.

insert into threshold (key, value, unit, note) values
  ('goi_lai_khao_sat_ngay', 7, 'ngày',
   'Ký xong quá ngần này ngày mà chưa chốt được lịch lắp thì phải gọi khách'),
  ('bat_thu_cuoc_ngay', 3, 'ngày',
   'Lắp xong quá ngần này ngày thì phải có ngày bắt đầu thu'),
  ('duyet_phieu_coc_ngay', 7, 'ngày',
   'Phiếu cọc chờ quá ngần này ngày là bị bỏ quên — trung bình duyệt hết 1,5 ngày'),
  ('gan_hoa_don_ngay', 7, 'ngày',
   'Tiền đã về mà quá ngần này ngày chưa gán được vào hoá đơn nào'),
  ('thu_hoi_may_ngay', 14, 'ngày',
   'Thuê bao ngừng quá ngần này ngày mà máy vẫn chưa về kho')
on conflict (key) do nothing;

drop view if exists v_viec_hom_nay;

create view v_viec_hom_nay as
with n as (
  select (select value::int from threshold where key = 'goi_lai_khao_sat_ngay') goi_lai,
         (select value::int from threshold where key = 'bat_thu_cuoc_ngay')     bat_thu,
         (select value::int from threshold where key = 'duyet_phieu_coc_ngay')  duyet_coc,
         (select value::int from threshold where key = 'gan_hoa_don_ngay')      gan_hd,
         (select value::int from threshold where key = 'thu_hoi_may_ngay')      thu_may
)

-- 1 · Gọi lại khách: ký rồi mà chưa chốt được lịch lắp.
--
-- Đây là chỗ rò to nhất của dây chuyền cố định: 28 ngày gần nhất có 104 hợp
-- đồng chết trước khi lắp, lý do số một là không liên lạc được, và trung bình
-- 49 ngày sau khi ký mới chịu kết luận. Gọi ở ngày thứ 7 thì còn cứu được.
select 'co_dinh'::text                    as he,
       'GOI_LAI'::text                    as viec,
       o.source_id                        as id,
       c.contract_code                    as ma,
       o.address                          as ai,
       (current_date - o.signed_on)::int  as tuoi_ngay,
       null::numeric                      as tien,
       c.nguoi_nhap                       as nguoi,
       contract_url(o.source_id)          as url
  from install_order_snapshot o
  join v_fixed_contract c on c.subscription_id = o.source_id
 cross join n
 where o.source = 'FIXED' and c.do_cong_ty
   and o.completed_on is null and o.scheduled_at is null
   and c.trang_thai_hop_dong <> 'TERMINATED'
   and o.signed_on is not null
   and current_date - o.signed_on > n.goi_lai

union all
-- 2 · Bật thu cước: máy đã chạy ở nhà khách mà sổ chưa thu đồng nào.
select 'co_dinh', 'BAT_THU_CUOC', d.subscription_id, d.ma_hd, d.dia_chi,
       d.sau_lap_ngay::int, d.cuoc_thang, d.nguoi_nhap, d.url
  from v_fixed_chua_hoat_dong d
  left join v_fixed_contract c on c.subscription_id = d.subscription_id
 cross join n
 where coalesce(c.do_cong_ty, true) and d.sau_lap_ngay > n.bat_thu

union all
-- 3 · Điền giá cước: hợp đồng đang chạy mà không có giá nên không sinh kỳ nào.
-- Bao luôn nhóm thiếu ngày bắt đầu thu — cả 15 hợp đồng đó cũng thiếu giá.
select 'co_dinh', 'DIEN_GIA_CUOC', c.subscription_id, c.contract_code, c.dia_chi,
       (current_date - c.ngay_ky)::int, null, c.nguoi_nhap,
       contract_url(c.subscription_id)
  from v_fixed_contract c
 where c.do_cong_ty and 'THIEU_GIA_CUOC' = any(c.canh_bao)

union all
-- 4 · Duyệt phiếu cọc: tiền đã vào tài khoản, nợ của khách chưa được trừ.
select 'co_dinh', 'DUYET_COC', d.source_id, d.ma_hd, d.dia_chi,
       d.cho_ngay::int, d.tien, null, d.url
  from v_fixed_coc_cho_phan_bo d
  left join v_fixed_contract c on c.contract_code = d.ma_hd
 cross join n
 where coalesce(c.do_cong_ty, true) and d.cho_ngay > n.duyet_coc

union all
-- 5 · Gán hoá đơn: tiền khách trả đã về mà chưa biết là của hoá đơn nào.
select 'cam_tay', 'GAN_HOA_DON', t.payment_id::text, t.ma_khach, t.khach,
       t.so_ngay_treo::int, t.amount, null, t.link_cms
  from v_telecom_thu_chua_can_tru t
 cross join n
 where t.so_ngay_treo > n.gan_hd
   and coalesce(t.loai_khach, '') <> 'AGENCY'

union all
-- 6 · Thu hồi máy: thuê bao đã ngừng mà máy vẫn ở ngoài.
--
-- Bỏ máy đã đánh dấu không thu hồi — đó là quyết định đã ra, không phải việc
-- đang chờ. Tuổi tính từ ngày thuê bao ngừng, không phải ngày thuê máy.
select 'cam_tay', 'THU_HOI_MAY', m.imei, m.imei, m.khach,
       (current_date - s.terminated_on)::int, m.coc, null, m.link_cms
  from v_telecom_may m
  join subscription_snapshot s
    on s.source = 'TELECOM' and s.source_id = m.thue_bao_hien_tai
 cross join n
 where m.ngay_tra is null and m.trang_thai = 'RENTING'
   and m.trang_thai_thue_bao = 'TERMINATED' and not m.khong_thu_hoi
   and s.terminated_on is not null and s.terminated_on <= current_date
   and current_date - s.terminated_on > n.thu_may
   and coalesce(m.nhom_khach, '') not like '%ĐẠI LÝ%';

comment on view v_viec_hom_nay is
  'Hàng đợi việc phải làm, một dòng một việc, đã quá ngưỡng chờ — không gồm đại lý';
