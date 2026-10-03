-- Màn Hôm nay cho wifi cầm tay: chỉ số tháng và bảng 28 ngày.
--
-- Dựng cùng khuôn với bên cố định nhưng nguồn khác hẳn: cầm tay thu qua hoá
-- đơn chứ không qua đợt thu, và có kho máy nên theo dõi được việc thu hồi —
-- thứ mà bên cố định không có số.
--
-- Một bẫy phải tránh: terminated_on bên cầm tay có NGÀY TƯƠNG LAI. Hiện 1.101
-- thuê bao ghi ngừng 31/10, 13 cái ghi 31/12 — đó là ngày hẹn ngừng, chưa
-- ngừng. Đếm tất vào "ngừng trong tháng" là thổi con số lên nhiều lần, nên mọi
-- chỗ đếm ngừng đều chặn <= current_date.

create or replace view v_telecom_chi_so_thang as
with thang as (
  select generate_series(
           date_trunc('month', current_date) - interval '11 months',
           date_trunc('month', current_date),
           interval '1 month')::date as dau_thang
)
select to_char(t.dau_thang, 'YYYY-MM')                                 as ky,
       -- Doanh thu: tiền thật về trong tháng, bất kể của hoá đơn nào.
       coalesce((select sum(p.amount) from payment_snapshot p
                  where p.source = 'TELECOM'
                    and date_trunc('month', p.paid_at)::date = t.dau_thang), 0)
                                                                       as doanh_thu,
       (select count(*) from subscription_snapshot s
         where s.source = 'TELECOM'
           and s.terminated_on <= current_date
           and date_trunc('month', s.terminated_on)::date = t.dau_thang)
                                                                       as ngung,
       (select count(*) from subscription_snapshot s
         where s.source = 'TELECOM'
           and date_trunc('month', s.activated_on)::date = t.dau_thang) as moi,
       -- Máy khách trả về kho trong tháng.
       (select count(*) from stock_move_snapshot k
         where k.source = 'TELECOM' and k.doc_type = 'INVENTORY_IN'
           and k.business_type = 'CUSTOMER'
           and date_trunc('month', k.doc_date)::date = t.dau_thang)     as may_thu_ve,
       (select count(*) from stock_move_snapshot k
         where k.source = 'TELECOM' and k.doc_type = 'INVENTORY_OUT'
           and k.business_type = 'CUSTOMER'
           and date_trunc('month', k.doc_date)::date = t.dau_thang)     as may_giao_di,
       -- Cước của kỳ đó còn phải đòi, lấy thẳng từ v_telecom_month.
       coalesce((select m.con_doi from v_telecom_month m
                  where m.ky = to_char(t.dau_thang, 'YYYY-MM')), 0)     as con_doi,
       coalesce((select m.hoa_don_dang_doi from v_telecom_month m
                  where m.ky = to_char(t.dau_thang, 'YYYY-MM')), 0)     as hoa_don_dang_doi
  from thang t;

comment on view v_telecom_chi_so_thang is
  'Doanh thu, thuê bao ngừng, máy thu về và cước còn đòi theo tháng — wifi cầm tay';

-- Tháng đang chạy, so với cùng số ngày đầu của tháng trước.
create or replace view v_telecom_thang_nay as
with moc as (
  select date_trunc('month', current_date)::date                       as dau_thang,
         (current_date - date_trunc('month', current_date)::date + 1)   as ngay_da_qua,
         (date_trunc('month', current_date) - interval '1 month')::date as dau_truoc
)
select m.ngay_da_qua,
       to_char(m.dau_thang, 'YYYY-MM')                                  as ky,
       t.doanh_thu, t.ngung, t.moi, t.may_thu_ve, t.may_giao_di,
       t.con_doi, t.hoa_don_dang_doi,
       coalesce((select sum(p.amount) from payment_snapshot p
                  where p.source = 'TELECOM'
                    and p.paid_at::date >= m.dau_truoc
                    and p.paid_at::date <= least(
                          m.dau_truoc + (m.ngay_da_qua - 1),
                          (m.dau_truoc + interval '1 month' - interval '1 day')::date)), 0)
                                                                        as doanh_thu_cung_ky,
       (select count(*) from subscription_snapshot s
         where s.source = 'TELECOM' and s.terminated_on >= m.dau_truoc
           and s.terminated_on <= least(
                 m.dau_truoc + (m.ngay_da_qua - 1),
                 (m.dau_truoc + interval '1 month' - interval '1 day')::date))
                                                                        as ngung_cung_ky,
       (select count(*) from stock_move_snapshot k
         where k.source = 'TELECOM' and k.doc_type = 'INVENTORY_IN'
           and k.business_type = 'CUSTOMER' and k.doc_date >= m.dau_truoc
           and k.doc_date <= least(
                 m.dau_truoc + (m.ngay_da_qua - 1),
                 (m.dau_truoc + interval '1 month' - interval '1 day')::date))
                                                                        as may_thu_ve_cung_ky
  from moc m
  join v_telecom_chi_so_thang t on t.ky = to_char(m.dau_thang, 'YYYY-MM');

