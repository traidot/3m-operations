-- Từng đợt thu của một tài khoản trong một ngày.
--
-- Bảng "Tiền về theo ngày" chỉ cho hai con số mỗi ô. Thấy ô hôm nay tụt hẳn
-- hoặc thấy dấu cấn trừ cọc thì câu hỏi tiếp theo luôn là "của hợp đồng nào",
-- mà trả lời câu đó hiện phải mở CMS lọc tay.
--
-- Giữ nguyên định nghĩa của bảng tổng: cùng điều kiện paid_at và amount > 0,
-- cùng kenh_thu_chuan. Lệch một điều kiện thôi là cộng các dòng ở đây không
-- ra con số trong ô, và người xem sẽ tin ô hay tin danh sách đều sai.

create or replace view v_fixed_dot_thu_ngay as
select kenh_thu_chuan(i.channel)        as kenh,
       i.paid_at::date                  as ngay,
       i.source_id,
       s.source_customer_id             as ma_hd,
       i.ky,
       i.amount                         as tien,
       i.status,
       -- Ngày gõ máy khác ngày tiền về là đợt nhập bù; đứng cạnh nhau mới thấy
       -- ngay dòng nào vào sổ muộn.
       i.created_at_src::date           as ngay_go,
       coalesce(nv.display_name, i.created_by_src) as nguoi_go,
       i.note,
       contract_url(i.contract_id)      as url
  from fixed_fee_installment i
  left join subscription_snapshot s
    on s.source = 'FIXED' and s.source_id = i.contract_id
  left join staff_snapshot nv
    on nv.source = 'FIXED' and nv.source_id = i.created_by_src
 where i.source = 'FIXED' and i.paid_at is not null and i.amount > 0;

comment on view v_fixed_dot_thu_ngay is
  'Từng đợt thu wifi cố định, gắn tài khoản và ngày tiền về — chi tiết đằng sau một ô của bảng tiền theo ngày';
