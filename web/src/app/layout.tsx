import type { Metadata } from "next";
import { Nav, type NhomMenu } from "./nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Giám sát 3M",
  description: "Bản tin vận hành, hai mảng wifi, marketing và thu cước",
};

/**
 * Menu gom theo CÂU HỎI người xem mang vào, không theo mảng kinh doanh.
 *
 * Gom theo mảng thì nhóm "cần xử lý" cắt ngang mọi mảng khác, và cùng một màn
 * vừa thuộc chỗ này vừa thuộc chỗ kia. Ba nhóm dưới đây loại trừ nhau: một lần
 * mở màn chỉ có một câu hỏi chính.
 *
 * Đích đến là mỗi nhóm MỘT màn, hai tab cố định / cầm tay. Mục nào còn đứng
 * lẻ là phần chưa gộp xong — gộp tới đâu thì mục biến mất tới đó, nên danh
 * sách này cũng là bảng theo dõi việc còn lại.
 */
const MENU: NhomMenu[] = [
  {
    nhom: "Việc đang tắc ở đâu",
    muc: [
      { ten: "Điểm nghẽn", href: "/diem-nghen" },
      { ten: "Việc hôm nay · cố định", href: "/viec-hom-nay/co-dinh" },
      { ten: "Việc hôm nay · cầm tay", href: "/viec-hom-nay/cam-tay" },
      { ten: "Hôm nay", href: "/hom-nay" },
      { ten: "Hôm nay · cố định", href: "/hom-nay/co-dinh" },
      { ten: "Hôm nay · cầm tay", href: "/hom-nay/cam-tay" },
      { ten: "Thu cước", href: "/thu-cuoc" },
      { ten: "Dự kiến huỷ", href: "/xem-xet-huy" },
      { ten: "Cọc", href: "/cam-tay/coc" },
      { ten: "Hợp đồng theo tháng", href: "/thang" },
      { ten: "Lắp đặt", href: "/lap-dat" },
      { ten: "Huỷ thuê bao", href: "/cam-tay/huy" },
    ],
  },
  {
    nhom: "Tiền",
    muc: [
      { ten: "Tiền · cố định", href: "/tien/co-dinh" },
      { ten: "Tiền · cầm tay", href: "/tien/cam-tay" },
      { ten: "Cước theo tháng · cố định", href: "/cuoc" },
      { ten: "Tiền theo tháng · cố định", href: "/thang/tien" },
      { ten: "Tiền treo chưa gán · cầm tay", href: "/cam-tay/chua-can-tru" },
    ],
  },
  {
    nhom: "Tra cứu",
    muc: [
      { ten: "Hợp đồng · cố định", href: "/hop-dong" },
      { ten: "Tổng quan · cầm tay", href: "/cam-tay" },
      { ten: "Khách và dịch vụ", href: "/cam-tay/khach" },
      { ten: "Máy cho thuê", href: "/cam-tay/may" },
      { ten: "Vòng đời máy", href: "/cam-tay/vong-doi" },
      { ten: "Đối chiếu kho", href: "/cam-tay/kho" },
      { ten: "Hai bên biết gì", href: "/cam-tay/kho/hai-ben" },
    ],
  },
  {
    // Ngoài phạm vi giám sát vận hành; để riêng chứ không trộn vào ba nhóm trên.
    nhom: "Marketing",
    muc: [
      { ten: "Chung", href: "/wifi" },
      { ten: "Đình Việt", href: "/wifi/viet" },
      { ten: "Việt Hoàng", href: "/wifi/hoang" },
      { ten: "eSIM", href: "/esim" },
    ],
  },
  {
    nhom: "Dữ liệu",
    muc: [
      { ten: "Duyệt trùng khách", href: "/duyet-trung" },
      { ten: "Đồng bộ", href: "/dong-bo" },
    ],
  },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <div className="wrap">
          <Nav menu={MENU} />
          {children}
        </div>
      </body>
    </html>
  );
}
