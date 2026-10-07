-- Từng việc đang nằm ở mỗi trạm — danh sách đằng sau mỗi con số của bản đồ.
--
-- Bảng trạm được tính LẠI TỪ view này (xem cuối file) chứ không đếm riêng một
-- đường. Hai câu đếm song song thì sớm muộn cũng lệch, và lúc đó không biết
-- tin bên nào: con số trên bảng hay số dòng trong ngăn kéo.
--
-- `tuoi_ngay` mang nghĩa khác nhau tuỳ trạm — phần lớn là "đã chờ bao lâu",
-- riêng CHO_HEN là "còn mấy ngày nữa tới hẹn". Nhãn cột để bên web đặt.

-- v_tram_van_hanh dựng TỪ view này nên phải bỏ trước; chạy lại file mà không
-- có dòng đó thì drop bị chặn và phần create phía dưới báo "đã tồn tại".
drop view if exists v_tram_van_hanh;
drop view if exists v_tram_chi_tiet;

create view v_tram_chi_tiet as
with cd as (
  select c.subscription_id, c.contract_code, c.dia_chi, c.ngay_ky, c.cuoc_thang,
         c.con_no, c.so_ky_no, c.canh_bao, c.fee_start_on, c.nguoi_nhap,
         o.scheduled_at::date as hen, o.completed_on
    from v_fixed_contract c
    join install_order_snapshot o
      on o.source = 'FIXED' and o.source_id = c.subscription_id
   where c.do_cong_ty and c.trang_thai_hop_dong <> 'TERMINATED'
)
select 'co_dinh'::text                     as he,
       'KHAO_SAT'::text                    as tram,
       subscription_id                     as id,
       contract_code                       as ma,
       dia_chi                             as ai,
       (current_date - ngay_ky)::int       as tuoi_ngay,
       null::numeric                       as tien,
       nguoi_nhap                          as nguoi,
       contract_url(subscription_id)       as url
  from cd where completed_on is null and hen is null

union all
select 'co_dinh', 'CHO_HEN', subscription_id, contract_code, dia_chi,
       (hen - current_date)::int, null, nguoi_nhap, contract_url(subscription_id)
  from cd where completed_on is null and hen > current_date

union all
select 'co_dinh', 'QUA_HEN', subscription_id, contract_code, dia_chi,
       (current_date - hen)::int, null, nguoi_nhap, contract_url(subscription_id)
  from cd where completed_on is null and hen <= current_date

union all
select 'co_dinh', 'CHUA_BAT_THU', subscription_id, contract_code, dia_chi,
       (current_date - completed_on)::int, cuoc_thang, nguoi_nhap,
       contract_url(subscription_id)
  from cd where completed_on is not null and fee_start_on is null

union all
select 'co_dinh', 'THIEU_GIA', subscription_id, contract_code, dia_chi,
       (current_date - ngay_ky)::int, null, nguoi_nhap, contract_url(subscription_id)
  from cd where 'THIEU_GIA_CUOC' = any(canh_bao)

union all
select 'co_dinh', 'CHO_DUYET_COC', d.source_id, d.ma_hd, d.dia_chi,
       d.cho_ngay::int, d.tien, null, d.url
  from v_fixed_coc_cho_phan_bo d
  left join v_fixed_contract c on c.contract_code = d.ma_hd
 where coalesce(c.do_cong_ty, true)

union all
select 'co_dinh', 'DANG_NO', subscription_id, contract_code, dia_chi,
       null, con_no, nguoi_nhap, contract_url(subscription_id)
  from cd where so_ky_no > 0

union all
select 'cam_tay', 'CHO_GAN_HD', payment_id::text, ma_khach, khach,
       so_ngay_treo::int, amount, null, link_cms
  from v_telecom_thu_chua_can_tru
 where coalesce(loai_khach, '') <> 'AGENCY'

