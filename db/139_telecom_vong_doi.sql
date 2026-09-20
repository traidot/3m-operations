-- Vòng đời một cái máy: nhập kho → cho thuê → ra cước → thu tiền → huỷ và đòi
-- máy về. Năm khâu đó là toàn bộ nghiệp vụ wifi cầm tay, và mỗi khâu rò một
-- kiểu khác nhau, nên cần nhìn liền mạch thay vì mở năm màn hình.
--
-- Bốn khâu đầu đã có v_kho_ma đếm theo MÁY. Khâu thu tiền và khâu huỷ thì đơn
-- vị là THUÊ BAO chứ không phải máy — một thuê bao nợ tiền chứ cái máy không
-- nợ. View này bù đúng chỗ đó.

create or replace view v_telecom_thue_bao_no as
with hd as (
  select subscription_source_id as sid,
         count(*) filter (where status = 'ISSUED')                   as so_hd_doi,
         coalesce(sum(total_amount) filter (where status = 'ISSUED'), 0)     as no,
         coalesce(sum(total_amount) filter (where status = 'UNPAYABLE'), 0)  as bo_thu,
         count(*) filter (where status = 'UNPAYABLE')                as so_hd_bo,
         coalesce(sum(total_amount) filter (where status = 'PAID'), 0)       as da_thu,
         max(current_date - due_on) filter (where status = 'ISSUED') as qua_han_lau_nhat
    from invoice_snapshot
   where source = 'TELECOM' and subscription_source_id is not null
   group by 1
)
select s.source_id                                as subscription_id,
       s.status                                   as trang_thai,
       s.plan_name                                as goi,
       s.monthly_price                            as gia_thang,
       s.activated_on                             as ngay_kich_hoat,
       s.terminated_on                            as ngay_ngung,
       coalesce(p.display_name, 'khách chưa có tên') as khach,
       ps.customer_code                           as ma_khach,
       ps.customer_type                           as loai_khach,
       coalesce(hd.so_hd_doi, 0)                  as so_hd_doi,
       coalesce(hd.no, 0)                         as no,
       coalesce(hd.so_hd_bo, 0)                   as so_hd_bo,
       coalesce(hd.bo_thu, 0)                     as bo_thu,
       coalesce(hd.da_thu, 0)                     as da_thu,
       hd.qua_han_lau_nhat,
       -- Máy đang gắn, để biết huỷ rồi thì có phải đi đòi không.
       (select count(*) from subscription_device_snapshot sd
         where sd.source = 'TELECOM' and sd.subscription_source_id = s.source_id) as so_may,
       telecom_url('thue_bao', s.source_id)       as link_cms
  from subscription_snapshot s
  left join hd on hd.sid = s.source_id
  left join party_source ps
    on ps.source = 'TELECOM' and ps.source_customer_id = s.source_customer_id
   and ps.status <> 'REJECTED'
  left join party p on p.id = ps.party_id
 where s.source = 'TELECOM';

comment on view v_telecom_thue_bao_no is
  'Một dòng một thuê bao cầm tay, kèm nợ, tiền bỏ thu và số máy đang gắn';
