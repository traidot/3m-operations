-- Đối chiếu bảng cước của mình với báo cáo "Thống kê cước phí" bên CMS.
--
-- Luật của CMS, dò ngược từ bản xuất Excel và khớp con số trong ảnh chụp:
--   ngày bắt đầu thu <= cuối tháng
--   và cước/tháng > 0
--   và trạng thái lắp = đã lắp xong
--   và trạng thái hợp đồng = ĐANG HOẠT ĐỘNG  <-- đây là chỗ khác nhau
--
-- Điều kiện cuối đọc trạng thái HÔM NAY chứ không phải trạng thái hồi tháng đó,
-- nên báo cáo CMS XOÁ HỒI TỐ: hợp đồng huỷ tháng 10 thì biến mất khỏi cả tháng
-- 4. Tháng càng lùi về trước càng hụt — tháng 9 chênh 25 hợp đồng, tháng 4
-- chênh 128. Sang năm mở lại tháng 9 sẽ chênh cỡ 128.
--
-- Chênh lệch chia đúng hai nguyên nhân, không còn dư:
--   huy_sau           mình có, CMS mất — hợp đồng đã huỷ sau tháng đó. Tháng 6
--                     có 88 cái, tất cả đều đã huỷ, không sót cái nào.
--   het_han_chua_huy  CMS có, mình bỏ — đã qua ngày kết thúc thu nhưng chưa ai
--                     bấm huỷ nên CMS vẫn đếm.
--
-- Không dùng view này để sửa số của mình. Luật của mình đúng hơn ở ba điểm:
-- xét theo trạng thái TẠI THÁNG ĐÓ, có kiểm mốc kết thúc thu, và bắt buộc lắp
-- xong trước tháng đó. Đây chỉ là chỗ giải thích khi ai đó cầm báo cáo CMS đến.

create or replace view v_fixed_doi_chieu_cms as
with moc as (
  select to_char(g, 'YYYY-MM')                  as ky,
         g::date                                as d1,
         (g + interval '1 month -1 day')::date  as d2
    from generate_series(
           (select date_trunc('month', min(fee_start_on)) from v_fixed_contract
             where fee_start_on is not null),
           date_trunc('month', current_date) + interval '1 month',
           interval '1 month') g
), cms as (
  select m.ky, c.subscription_id, c.cuoc_thang, c.fee_end_on
    from moc m
    join v_fixed_contract c
      on c.fee_start_on <= m.d2
     and c.cuoc_thang > 0
     and c.trang_thai_lap_dat = 'DONE'
     and c.trang_thai_hop_dong = 'ACTIVE'
), minh as (
  select e.ky, e.subscription_id, e.phai_thu, c.trang_thai_hop_dong
    from v_fixed_expected_fee e
    join v_fixed_contract c on c.subscription_id = e.subscription_id
)
select m.ky,
       count(distinct cms.subscription_id)                     as cms_hop_dong,
       round(sum(cms.cuoc_thang))                              as cms_tien,
       (select count(distinct x.subscription_id) from minh x where x.ky = m.ky)
                                                               as minh_hop_dong,
       (select round(sum(x.phai_thu)) from minh x where x.ky = m.ky)
                                                               as minh_tien,
       -- Mình có, CMS mất: đã huỷ sau tháng đó.
       (select count(*) from minh x
         where x.ky = m.ky and x.trang_thai_hop_dong = 'TERMINATED'
           and not exists (select 1 from cms y
                            where y.ky = m.ky and y.subscription_id = x.subscription_id))
                                                               as huy_sau,
       -- Mình có, CMS mất, mà chưa huỷ — nếu có thì luật dò ngược còn sót gì đó.
       (select count(*) from minh x
         where x.ky = m.ky and x.trang_thai_hop_dong <> 'TERMINATED'
           and not exists (select 1 from cms y
                            where y.ky = m.ky and y.subscription_id = x.subscription_id))
                                                               as minh_them_khac,
       -- CMS có, mình bỏ: đã qua ngày kết thúc thu nhưng chưa bấm huỷ.
       count(distinct cms.subscription_id) filter (
         where cms.fee_end_on < m.d1
           and not exists (select 1 from minh x
                            where x.ky = m.ky and x.subscription_id = cms.subscription_id))
                                                               as het_han_chua_huy,
       count(distinct cms.subscription_id) filter (
         where (cms.fee_end_on is null or cms.fee_end_on >= m.d1)
           and not exists (select 1 from minh x
                            where x.ky = m.ky and x.subscription_id = cms.subscription_id))
                                                               as cms_them_khac
  from moc m
  left join cms on cms.ky = m.ky
 group by m.ky, m.d1, m.d2;

comment on view v_fixed_doi_chieu_cms is
  'So bảng cước của mình với luật của báo cáo CMS, và chia chênh lệch theo nguyên nhân';
