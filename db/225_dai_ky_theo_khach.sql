-- Dải 12 tháng theo KHÁCH, gồm cả hoá đơn không gắn thuê bao nào.
--
-- Dải cũ dựng theo thuê bao nên chỉ vẽ được hoá đơn cước. Hoá đơn đơn hàng và
-- phí khác không gắn thuê bao — hiện có 30 hoá đơn đơn hàng tháng 10 chưa thu,
-- 184.118 yên, KHÔNG cái nào gắn thuê bao — nên khách mang cờ "nợ quá hạn" mà
-- dải toàn ô trống, nhìn như hệ bỏ sót.
--
-- Chúng vẫn gắn party_id, nên gom theo khách là vẽ được hết.
--
-- Bỏ REFUND: đó là khoản 3M trả lại khách, không phải khoản đi thu. Để vào thì
-- tháng nào có hoàn tiền cũng hoá thành tháng "đang đòi".
--
-- Thứ tự ưu tiên trong một tháng giống dải thuê bao — xấu nhất thắng, vì một
-- ô chỉ nói được một chuyện và chuyện đáng nói là chuyện tệ nhất.

drop view if exists v_telecom_year_status_khach;

create view v_telecom_year_status_khach as
with nam as (
  select extract(year from current_date)::int as y
),
ky as (
  select i.party_id,
         extract(month from coalesce(i.period_start, i.issued_on))::int as thang,
         case
           when bool_or(i.status = 'UNPAYABLE') then 'MAT'
           when bool_or(i.status = 'ISSUED')    then 'DANG_DOI'
           when bool_or(i.status = 'PAID')      then 'DA_THU'
           else 'NA'
         end as trang_thai,
         -- Gộp loại để chú giải nói được "cước" hay "đơn hàng"; thiếu nó thì
         -- người xem thấy ô đỏ mà không biết đang nợ thứ gì.
         string_agg(distinct i.invoice_type, ', ' order by i.invoice_type) as loai
    from invoice_snapshot i, nam n
   where i.source = 'TELECOM' and i.status <> 'VOID'
     and i.invoice_type <> 'REFUND'
     and i.party_id is not null
     and extract(year from coalesce(i.period_start, i.issued_on)) = n.y
   group by i.party_id, 2
)
select k.party_id,
       (select y from nam)                                   as nam,
       min(x.thang)                                          as tu_thang,
       max(x.thang)                                          as den_thang,
       false                                                 as co_mo_dau,
       false                                                 as co_ket_thuc,
       array_agg(coalesce(x.trang_thai, 'NA') order by m.thang) as cac_ky,
       array_agg(x.loai order by m.thang)                    as cac_loai
  from (select distinct party_id from ky) k
 cross join generate_series(1, 12) m(thang)
  left join ky x on x.party_id = k.party_id and x.thang = m.thang
 group by k.party_id;

comment on view v_telecom_year_status_khach is
  'Dải 12 tháng theo khách — gồm cả hoá đơn không gắn thuê bao, bỏ hoàn tiền';
