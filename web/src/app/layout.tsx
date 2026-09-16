import type { Metadata } from "next";
import { Nav, type NhomMenu } from "./nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Giám sát 3M",
  description: "Bản tin vận hành, hai mảng wifi, marketing và thu cước",
};

/** Menu gom theo mảng kinh doanh, không phải theo thứ tự dựng trang. */
const MENU: NhomMenu[] = [
  {
    // Hai danh sách việc phải làm, gom riêng: chúng cắt ngang cả hai mảng chứ
    // không thuộc mảng nào.
    nhom: "Cần xử lý",
    muc: [
      { ten: "Thu cước", href: "/thu-cuoc" },
      { ten: "Dự kiến huỷ", href: "/xem-xet-huy" },
      { ten: "Cọc", href: "/cam-tay/coc" },
      { ten: "Thu ngoài hợp đồng", href: "/thu-ngoai" },
      { ten: "Tháng không ra kỳ", href: "/ky-hut" },
    ],
  },
  {
    nhom: "Wifi cầm tay",
    muc: [
      { ten: "Tổng quan", href: "/cam-tay" },
      { ten: "Khách và dịch vụ", href: "/cam-tay/khach" },
      { ten: "Cước theo dịch vụ", href: "/cam-tay/dich-vu" },
      { ten: "Máy cho mượn", href: "/may-muon" },
    ],
  },
  {
    nhom: "Wifi cố định",
    muc: [
      { ten: "Báo cáo", href: "/thang" },
      { ten: "Hợp đồng", href: "/hop-dong" },
      { ten: "Lắp đặt", href: "/lap-dat" },
      { ten: "Cước", href: "/cuoc" },
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
