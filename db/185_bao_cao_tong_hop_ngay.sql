-- "Báo cáo tổng hợp" của CMS, nhưng vỡ ra theo NGÀY.
--
-- Bản trên CMS (/report/contracts) gom theo tháng: tới ngày 20 mới biết tháng
-- này hỏng ở khâu nào thì đã muộn. Cùng bộ chỉ số, cùng luật phân loại, chỉ
-- đổi trục thành ngày.
--
-- Luật phân loại chép đúng theo getMonthlySummaryDaily bên CMS
-- (wifi-api/src/services/cms/contract/workflows/contract-cms-report.workflow.ts).
-- Ba chỗ dễ đọc nhầm nếu suy từ tên cột:
--
--  1. Ngày của một hợp đồng là entryDate (ngày vào sổ), KHÔNG phải ngày lắp
--     hay ngày huỷ. Nên một hợp đồng ký hôm nay rồi huỷ sau ba tháng vẫn nằm
--     ở dòng hôm nay — mỗi dòng là số phận của lứa hợp đồng ký ngày đó.
--  2. "Có lịch lắp" KHÔNG tính hợp đồng đã lắp xong, chỉ gồm lắp thất bại và
--     có lịch mà chưa lắp. Cộng lap_xong vào đó là ra số to hơn CMS.
--  3. Huỷ sau khi có lịch tách làm hai theo đã lắp xong hay chưa; mọi mốc huỷ
--     khác (kể cả không ghi mốc) tính là huỷ trước khi có lịch.
--
-- Đã đối chiếu từng ô với bảng CMS, 10 tháng của 2026, khớp tuyệt đối.

create or replace view v_bao_cao_tong_hop_ngay as
with ngay as (
  select generate_series(current_date - 29, current_date, interval '1 day')::date as ngay
),
hd as (
  select io.signed_on                        as ngay,
         coalesce(s.is_renewal, false)       as dang_ky_lai,
         s.status = 'TERMINATED'             as huy,
         s.cancel_timing                     as moc_huy,
         io.status                           as lap,
         io.scheduled_at is not null         as co_lich
    from install_order_snapshot io
    join subscription_snapshot s
      on s.source = io.source and s.source_id = io.source_id
   where io.source = 'FIXED'
     and io.signed_on >= current_date - 29
),
-- Chưa huỷ thì xếp vào đúng một ô theo tình trạng lắp.
cho as (
  select h.*,
         not h.huy and h.lap = 'DONE'                                as xong,
         not h.huy and h.lap = 'FAILED'                              as that_bai,
         not h.huy and h.lap not in ('DONE', 'FAILED') and h.co_lich as cho_lap,
         not h.huy and h.lap not in ('DONE', 'FAILED') and not h.co_lich as chua_hen
    from hd h
)
select n.ngay,
       count(c.*) filter (where not c.dang_ky_lai)                   as lan_dau,
       count(c.*) filter (where c.dang_ky_lai)                       as dang_ky_lai,
       count(c.*)                                                    as tong_dang_ky,
       count(c.*) filter (where c.huy and c.moc_huy is distinct from 'AFTER_SCHEDULE')
                                                                     as huy_truoc_lich,
       count(c.*) filter (where c.huy and c.moc_huy = 'AFTER_SCHEDULE' and c.lap <> 'DONE')
                                                                     as huy_sau_lich,
       count(c.*) filter (where c.huy and c.moc_huy = 'AFTER_SCHEDULE' and c.lap = 'DONE')
                                                                     as huy_sau_lap,
       count(c.*) filter (where c.huy)                               as tong_huy,
       count(c.*) filter (where not c.huy)                           as con_lai,
       count(c.*) filter (where c.that_bai or c.cho_lap)             as co_lich_lap,
       count(c.*) filter (where c.chua_hen)                          as chua_co_lich,
       count(c.*) filter (where c.xong)                              as lap_xong,
       count(c.*) filter (where c.cho_lap)                           as co_lich_chua_lap,
       count(c.*) filter (where c.that_bai)                          as that_bai
  from ngay n
  left join cho c on c.ngay = n.ngay
 group by n.ngay;

comment on view v_bao_cao_tong_hop_ngay is
  'Báo cáo tổng hợp của CMS (/report/contracts) vỡ theo ngày, 30 ngày gần nhất';
