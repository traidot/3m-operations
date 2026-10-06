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
 * Menu CHỈ bày các màn của bản thiết kế mới. Những màn cũ chưa gộp xong vẫn
 * chạy nếu gõ thẳng URL — giữ lại để đối chiếu, nhưng không bày ra nữa vì bày
 * cả hai lớp thì người xem không biết nên tin màn nào. Danh sách màn còn phải
 * gộp nằm ở cuối file này.
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
      { ten: "Tra cứu · cố định", href: "/hop-dong" },
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
 * Màn cũ còn chạy nhưng đã rút khỏi menu, kèm chỗ sẽ nhận nội dung của nó.
 *
 * Để đây chứ không để trong đầu: gõ URL vẫn vào được nên dễ quên là chúng còn
 * tồn tại, và mỗi cái còn sống là một chỗ nữa có thể nói khác với màn mới.
 *
 *   /hom-nay, /hom-nay/co-dinh, /hom-nay/cam-tay  → Việc đang tắc
 *   /thu-cuoc, /xem-xet-huy, /cam-tay/coc         → Việc đang tắc
 *   /thang, /lap-dat, /cam-tay/huy                → Việc đang tắc (vào/ra dây chuyền)
 *   /cuoc, /thang/tien, /cam-tay/chua-can-tru     → Tiền
 *   /cam-tay                                      → Tra cứu
 *   /cam-tay/vong-doi                             → Việc đang tắc (vòng đời máy)
 *   /                                             → Tra cứu (Bản tin)
 *
 * Marketing (/wifi, /wifi/[nguoi], /esim) cũng còn chạy nhưng đã rút khỏi
 * menu: nằm ngoài phạm vi giám sát vận hành, và nguồn của nó là sheet bên MKT
 * chứ không phải hai hệ thống CMS.
 */

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
