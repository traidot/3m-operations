import type { Metadata } from "next";
import { Nav, type NhomMenu } from "./nav";
import { BangCu } from "./bang-cu";
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
 * Mỗi nhóm đúng hai màn, một cho mỗi mảng. Mọi màn cũ đã tan vào đây dưới dạng
 * tab; các đường cũ không còn, trừ bốn màn nằm ngoài phạm vi giám sát vận hành
 * ở cuối file.
 */
const MENU: NhomMenu[] = [
  {
    nhom: "Việc đang tắc ở đâu",
    muc: [
      { ten: "Điểm nghẽn", href: "/diem-nghen" },
      { ten: "Việc hôm nay · cố định", href: "/viec-hom-nay/co-dinh" },
      { ten: "Việc hôm nay · cầm tay", href: "/viec-hom-nay/cam-tay" },
    ],
  },
  {
    nhom: "Tiền",
    muc: [
      { ten: "Tiền · cố định", href: "/tien/co-dinh" },
      { ten: "Tiền · cầm tay", href: "/tien/cam-tay" },
    ],
  },
  {
    nhom: "Tra cứu",
    muc: [
      { ten: "Tra cứu · cố định", href: "/tra-cuu/co-dinh" },
      { ten: "Tra cứu · cầm tay", href: "/tra-cuu/cam-tay" },
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

/**
 * Màn còn chạy nhưng không bày trong menu, vì nằm ngoài phạm vi giám sát vận
 * hành hai mảng wifi:
 *
 *   /           Bản tin — danh sách phát hiện tự động, chưa gắn vào màn nào
 *   /wifi, /wifi/[nguoi], /esim   Marketing, nguồn là sheet bên MKT
 *
 * Bảy màn còn lại của bản thiết kế cũ đã tan hết vào các tab ở trên.
 */

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <div className="wrap">
          <Nav menu={MENU} />
          <BangCu />
          {children}
        </div>
      </body>
    </html>
  );
}
