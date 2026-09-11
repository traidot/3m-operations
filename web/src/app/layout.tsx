import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Giám sát 3M",
  description: "Bản tin vận hành, hai mảng wifi, marketing và thu cước",
};

/** Menu gom theo mảng kinh doanh, không phải theo thứ tự dựng trang. */
const MENU: { nhom: string; muc: { ten: string; href: string }[] }[] = [
  {
    nhom: "Wifi cầm tay",
    muc: [
      { ten: "Tổng quan", href: "/cam-tay" },
      { ten: "Khách và dịch vụ", href: "/cam-tay/khach" },
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
          <nav>
            <Link className="nav-chinh" href="/">
              Bản tin
            </Link>
            {MENU.map((g) => (
              <div key={g.nhom} className="nav-nhom">
                <span className="nav-ten-nhom">{g.nhom}</span>
                <span className="nav-muc">
                  {g.muc.map((m) => (
                    <Link key={m.href} href={m.href}>
                      {m.ten}
                    </Link>
                  ))}
                </span>
              </div>
            ))}
          </nav>
          {children}
        </div>
      </body>
    </html>
  );
}
