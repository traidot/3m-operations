-- Mảng cầm tay: "quá hạn" là qua ngày hạn, không phải qua ngày hạn 30 hôm.
--
-- Luật 3M: đóng trước dùng sau, qua ngày hạn là không kịp. Bên cầm tay mỗi hoá
-- đơn đã mang sẵn ngày hạn của nó (phần lớn là mùng 1, một số gói rơi vào 25,
-- 28, 29, 31) nên không cần suy ra như bên cố định — chỉ cần bỏ cái đệm 30 ngày
-- đang khiến 17 thuê bao nợ 6–30 ngày không bị báo.
--
-- Công nợ bên cầm tay vốn đã đúng: toàn bộ 200 hoá đơn đang đòi đều đã qua hạn,
-- nguồn không phát hoá đơn trước hạn nên không có khoản nào bị tính sớm.

update threshold
   set value = 0,
       note  = 'Quá hạn bao nhiêu ngày thì báo nợ; 0 là báo ngay khi qua ngày hạn'
 where key = 'ar_overdue_days';
