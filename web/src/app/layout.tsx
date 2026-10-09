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
 * Bảy màn đầu là bộ chính. Những mục còn lại mang tên quen thuộc của các màn
 * cũ, nhưng trỏ thẳng vào tab đã nuốt chúng — màn cũ không còn URL riêng, nội
 * dung thì còn nguyên. Giữ tên cũ trong menu để người quen đường cũ vẫn tìm
 * được, mà không phải dựng lại hai lớp màn nói cùng một chuyện.
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
    // Tên cũ, đích mới. Mỗi mục dẫn thẳng vào tab giữ nội dung của màn đó.
    nhom: "Màn cũ",
    muc: [
      { ten: "Hôm nay", href: "/diem-nghen?xem=hom-nay" },
      { ten: "Hôm nay · cố định", href: "/diem-nghen?xem=hom-nay&he=co-dinh" },
      { ten: "Hôm nay · cầm tay", href: "/diem-nghen?xem=hom-nay&he=cam-tay" },
      { ten: "Hợp đồng theo tháng", href: "/diem-nghen?xem=dong-chay&he=co-dinh" },
      { ten: "Huỷ thuê bao", href: "/diem-nghen?xem=dong-chay&he=cam-tay" },
      { ten: "Thu cước", href: "/viec-hom-nay/co-dinh?tab=cong-no" },
      { ten: "Dự kiến huỷ", href: "/viec-hom-nay/co-dinh?tab=du-kien-huy" },
      { ten: "Cọc", href: "/viec-hom-nay/cam-tay?tab=coc" },
      { ten: "Cước theo tháng", href: "/tien/co-dinh?xem=cuoc-thang" },
      { ten: "Tiền theo tháng", href: "/tien/co-dinh?xem=thuc-nhan" },
      { ten: "Tiền treo chưa gán", href: "/tien/cam-tay?xem=chua-gan" },
      { ten: "Khách và dịch vụ", href: "/tra-cuu/cam-tay?tab=khach" },
      { ten: "Máy cho thuê", href: "/tra-cuu/cam-tay?tab=may" },
      { ten: "Đối chiếu kho", href: "/tra-cuu/cam-tay?tab=kho" },
      { ten: "Hai bên biết gì", href: "/tra-cuu/cam-tay?tab=kho&goc=hai-ben" },
      { ten: "Tổng quan cầm tay", href: "/tra-cuu/cam-tay?tab=tong-quan" },
    ],
  },
  {
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
      { ten: "Bản tin", href: "/" },
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
          <BangCu />
          {children}
        </div>
      </body>
    </html>
  );
}