comment on view v_telecom_thang_nay is
  'Chỉ số tháng đang chạy của wifi cầm tay, kèm cùng số ngày đầu tháng trước';

-- Lý do xuất nhập kho bên nguồn ghi bằng mã. Dịch một chỗ ở đây để bảng, bộ
-- lọc và tệp xuất ra không ai tự đặt tên khác.
create or replace function kho_ly_do(ma text) returns text
language sql immutable as $$
  select case ma
    when 'ISSUE_FOR_ORDER'                    then 'Giao theo đơn hàng'
    when 'ISSUE_FOR_SOFTWARE_RECONCILE'       then 'Xuất đối soát phần mềm'
    when 'ISSUE_FOR_PRODUCT_CONVERSION'       then 'Chuyển đổi sản phẩm'
    when 'ISSUE_FOR_STOCKTAKE'                then 'Kiểm kê'
    when 'ISSUE_FOR_DAMAGED'                  then 'Hỏng, huỷ'
    when 'RECEIPT_FOR_CANCELLED_SUBSCRIPTION' then 'Khách huỷ trả về'
    when 'RECEIPT_FOR_FIXED_WIFI_LOAN'        then 'Wifi cố định trả về'
    when 'RECEIPT_FOR_PURCHASE'               then 'Mua mới'
    when 'RECEIPT_FOR_PRODUCT_CONVERSION'     then 'Chuyển đổi sản phẩm'
    when 'RECEIPT_FOR_OTHER'                  then 'Khác'
    when 'ISSUE_FOR_EXCHANGE_DEVICE'          then 'Đổi máy cho khách'
    when 'RECEIPT_FOR_EXCHANGE_DEVICE'        then 'Nhận lại máy đổi'
    when 'ISSUE_FOR_TRANSFER'                 then 'Chuyển kho'
    when 'RECEIPT_FOR_TRANSFER'               then 'Nhận từ kho khác'
    when 'RECEIPT_FOR_CANCELLED_ORDER'        then 'Đơn hàng huỷ, nhận lại'
    when 'RECEIPT_FOR_STOCKTAKE'              then 'Kiểm kê'
    -- Mã lạ thì để nguyên chứ không gộp vào "khác": gộp là giấu mất việc
    -- nguồn vừa thêm loại mới mà kho chưa biết.
    else coalesce(ma, 'Không ghi lý do')
  end;
$$;

comment on function kho_ly_do(text) is
  'Dịch mã lý do xuất nhập kho của wifi cầm tay sang tiếng Việt';

