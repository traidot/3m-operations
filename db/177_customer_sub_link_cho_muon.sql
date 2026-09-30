-- Nút "Mở thuê bao bên CMS" trỏ đúng màn cho từng loại thuê bao.
--
-- Nhóm cho mượn chờ wifi cố định không có trang chi tiết, chỉ có màn danh
-- sách nhận ?search=<mã máy>. Trỏ nhầm sang trang chi tiết thì CMS đá về
-- danh sách trống, nhìn như thuê bao không tồn tại.

create or replace view v_telecom_customer_sub as
select party_id,
    subscription_id,
    service_type,
    goi,
    trang_thai,
    gia_thang,
    ngay_kich_hoat,
    ngay_ngung,
    ma_may,
    so_hoa_don,
    da_thu,
    con_no,
    tien_mat,
    ky_gan_nhat_den,
    ngay_qua_han,
    canh_bao,
    CASE
        WHEN cho_muon_cd THEN telecom_url('cho_muon'::text, ma_may)
        ELSE telecom_url('thue_bao'::text, subscription_id)
    END AS link_cms
   FROM v_telecom_subscription;
