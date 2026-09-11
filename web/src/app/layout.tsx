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
    nhom: "Wifi cầm tay",
    muc: [
      { ten: "Tổng quan", href: "/cam-tay" },
      { ten: "Khách và dịch vụ", href: "/cam-tay/khach" },
      { ten: "Cọc cần xử lý", href: "/cam-tay/coc" },
      { ten: "Máy cho mượn", href: "/may-muon" },
    ],
  },
  {
    nhom: "Wifi cố định",
    muc: [
      { ten: "Báo cáo", href: "/thang" },
      { ten: "Hợp đồng", href: "/hop-dong" },
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