-- 28 ngày gần nhất, cùng khuôn với bên cố định: mỗi dòng một (chỉ số, ngày).
--
-- Ba nhóm: tiền về theo kênh, thuê bao vào ra, máy ra vào kho.
--
-- Bên cầm tay không có khái niệm "đã duyệt" như đợt thu cố định, nên tien_duyet
-- luôn bằng tien — cột ấy giữ để dùng chung một component bảng với bên kia,
-- dấu ✓ ở đó sẽ luôn khớp.
create or replace view v_telecom_ngay_28 as
with ngay as (
  select generate_series(current_date - 27, current_date, interval '1 day')::date as ngay
),
su_kien as (
  select 'tien' as nhom, kenh_thu_chuan(p.channel) as chi_so, 'yên' as don_vi, 1 as thu_tu,
         p.paid_at::date as ngay, p.amount as tien
    from payment_snapshot p
   where p.source = 'TELECOM' and p.amount > 0
  union all
  -- Tiền đã vào tài khoản mà chưa trừ vào hoá đơn nào: nợ của khách chưa giảm
  -- dù họ đã trả. Đứng chung bảng tiền để thấy ngay ngày nào thu nhiều mà gán
  -- ít.
  select 'tien', 'Chưa gán hoá đơn', 'yên', 9, t.paid_at::date, t.amount
    from v_telecom_thu_chua_can_tru t
  union all
  select 'hoa_don', 'Phát hành', 'hoá đơn', 1, i.issued_on, i.total_amount
    from invoice_snapshot i
   where i.source = 'TELECOM'
  union all
  select 'thue_bao', 'Kích hoạt mới', 'thuê bao', 1, s.activated_on, 0
    from subscription_snapshot s
   where s.source = 'TELECOM' and s.activated_on is not null
  union all
  -- Chỉ ngừng ĐÃ XẢY RA: terminated_on bên nguồn có ngày hẹn ở tương lai.
  select 'thue_bao', 'Ngừng', 'thuê bao', 2, s.terminated_on, 0
    from subscription_snapshot s
   where s.source = 'TELECOM' and s.terminated_on is not null
     and s.terminated_on <= current_date
  union all
  -- Kho tách theo LÝ DO chứ không gộp vào/ra: "giao theo đơn hàng" và "xuất
  -- để đối soát phần mềm" là hai việc khác hẳn nhau, gộp lại thành một con số
  -- thì không biết hôm đó bán hàng hay đang dọn sổ.
  select 'kho_ra', kho_ly_do(k.reason_type), 'máy',
         case k.reason_type
           when 'ISSUE_FOR_ORDER' then 1
           when 'ISSUE_FOR_SOFTWARE_RECONCILE' then 2
           when 'ISSUE_FOR_PRODUCT_CONVERSION' then 3
           else 4
         end,
         k.doc_date, 0
    from stock_move_snapshot k
   where k.source = 'TELECOM' and k.doc_type = 'INVENTORY_OUT'
  union all
  select 'kho_vao', kho_ly_do(k.reason_type), 'máy',
         case k.reason_type
           when 'RECEIPT_FOR_CANCELLED_SUBSCRIPTION' then 1
           when 'RECEIPT_FOR_FIXED_WIFI_LOAN' then 2
           when 'RECEIPT_FOR_PURCHASE' then 3
           when 'RECEIPT_FOR_PRODUCT_CONVERSION' then 4
           else 5
         end,
         k.doc_date, 0
    from stock_move_snapshot k
   where k.source = 'TELECOM' and k.doc_type = 'INVENTORY_IN'
),
khung as (
  select distinct e.nhom, e.chi_so, e.don_vi, e.thu_tu, n.ngay
    from su_kien e cross join ngay n
   where e.ngay >= current_date - 89
)
select k.nhom, k.chi_so, k.don_vi, k.ngay,
       count(e.*)                       as so_luong,
       coalesce(sum(e.tien), 0)         as tien,
       coalesce(sum(e.tien), 0)         as tien_that,
       k.thu_tu,
       coalesce(sum(e.tien), 0)         as tien_duyet
  from khung k
  left join su_kien e
    on e.nhom = k.nhom and e.chi_so = k.chi_so and e.ngay = k.ngay
 group by 1, 2, 3, 4, k.thu_tu;

comment on view v_telecom_ngay_28 is
  '28 ngày gần nhất của wifi cầm tay: tiền theo kênh, hoá đơn, thuê bao vào ra, máy ra và vào kho theo lý do';

-- Tiền và việc đang đứng lại, không thuộc tháng nào.
create or replace view v_telecom_dang_treo as
select
  (select count(*) from v_telecom_thue_bao_no where no > 0)                  as no_thue_bao,
  (select coalesce(round(sum(no)), 0) from v_telecom_thue_bao_no)            as no_tien,
  (select count(*) from v_telecom_thu_chua_can_tru)                          as treo_so,
  (select coalesce(round(sum(amount)), 0) from v_telecom_thu_chua_can_tru)   as treo_tien,
  -- NOT_RETURNED là máy đã hết hạn thuê mà khách chưa trả; RENTING là đang
  -- thuê bình thường, không phải việc phải đòi.
  (select count(*) from v_telecom_may where trang_thai = 'NOT_RETURNED')     as may_chua_tra;

comment on view v_telecom_dang_treo is
  'Nợ cước, tiền thu chưa gán hoá đơn, máy khách chưa trả — wifi cầm tay';
