-- Hai chỗ tiền đứng lại trên đường từ combini về sổ cước.
--
--   tạo mã  →  khách ra combini trả  →  phiếu cọc  →  phân bổ vào tháng cước
--             └── (1) mã hết hạn        └── (2) phiếu nằm chờ phân bổ
--
-- (1) chỉ thấy được từ bảng GMO (db/190), (2) thì kho vẫn có sẵn nhưng chưa
-- màn hình nào hiện.

-- Một LẦN tạo mã = một batch. Bốn dòng combini cùng số tiền, khách trả ở một
-- chỗ nên chỉ một dòng PAYSUCCESS — gộp lại trước rồi mới cộng tiền, không
-- thì ra số gấp bốn.
create or replace view v_fixed_gmo_lan as
select coalesce(g.batch_id, g.source_id)                     as lan,
       max(g.contract_id)                                    as contract_id,
       max(g.amount)                                         as tien,
       bool_or(g.status = 'PAYSUCCESS')                       as da_tra,
       max(g.loai)                                           as loai,
       bool_or(g.phieu_coc_id is not null)                    as co_phieu_coc,
       min(g.created_at_src)                                 as tao_luc,
       max(g.han_tra)                                        as han_tra,
       max(g.updated_at_src) filter (where g.status = 'PAYSUCCESS') as tra_luc,
       max(g.ky_cuoc)                                        as ky_cuoc
  from gmo_payment_snapshot g
 where g.source = 'FIXED'
 group by coalesce(g.batch_id, g.source_id);

comment on view v_fixed_gmo_lan is
  'Mỗi dòng một lần tạo mã combini (gộp bốn mã cùng batch) — đơn vị đúng để đếm tiền';

-- Trạng thái của một lần tạo mã. "Quá hạn" là mã chết: khách không ra trả,
-- mã không tự sống lại, muốn thu phải tạo mã mới.
create or replace view v_fixed_gmo_tinh_trang as
select case
         when da_tra then 'da_tra'
         when han_tra is not null and han_tra < now() then 'qua_han'
         else 'dang_cho'
       end                                   as tinh_trang,
       case when loai = 2 then 'cọc' else 'cước' end as loai_ten,
       count(*)                              as so_lan,
       sum(tien)                             as tien
  from v_fixed_gmo_lan
 group by 1, 2;

comment on view v_fixed_gmo_tinh_trang is
  'Mã combini theo tình trạng: đã trả, đang chờ, quá hạn không ai trả';

-- Danh sách mã quá hạn, để gọi lại khách hoặc tạo mã mới.
create or replace view v_fixed_gmo_qua_han as
select l.lan,
       c.contract_code                       as ma_hd,
       c.dia_chi,
       c.trang_thai_hop_dong,
       l.tien,
       case when l.loai = 2 then 'cọc' else 'cước' end as loai_ten,
       l.ky_cuoc,
       l.tao_luc::date                       as ngay_tao,
       l.han_tra::date                       as ngay_het_han,
       (current_date - l.han_tra::date)      as qua_han_ngay,
       c.con_no,
       contract_url(l.contract_id)           as url
  from v_fixed_gmo_lan l
  left join v_fixed_contract c on c.subscription_id = l.contract_id
 where not l.da_tra and l.han_tra is not null and l.han_tra < now();

comment on view v_fixed_gmo_qua_han is
  'Mã combini hết hạn mà khách không trả — tiền hẹn thu nhưng không về';

-- Phiếu cọc khách đã trả tiền mà chưa ai gán vào tháng cước nào. Tiền đã nằm
-- trong tài khoản 3M nhưng nợ của khách chưa được trừ, nên hai bên nhìn số
-- khác nhau cho tới khi có người ngồi phân bổ.
create or replace view v_fixed_coc_cho_phan_bo as
select d.source_id,
       d.contract_code                       as ma_hd,
       c.dia_chi,
       d.amount                              as tien,
       d.paid_at::date                       as ngay_tra,
       (current_date - d.paid_at::date)      as cho_ngay,
       d.channel,
       d.note                                as ghi_chu,
       c.con_no,
       contract_url(d.subscription_source_id) as url
  from deposit_allocation_snapshot d
  left join v_fixed_contract c on c.subscription_id = d.subscription_source_id
 where d.source = 'FIXED' and d.status = 'PENDING';

comment on view v_fixed_coc_cho_phan_bo is
  'Phiếu cọc đã thu tiền nhưng chưa phân bổ vào tháng cước nào';
