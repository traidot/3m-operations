-- Loại máy. Trước giờ cột `model` của nguồn TELECOM lấy `device_info.msn` —
-- msn là SỐ ĐIỆN THOẠI của máy, không phải đời máy, nên 2.320/2.428 máy để
-- trống và 108 cái còn lại hiện ra một dãy số 070368… vô nghĩa.
--
-- Đời máy thật nằm ở sản phẩm của order_item sinh ra lượt thuê:
--   Wifi full dung lượng U20   1.447 lượt      Sim softbank 100GB   104
--   Wifi full dung lượng H1      377           Sim softbank 50GB     82
--   Wifi 100GB U20               365           Sim datacall vật lý   68
--   Wifi 100GB H1                225           …
--   Wifi full dung lượng MR1     182
--   Wifi WIMAX                   125
--
-- `device_info.variantId` thì không dùng được: chỉ 27/124 dòng có, và trên
-- 2.428 máy cho thuê chỉ khớp được 17 cái.
--
-- Kèm `sales_type` vì order_item phân biệt thuê với bán; danh sách này chỉ
-- gồm máy cho thuê nên cột đó dùng để phát hiện dòng lọt sai chỗ.

alter table device_snapshot
  add column if not exists device_type text,
  add column if not exists sales_type  text;

comment on column device_snapshot.model is
  'Đời máy. TELECOM lấy từ sản phẩm của order_item (U20, H1, MR1, WIMAX, SIM…)';
comment on column device_snapshot.device_type is
  'Nhóm sản phẩm bên nguồn: WIFI_DEVICE | SOFTBANK_SIM | DATA_CALL_SIM | ONE_YEAR_DATA_SIM';
