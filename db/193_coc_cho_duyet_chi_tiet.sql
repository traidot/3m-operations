-- Phiếu cọc chờ duyệt — thêm hai thứ quyết định việc phải làm.
--
-- Màn /gmo-payments/history bên CMS gọi trạng thái này là "Chờ duyệt", nên
-- kho dùng đúng từ đó; gọi khác đi thì người xem hai bên không nhận ra là
-- cùng một đống việc.
--
-- (1) Phiếu đã điền sẵn tháng hay chưa. Lúc tạo mã, người tạo có thể chọn
--     trước tháng cước; khi khách trả thì CMS chép sang phiếu, người duyệt chỉ
--     việc bấm. Phiếu KHÔNG điền sẵn thì người duyệt phải tự tra xem gán vào
--     tháng nào — việc nặng hơn hẳn, và hiện chiếm hai phần ba đống chờ.
--
-- (2) Phiếu chờ bao lâu rồi. Trung bình duyệt hết 1,5 ngày, nên cái nằm quá
--     hai tuần không phải đang xử lý mà là bị bỏ quên.

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
       contract_url(d.subscription_source_id) as url,
       -- jsonb '[]' là chưa chọn tháng nào. Đừng dùng độ dài chuỗi: nguồn ghi
       -- '[]' hay null tuỳ đường đi, cả hai đều nghĩa là trống.
       coalesce(jsonb_array_length(d.allocations), 0) > 0 as co_san_thang,
       d.allocations                         as phan_bo
  from deposit_allocation_snapshot d
  left join v_fixed_contract c on c.subscription_id = d.subscription_source_id
 where d.source = 'FIXED' and d.status = 'PENDING';

comment on view v_fixed_coc_cho_phan_bo is
  'Phiếu cọc đã thu tiền, CMS gọi là "Chờ duyệt" — kèm phiếu nào đã điền sẵn tháng cước';

-- Tốc độ duyệt của những phiếu đã xong, để biết bao lâu là bất thường.
create or replace view v_fixed_coc_toc_do as
select count(*)                                                        as da_duyet,
       count(*) filter (where approved_at::date = paid_at::date)        as duyet_trong_ngay,
       round(avg(approved_at::date - paid_at::date)::numeric, 1)        as tb_ngay,
       max(approved_at::date - paid_at::date)                           as lau_nhat
  from deposit_allocation_snapshot
 where source = 'FIXED' and status = 'APPROVED'
   and approved_at is not null and paid_at is not null;

comment on view v_fixed_coc_toc_do is
  'Phiếu cọc mất bao lâu từ lúc khách trả tới lúc duyệt — mốc để biết phiếu nào đang bị bỏ quên';
