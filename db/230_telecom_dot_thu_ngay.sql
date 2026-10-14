-- Chi tiết một ô của bảng "Tiền về theo ngày" bên cầm tay.
--
-- Bên cố định đã có v_fixed_dot_thu_ngay nên ô bấm được, bên này chưa có nên
-- bấm vào không ra gì. Cùng điều kiện với v_telecom_ngay_28 (nguồn TELECOM,
-- amount > 0, gom theo ngày trả và kênh chuẩn hoá) để danh sách cộng ra đúng
-- con số trong ô — tin ô hay tin danh sách cũng ra một kết quả.
--
-- "Đã cấn" nhận đúng như v_telecom_thu_chua_can_tru: phải có dòng đối soát
-- trỏ tới hoá đơn còn tồn tại. Có dòng đối soát mà hoá đơn đã bị xoá thì vẫn
-- là chưa cấn, và đó là chuyện khác với chưa cấn lần nào — cột ly_do tách hai
-- trường hợp đó ra.

create or replace view v_telecom_dot_thu_ngay as
select
    kenh_thu_chuan(p.channel)                        as kenh,
    p.paid_at::date                                  as ngay,
    p.source_id,
    coalesce(pt.display_name, 'khách chưa có tên')   as khach,
    ps.customer_code                                 as ma_khach,
    p.amount                                         as tien,
    p.reference,
    p.created_at_src::date                           as ngay_go,
    coalesce(nv.display_name, p.created_by_src)      as nguoi_go,
    exists (
      select 1
        from payment_reconcile_snapshot r
        join invoice_snapshot i
          on i.source = 'TELECOM' and i.source_id = r.invoice_source_id
       where r.source = 'TELECOM' and r.payment_source_id = p.source_id
    )                                                as da_can,
    case
      when exists (
        select 1
          from payment_reconcile_snapshot r
          join invoice_snapshot i
            on i.source = 'TELECOM' and i.source_id = r.invoice_source_id
         where r.source = 'TELECOM' and r.payment_source_id = p.source_id
      ) then null
      when exists (
        select 1 from payment_reconcile_snapshot r
         where r.source = 'TELECOM' and r.payment_source_id = p.source_id
      ) then 'CAN_TRU_HOA_DON_XOA'
      else 'CHUA_CAN_TRU'
    end                                              as ly_do,
    telecom_url('khach', ps.source_customer_id)      as url
  from payment_snapshot p
  left join party pt on pt.id = p.party_id
  left join party_source ps
    on ps.source = 'TELECOM' and ps.party_id = p.party_id and ps.status <> 'REJECTED'
  left join staff_snapshot nv
    on nv.source = 'TELECOM' and nv.source_id = p.created_by_src
 where p.source = 'TELECOM' and p.amount > 0 and p.paid_at is not null;

comment on view v_telecom_dot_thu_ngay is
  'Từng khoản thu cầm tay của một kênh trong một ngày. Phải cộng ra đúng ô trên bảng tiền về theo ngày.';
