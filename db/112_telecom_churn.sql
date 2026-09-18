-- Báo cáo huỷ thuê bao wifi cầm tay theo tháng.
--
-- Mốc ngừng lấy từ v_telecom_sub_ngung (066): nguồn không có một cột "ngày
-- huỷ" dùng được cho mọi ca — có cái ghi cancelDate, có cái chỉ hết hạn, có
-- cái phải suy từ kỳ cước cuối cùng.
--
-- Tách theo LOẠI KHÁCH, không gộp một cục. Tháng 3 và 4/2026 có 408 và 437
-- thuê bao cùng ngừng đúng ngày cuối tháng, 726 trong số đó là của ba đại lý —
-- Teki A Duân 623, Tuấn BĐS 62, Trưởng 41. Trộn chung thì tỉ lệ huỷ hai tháng
-- đó vọt lên 26% và 34%, che mất nhịp thật của khách lẻ (6–8%).
--
-- Khách chưa phân loại để nguyên nhóm riêng chứ không nhét vào khách lẻ: đoán
-- hộ nguồn là cách nhanh nhất để sau này không ai tin con số nào.
--
-- Chỉ tính thuê bao có ngày kích hoạt: không có mốc bắt đầu thì không biết nó
-- có nằm trong tập đang chạy đầu tháng hay không, đếm vào là bịa.

drop view if exists v_telecom_huy_thang;
create view v_telecom_huy_thang as
with tb as (
  select s.source_id,
         s.activated_on,
         s.service_type,
         n.ngung,
         coalesce(ps.customer_type, 'CHUA_PHAN_LOAI') as loai_khach
    from subscription_snapshot s
    join v_telecom_sub_ngung n on n.subscription_id = s.source_id
    left join party_source ps on ps.source = 'TELECOM'
      and ps.source_customer_id = s.source_customer_id and ps.status <> 'REJECTED'
   where s.source = 'TELECOM' and s.activated_on is not null
), moc as (
  select g::date as d1, (g + interval '1 month -1 day')::date as d2
    from generate_series(
           (select date_trunc('month', min(activated_on)) from tb),
           date_trunc('month', current_date), interval '1 month') g
)
select to_char(m.d1, 'YYYY-MM')                                        as thang,
       tb.loai_khach,
       count(*) filter (where tb.activated_on < m.d1
                          and (tb.ngung is null or tb.ngung >= m.d1))  as dau_ky,
       count(*) filter (where tb.activated_on between m.d1 and m.d2)   as moi,
       count(*) filter (where tb.ngung between m.d1 and m.d2)          as huy,
       count(*) filter (where tb.activated_on <= m.d2
                          and (tb.ngung is null or tb.ngung > m.d2))   as cuoi_ky,
       -- Tỉ lệ trên tập đầu kỳ, không tính thuê bao mới vào rồi ra ngay trong
       -- tháng: đó là chuyện khác, xem cột "mới".
       round(100.0 * count(*) filter (where tb.ngung between m.d1 and m.d2)
             / nullif(count(*) filter (where tb.activated_on < m.d1
                        and (tb.ngung is null or tb.ngung >= m.d1)), 0), 1) as ty_le_huy,
       m.d2 > current_date                                             as thang_chua_xong
  from moc m
  cross join tb
 group by 1, 2, m.d1, m.d2
having count(*) filter (where tb.activated_on <= m.d2) > 0;

comment on view v_telecom_huy_thang is
  'Thuê bao cầm tay huỷ theo tháng, tách theo loại khách; tỉ lệ tính trên tập đang chạy đầu tháng';

/** Danh sách thuê bao ngừng; p_thang rỗng là lấy mọi tháng, cho tệp Excel. */
create or replace function telecom_huy_danh_sach(p_thang text)
returns table (
  subscription_id text, khach text, ma_khach text, loai_khach text,
  service_type text, goi text, gia_thang numeric,
  ngay_kich_hoat date, ngay_ngung date, so_thang_dung int,
  la_dai_ly boolean, con_no numeric, link_cms text, thang text
) language sql stable as $$
  select s.source_id,
         coalesce(p.display_name, 'khách chưa có tên'),
         ps.customer_code, ps.customer_type,
         s.service_type, s.plan_name, s.monthly_price,
         s.activated_on, n.ngung,
         (extract(year  from age(n.ngung, s.activated_on)) * 12
          + extract(month from age(n.ngung, s.activated_on)))::int,
         coalesce(dl.la_dai_ly, false),
         coalesce(v.con_no, 0),
         telecom_url('thue_bao', s.source_id),
         to_char(n.ngung, 'YYYY-MM')
    from subscription_snapshot s
    join v_telecom_sub_ngung n on n.subscription_id = s.source_id
    left join v_telecom_sub_dai_ly dl on dl.subscription_id = s.source_id
    left join party_source ps on ps.source = 'TELECOM'
      and ps.source_customer_id = s.source_customer_id and ps.status <> 'REJECTED'
    left join party p on p.id = ps.party_id
    left join v_telecom_subscription v on v.subscription_id = s.source_id
   where s.source = 'TELECOM' and s.activated_on is not null
     and n.ngung is not null
     and (p_thang = '' or to_char(n.ngung, 'YYYY-MM') = p_thang)
$$;