union all
select 'cam_tay', 'NO_CAM_TAY', subscription_id, ma_khach, khach,
       qua_han_lau_nhat::int, no, null, link_cms
  from v_telecom_thue_bao_no
 where coalesce(loai_khach, '') <> 'AGENCY' and no > 0

union all
select 'cam_tay', 'CHO_THU_MAY', m.imei, m.imei, m.khach,
       (current_date - s.terminated_on)::int, m.coc, null, m.link_cms
  from v_telecom_may m
  join subscription_snapshot s
    on s.source = 'TELECOM' and s.source_id = m.thue_bao_hien_tai
 where m.ngay_tra is null and m.trang_thai = 'RENTING'
   and m.trang_thai_thue_bao = 'TERMINATED' and not m.khong_thu_hoi
   and s.terminated_on is not null and s.terminated_on <= current_date
   and coalesce(m.nhom_khach, '') not like '%ĐẠI LÝ%';

comment on view v_tram_chi_tiet is
  'Từng việc đang nằm ở mỗi trạm — nguồn gốc của cả bảng trạm lẫn ngăn kéo';

-- Bảng trạm, gom từ chính danh sách trên. Chỉ `ra_moi_tuan` là đo riêng, vì
-- tốc độ thoát không suy được từ cái đang còn nằm lại.
drop view if exists v_tram_van_hanh;

create view v_tram_van_hanh as
with ra as (
  select (select round(count(*)/4.0) from v_fixed_contract
           where do_cong_ty and ngay_lap_xong >= current_date - 28)       as lap_xong,
         (select round(count(*)/4.0) from deposit_allocation_snapshot
           where source='FIXED' and status='APPROVED'
             and approved_at >= current_date - 28)                        as duyet_coc,
         (select round(count(*)/4.0) from stock_move_snapshot
           where source='TELECOM' and doc_type='INVENTORY_IN'
             -- Khách huỷ trả máy về. KHÔNG phải RECEIPT_FOR_CANCELLED_ORDER
             -- (đơn hàng huỷ nhận lại) — mã đó chỉ 2 phiếu trong 28 ngày.
             and reason_type = 'RECEIPT_FOR_CANCELLED_SUBSCRIPTION'
             and doc_date >= current_date - 28)                           as may_ve,
         (select round(count(*)/4.0) from payment_reconcile_snapshot
           where source='TELECOM' and created_at_src >= current_date - 28) as gan_hd
)
select d.he,
       d.tram                                         as ma,
       count(*)                                       as ton,
       round(avg(d.tuoi_ngay))::int                   as tuoi_tb,
       max(d.tuoi_ngay)::int                          as gia_nhat,
       -- Đếm bao nhiêu cái quá lâu, KHÔNG dùng cái già nhất: một ngoại lệ nằm
       -- 127 ngày cũng kéo cả trạm thành "bỏ quên", đỏ gần hết bảng thì cờ hết
       -- tác dụng. CHO_HEN đo ngày CÒN LẠI nên không tính.
       case when d.tram = 'CHO_HEN' then 0
            else count(*) filter (where d.tuoi_ngay > 90)::int end as qua_lau,
       nullif(sum(d.tien), 0)                         as tien,
       case d.tram
         when 'KHAO_SAT'      then (select lap_xong  from ra)
         when 'CHO_HEN'       then (select lap_xong  from ra)
         when 'QUA_HEN'       then (select lap_xong  from ra)
         when 'CHO_DUYET_COC' then (select duyet_coc from ra)
         when 'CHO_GAN_HD'    then (select gan_hd    from ra)
         when 'CHO_THU_MAY'   then (select may_ve    from ra)
         else null
       end                                            as ra_moi_tuan
  from v_tram_chi_tiet d
 group by d.he, d.tram;

comment on view v_tram_van_hanh is
  'Việc đang nằm ở trạm nào: tồn, tuổi, tốc độ ra mỗi tuần — gom từ v_tram_chi_tiet nên luôn khớp ngăn kéo';
