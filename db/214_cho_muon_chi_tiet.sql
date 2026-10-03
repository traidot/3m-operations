-- Danh sách đằng sau hai cột của bảng "Cho mượn máy cầm tay".
--
-- Bấm vào con số thì phải ra được từng dòng, không thì bảng chỉ để nhìn.

create or replace view v_cho_muon_may_ve as
select k.source_id,
       k.device_code                          as imei,
       k.doc_code                             as so_phieu,
       k.doc_date                             as ngay,
       to_char(k.doc_date, 'YYYY-MM')         as ky,
       k.warehouse_name                       as kho,
       k.product_name                         as goi,
       k.source_customer_id                   as ma_khach,
       c.khach,
       k.device_recall_status                 as tinh_trang_may,
       k.device_recall_note                   as ghi_chu
  from stock_move_snapshot k
  -- Khoá nối là party_id, KHÔNG phải ma_khach: source_customer_id ở phiếu kho
  -- là số thứ tự khách (2803), còn ma_khach là chuỗi có tiền tố (KH02803).
  -- Nối theo ma_khach thì ra 0 dòng và cột Khách rỗng toàn bộ.
  left join v_telecom_customer c on c.party_id = k.party_id
 where k.source = 'TELECOM' and k.reason_type = 'RECEIPT_FOR_FIXED_WIFI_LOAN';

comment on view v_cho_muon_may_ve is
  'Máy cầm tay khách wifi cố định trả về kho — chi tiết sau cột "máy trả về"';

-- Đợt thu kênh "cần trừ cọc" bên cố định: đầu kia của cùng việc đó.
create or replace view v_cho_muon_can_tru as
select d.source_id,
       to_char(d.ngay, 'YYYY-MM')             as ky,
       d.ngay,
       d.ma_hd,
       d.ky                                   as ky_cuoc,
       d.tien,
       d.status,
       d.ngay_go,
       d.nguoi_go,
       d.url
  from v_fixed_dot_thu_ngay d
 where d.kenh = 'cần trừ cọc';

comment on view v_cho_muon_can_tru is
  'Đợt thu kênh "cần trừ cọc" bên wifi cố định — chi tiết sau cột "đợt cấn trừ cọc"';
