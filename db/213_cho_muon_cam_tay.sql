-- Cho khách wifi cố định mượn máy cầm tay — chỗ hai hệ thống dính vào nhau.
--
-- Luồng: khách ký wifi cố định nhưng chờ nhà mạng lắp hàng tháng, nên 3M cho
-- mượn một máy wifi cầm tay dùng tạm và thu cọc. Lắp xong, khách trả máy, cọc
-- chuyển thành cước của hợp đồng cố định — bên cố định ghi nhận đó là đợt thu
-- kênh "cần trừ cọc".
--
-- Hai đầu của cùng một việc nằm ở hai hệ: máy trả về nằm trong kho cầm tay
-- (reason_type = RECEIPT_FOR_FIXED_WIFI_LOAN), tiền cấn trừ nằm trong sổ thu
-- của cố định. Không có khoá nối trực tiếp giữa chúng, nên view này chỉ đặt
-- hai con số cạnh nhau theo tháng chứ KHÔNG ghép từng cái.
--
-- Số liệu cho thấy chúng đi cùng nhau nhưng không khớp một-một: tháng 9 có 65
-- máy trả về và 69 đợt cấn trừ, tháng 8 là 23 và 110. Lệch vì kho mới ghi lý
-- do này từ tháng 8, và vì cấn trừ có thể xảy ra trước hoặc sau ngày trả máy.
-- Đừng đọc hai cột như một phép đối chiếu.

create or replace view v_cho_muon_cam_tay as
with thang as (
  select generate_series(
           date_trunc('month', current_date) - interval '11 months',
           date_trunc('month', current_date),
           interval '1 month')::date as dau_thang
)
select to_char(t.dau_thang, 'YYYY-MM')                                 as ky,
       (select count(*) from stock_move_snapshot k
         where k.source = 'TELECOM'
           and k.reason_type = 'RECEIPT_FOR_FIXED_WIFI_LOAN'
           and date_trunc('month', k.doc_date)::date = t.dau_thang)    as may_tra_ve,
       (select count(*) from fixed_fee_installment i
         where i.source = 'FIXED' and kenh_thu_chuan(i.channel) = 'cần trừ cọc'
           and date_trunc('month', i.paid_at)::date = t.dau_thang)     as dot_can_tru,
       coalesce((select sum(i.amount) from fixed_fee_installment i
                  where i.source = 'FIXED' and kenh_thu_chuan(i.channel) = 'cần trừ cọc'
                    and date_trunc('month', i.paid_at)::date = t.dau_thang), 0)
                                                                       as tien_can_tru
  from thang t;

comment on view v_cho_muon_cam_tay is
  'Máy cầm tay cho khách cố định mượn: máy trả về kho (bên cầm tay) và cọc cấn sang cước (bên cố định) — hai đầu của cùng một việc, đặt cạnh nhau chứ không ghép một-một';

-- Hiện trạng: còn bao nhiêu máy đang nằm ở nhà khách wifi cố định.
create or replace view v_cho_muon_dang_giu as
select count(*) filter (where s.status = 'ACTIVE')      as dang_muon,
       count(*) filter (where s.status = 'TERMINATED')  as da_tra,
       count(*)                                         as tat_ca
  from subscription_snapshot s
 where s.source = 'TELECOM' and s.cho_muon_cd;

comment on view v_cho_muon_dang_giu is
  'Thuê bao cầm tay mở riêng để cho khách wifi cố định mượn máy — không sinh cước, không hoá đơn';
