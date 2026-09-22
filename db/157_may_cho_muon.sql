-- Cờ thật của đơn "cho mượn cục wifi khi khách chờ lắp wifi cố định".
--
-- 156 phải suy qua nhóm khách vì lúc đó không vào được nguồn. Giờ đọc được cờ
-- thật: `order."lendForFixedWifi"`, 701 trên 4.046 đơn còn sống.
--
-- Đừng đọc `subscription."lendForFixedWifi"` — cột đó false ở toàn bộ thuê bao,
-- nghiệp vụ này chỉ ghi ở đơn hàng.
alter table device_snapshot add column if not exists cho_muon_cd boolean;
