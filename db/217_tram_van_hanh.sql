-- Bản đồ trạm: việc đang NẰM ở đâu trên dây chuyền, và trạm đó thoát nhanh hay chậm.
--
-- Khác bảng cảnh báo ở chỗ đo ba thứ chứ không một:
--
--   tồn        — đang nằm bao nhiêu
--   ra mỗi tuần — guồng xử lý được bao nhiêu
--   tuần để dọn — tồn ÷ ra. ĐÂY mới là mức nghẽn.
--
-- Vì sao cần cột thứ ba: 88 phiếu cọc chờ duyệt và 1.259 lần chờ gán hoá đơn
-- nhìn như cùng loại việc, nhưng guồng duyệt cọc chạy 126 phiếu/tuần nên dọn
-- trong nửa tuần, còn máy khách trả về kho chỉ 11 cái/tuần nên 568 máy tồn
-- phải mất hơn năm chục tuần. Xếp hạng theo số tồn là xếp sai.
--
-- Hai điều phải giữ đúng, đã từng sai:
--
-- (1) scheduled_at là NGÀY HẸN LẮP, không phải lúc chốt được lịch — 778/784
--     đơn lắp đúng ngày hẹn. Nên "chờ tới ngày hẹn" và "quá ngày hẹn" là hai
--     trạm khác nhau, chia bằng cách so với hôm nay.
--
-- (2) Bỏ hợp đồng ĐÃ HUỶ. Đơn lắp quá hạn của hợp đồng đã đóng không còn là
--     việc: đếm cả vào thì ra 221 thay vì 23 — phồng gần mười lần.
--
-- Tốc độ ra đo từ 28 ngày gần nhất. Trạm nào nguồn không ghi mốc hoàn thành
-- thì để TRỐNG, không đoán — xem v_tram_van_hanh.ra_moi_tuan is null.
--
-- Có HAI kiểu nghẽn, cần đọc hai cột khác nhau:
--
--   thiếu người  — tồn ÷ ra lớn. Guồng không đủ sức, càng ngày càng dày.
--                  Ví dụ thu hồi máy: 563 tồn, ra 11/tuần, hơn năm chục tuần.
--   bỏ quên      — tồn ÷ ra nhỏ mà tuổi già nhất lớn. Guồng thừa sức nhưng
--                  không làm theo thứ tự. Ví dụ gán hoá đơn: ra 344/tuần nên
--                  dọn trong 3,6 tuần, vậy mà có phiếu nằm 491 ngày.
--
-- Chỉ nhìn một cột thì bỏ sót một kiểu.

drop view if exists v_tram_van_hanh;

create view v_tram_van_hanh as
with cd as (
  -- Hợp đồng cố định của công ty, chưa huỷ, kèm mốc lắp đặt.
  select c.subscription_id, c.contract_code, c.ngay_ky, c.cuoc_thang, c.con_no,
         c.so_ky_no, c.canh_bao, c.fee_start_on,
         o.scheduled_at::date as hen, o.completed_on
    from v_fixed_contract c
    join install_order_snapshot o
      on o.source = 'FIXED' and o.source_id = c.subscription_id
   where c.do_cong_ty and c.trang_thai_hop_dong <> 'TERMINATED'
),
ra as (
  select (select round(count(*)/4.0) from v_fixed_contract
           where do_cong_ty and ngay_lap_xong >= current_date - 28)      as lap_xong,
         (select round(count(*)/4.0) from deposit_allocation_snapshot
           where source='FIXED' and status='APPROVED'
             and approved_at >= current_date - 28)                        as duyet_coc,
         (select round(count(*)/4.0) from stock_move_snapshot
           where source='TELECOM' and doc_type='INVENTORY_IN'
             -- Khách huỷ trả máy về. KHÔNG phải RECEIPT_FOR_CANCELLED_ORDER
             -- (đơn hàng huỷ nhận lại) — mã đó chỉ 2 phiếu trong 28 ngày, lấy
             -- nhầm thì tốc độ ra tụt xuống 1 và số tuần phồng lên vài trăm.
             and reason_type = 'RECEIPT_FOR_CANCELLED_SUBSCRIPTION'
             and doc_date >= current_date - 28)                           as may_ve,
         (select round(count(*)/4.0) from payment_reconcile_snapshot
           where source='TELECOM' and created_at_src >= current_date - 28) as gan_hd
)
select 'co_dinh'::text as he, 'KHAO_SAT'::text as ma, count(*) as ton,
       round(avg(current_date - ngay_ky))::int as tuoi_tb,
       max(current_date - ngay_ky)::int        as gia_nhat,
       -- Đếm bao nhiêu cái quá lâu, KHÔNG dùng cái già nhất: một ngoại lệ duy
       -- nhất nằm 127 ngày cũng kéo cả trạm thành "bỏ quên", gắn cờ đỏ gần
       -- hết bảng thì cờ hết tác dụng.
       count(*) filter (where current_date - ngay_ky > 90)::int as qua_lau,
       null::numeric                           as tien,
       -- Rời trạm này bằng cách được chốt lịch, mà nguồn không ghi lúc chốt.
       -- Lấy tốc độ lắp xong làm thước: đơn chốt được lịch rồi gần như lắp
       -- đúng hẹn, nên guồng lắp chính là chỗ thắt.
       (select lap_xong from ra)               as ra_moi_tuan
  from cd where completed_on is null and hen is null

