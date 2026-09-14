-- Thuê bao đã huỷ mà không ghi ngày huỷ thì vẫn phải có ngày ngừng.
--
-- Bản 081 chỉ suy ngày ngừng khi có ngày huỷ hoặc ngày hết hạn đã qua. Thuê bao
-- TERMINATED mà cả hai đều trống (hoặc hạn còn xa) thì ra NULL = "chưa ngừng",
-- tức bị tính là đang dùng mãi. Ví dụ 3992: đã huỷ, kích hoạt 06/08/2026, chưa
-- từng có cước, mà vẫn nằm trong nhóm "đang dùng, chưa có phiếu thu" tháng 9.
--
-- Đã huỷ mà không có ngày huỷ: ngừng ở ngày cuối kỳ cước cuối cùng, chưa từng có
-- cước thì ngừng ở ngày kích hoạt — và không muộn hơn ngày hết hạn nếu có.

create or replace view v_telecom_sub_ngung as
with fe as (
  select f.subscription_source_id as sid,
         max(coalesce(f.end_on,
                      (make_date(f.nam, f.thang, 1) + interval '1 month - 1 day')::date)) as het_cuoc
    from fee_line_snapshot f
    join invoice_snapshot i
      on i.source = 'TELECOM' and i.source_id = f.invoice_source_id and i.status <> 'VOID'
   where f.source = 'TELECOM'
   group by 1
)
select s.source_id as subscription_id,
       fe.het_cuoc,
       case when s.cancel_on is not null
              then least(s.cancel_on, greatest(s.expire_on, fe.het_cuoc))
            when s.status = 'TERMINATED'
              then least(s.expire_on, coalesce(fe.het_cuoc, s.activated_on))
            when s.expire_on < current_date
              then greatest(s.expire_on, fe.het_cuoc)
       end as ngung
  from subscription_snapshot s
  left join fe on fe.sid = s.source_id
 where s.source = 'TELECOM';
