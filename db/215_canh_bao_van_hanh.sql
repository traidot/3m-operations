-- Một bảng duy nhất liệt kê mọi cảnh báo vận hành bên wifi cố định.
--
-- Các cảnh báo vẫn nằm rải ở nhiều màn; cái thiếu là chỗ đứng từ xa đếm xem
-- đang tồn những gì, bao nhiêu, bao nhiêu tiền, và cái cũ nhất nằm bao lâu.
--
-- Hai nguyên tắc:
--
-- (1) LUÔN trả đủ mọi loại, kể cả loại đang bằng 0. Bảng mà tự bỏ dòng sạch
--     thì không phân biệt được "hết việc" với "câu đếm hỏng".
--
-- (2) Chỉ phần CÔNG TY. Hợp đồng đại lý không phải việc của 3M, đếm vào thì
--     mọi con số đều phồng lên (riêng đơn lắp quá hạn: 471 → 221).
--
-- Nhãn, mức nặng nhẹ và đường dẫn xử lý để bên web (nhan.ts) — ở đây chỉ số.

drop view if exists v_fixed_canh_bao;

create view v_fixed_canh_bao as
with hd as (
  select c.*, cb.ma
    from v_fixed_contract c
    cross join unnest(c.canh_bao) as cb(ma)
   where c.do_cong_ty
),
tu_hop_dong as (
  select ma,
         count(distinct subscription_id)                     as so_luong,
         count(distinct subscription_id)                     as so_hop_dong,
         -- Mỗi loại cảnh báo đo bằng một khoản tiền khác nhau; loại không quy
         -- ra tiền được thì để trống, đừng ghi 0 — 0 yên và "không biết" là
         -- hai chuyện khác nhau.
         nullif(sum(case ma
                      when 'NO_NANG'        then con_no
                      when 'KHO_DOI'        then con_no
                      when 'HUY_CON_NO'     then con_no_sau_coc
                      when 'CHO_DUYET'      then tien_treo_duyet
                      when 'THU_THIEU'      then tien_thieu
                      -- THIEU_GIA_CUOC và THIEU_NGAY_THU KHÔNG có số tiền: cả
                      -- 15 hợp đồng thiếu ngày thu cũng thiếu luôn giá cước,
                      -- nên phần đang mất là không tính được, không phải 0.
                      else 0
                    end), 0)                                 as tien,
         max(case when ma = 'CHO_LAP_LAU'
                  then current_date - ngay_ky end)           as cu_nhat_ngay
    from hd
   group by ma
),
-- Danh sách cố định để loại đang sạch vẫn ra dòng. CO_COC cố tình KHÔNG có ở
-- đây: nó đếm đúng cùng đống phiếu với COC_CHO_DUYET bên dưới, mà dòng kia có
-- thêm tiền và tuổi chờ.
ma_hop_dong(ma) as (
  values ('NO_NANG'), ('HUY_CON_NO'), ('THIEU_GIA_CUOC'), ('THIEU_NGAY_THU'),
         ('CHO_DUYET'), ('GHI_CHU'), ('NGOAI_KY'), ('THU_THIEU'), ('KHO_DOI'),
         ('CHO_LAP_LAU'), ('HUY_LECH_KY')
)
select l.ma,
       'hợp đồng'::text                        as don_vi,
       coalesce(t.so_luong, 0)                 as so_luong,
       coalesce(t.so_hop_dong, 0)              as so_hop_dong,
       t.tien,
       t.cu_nhat_ngay
  from ma_hop_dong l
  left join tu_hop_dong t on t.ma = l.ma

union all
-- Phiếu cọc khách đã trả mà chưa ai duyệt: tiền đã vào tài khoản nhưng nợ của
-- khách chưa được trừ.
select 'COC_CHO_DUYET', 'phiếu',
       count(*), count(distinct d.ma_hd),
       nullif(sum(d.tien), 0), max(d.cho_ngay)
  from v_fixed_coc_cho_phan_bo d
  left join v_fixed_contract c on c.contract_code = d.ma_hd
 where coalesce(c.do_cong_ty, true)

union all
-- Mã combini hết hạn mà khách không ra trả. Mã không tự sống lại.
select 'GMO_QUA_HAN', 'lần hẹn thu hỏng',
       count(*), count(distinct g.ma_hd),
       -- Nợ thật phải lấy MỘT lần cho mỗi hợp đồng: một hợp đồng tạo lại mã
       -- nhiều lần, cộng thẳng cột tiền là cộng trùng cùng một khoản.
       (select nullif(sum(x.no), 0)
          from (select max(g2.con_no) as no
                  from v_fixed_gmo_qua_han g2
                  join v_fixed_contract c2 on c2.contract_code = g2.ma_hd
                 where c2.do_cong_ty
                 group by g2.ma_hd) x),
       max(g.qua_han_ngay)
  from v_fixed_gmo_qua_han g
  join v_fixed_contract c on c.contract_code = g.ma_hd
 where c.do_cong_ty

union all
-- Đã lắp xong mà chưa có ngày bắt đầu thu: máy đang chạy, sổ chưa thu đồng nào.
select 'CHUA_HOAT_DONG', 'hợp đồng',
       count(*), count(*),
       nullif(sum(d.cuoc_thang), 0), max(d.sau_lap_ngay)
  from v_fixed_chua_hoat_dong d
  left join v_fixed_contract c on c.subscription_id = d.subscription_id
 where coalesce(c.do_cong_ty, true)

union all
-- Kỳ lẽ ra phải có mà sổ không có dòng nào.
select 'KY_HUT', 'kỳ',
       count(*), count(distinct d.subscription_id),
       nullif(sum(d.tien_le_ra - d.tien_da_thu), 0), null
  from v_fixed_ky_hut d
  left join v_fixed_contract c on c.subscription_id = d.subscription_id
 where coalesce(c.do_cong_ty, true)

union all
-- Tiền thu vào hợp đồng không có khoảng thu nào chứa ngày đó.
select 'THU_NGOAI_HD', 'lần thu',
       count(*), count(distinct d.subscription_id),
       nullif(sum(d.tien), 0), null
  from v_fixed_thu_ngoai_hop_dong d
 where d.do_cong_ty

union all
-- Đơn lắp đã quá ngày hẹn.
select 'LAP_QUA_HAN', 'đơn',
       count(*), count(distinct d.ma_hd),
       null, max(d.tre_ngay)
  from v_fixed_lap_qua_han_ds d
  join v_fixed_contract c on c.subscription_id = d.source_id
 where c.do_cong_ty;

comment on view v_fixed_canh_bao is
  'Mọi cảnh báo vận hành wifi cố định, một dòng một loại — chỉ phần công ty, loại sạch vẫn ra dòng 0';