union all
select 'co_dinh', 'CHO_HEN', count(*),
       round(avg(hen - current_date))::int, max(hen - current_date)::int,
       0, null, (select lap_xong from ra)
  from cd where completed_on is null and hen > current_date

union all
select 'co_dinh', 'QUA_HEN', count(*),
       round(avg(current_date - hen))::int, max(current_date - hen)::int,
       count(*) filter (where current_date - hen > 90)::int,
       null, (select lap_xong from ra)
  from cd where completed_on is null and hen <= current_date

union all
select 'co_dinh', 'CHUA_BAT_THU', count(*),
       round(avg(current_date - completed_on))::int,
       max(current_date - completed_on)::int,
       count(*) filter (where current_date - completed_on > 90)::int,
       nullif(sum(cuoc_thang), 0), null
  from cd where completed_on is not null and fee_start_on is null

union all
select 'co_dinh', 'THIEU_GIA', count(*),
       round(avg(current_date - ngay_ky))::int, max(current_date - ngay_ky)::int,
       count(*) filter (where current_date - ngay_ky > 90)::int,
       null, null
  from cd where 'THIEU_GIA_CUOC' = any(canh_bao)

union all
select 'co_dinh', 'CHO_DUYET_COC', count(*),
       round(avg(d.cho_ngay))::int, max(d.cho_ngay)::int,
       count(*) filter (where d.cho_ngay > 90)::int,
       nullif(sum(d.tien), 0), (select duyet_coc from ra)
  from v_fixed_coc_cho_phan_bo d
  left join v_fixed_contract c on c.contract_code = d.ma_hd
 where coalesce(c.do_cong_ty, true)

union all
select 'co_dinh', 'DANG_NO', count(*), null, null, null,
       nullif(sum(con_no), 0), null
  from cd where so_ky_no > 0

union all
select 'cam_tay', 'CHO_GAN_HD', count(*),
       round(avg(so_ngay_treo))::int, max(so_ngay_treo)::int,
       count(*) filter (where so_ngay_treo > 90)::int,
       nullif(sum(amount), 0), (select gan_hd from ra)
  from v_telecom_thu_chua_can_tru
 where coalesce(loai_khach, '') <> 'AGENCY'

union all
select 'cam_tay', 'CHO_THU_MAY', count(*),
       round(avg(current_date - s.terminated_on))::int,
       max(current_date - s.terminated_on)::int,
       count(*) filter (where current_date - s.terminated_on > 90)::int,
       nullif(sum(m.coc), 0), (select may_ve from ra)
  from v_telecom_may m
  join subscription_snapshot s
    on s.source = 'TELECOM' and s.source_id = m.thue_bao_hien_tai
 where m.ngay_tra is null and m.trang_thai = 'RENTING'
   and m.trang_thai_thue_bao = 'TERMINATED' and not m.khong_thu_hoi
   and s.terminated_on is not null and s.terminated_on <= current_date
   and coalesce(m.nhom_khach, '') not like '%ĐẠI LÝ%'

union all
select 'cam_tay', 'NO_CAM_TAY', count(*),
       round(avg(qua_han_lau_nhat))::int, max(qua_han_lau_nhat)::int,
       count(*) filter (where qua_han_lau_nhat > 90)::int,
       nullif(sum(no), 0), null
  from v_telecom_thue_bao_no
 where coalesce(loai_khach, '') <> 'AGENCY' and no > 0;

comment on view v_tram_van_hanh is
  'Việc đang nằm ở trạm nào trên dây chuyền: tồn, tuổi, và tốc độ ra mỗi tuần — ra_moi_tuan rỗng nghĩa là nguồn không ghi mốc để đo';
