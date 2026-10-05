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
      { ten: "Điểm nghẽn", href: "/diem-nghen" },
      { ten: "Việc hôm nay · cố định", href: "/viec-hom-nay/co-dinh" },
      { ten: "Việc hôm nay · cầm tay", href: "/viec-hom-nay/cam-tay" },
      { ten: "Cảnh báo vận hành", href: "/canh-bao" },
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
      { ten: "Hôm nay", href: "/hom-nay/cam-tay" },
      { ten: "Tổng quan", href: "/cam-tay" },
      { ten: "Vòng đời máy", href: "/cam-tay/vong-doi" },
      { ten: "Khách và dịch vụ", href: "/cam-tay/khach" },
      { ten: "Cước theo dịch vụ", href: "/cam-tay/dich-vu" },
      { ten: "Đợt thu cước", href: "/cam-tay/dot-thu" },
      { ten: "Tiền treo chưa gán", href: "/cam-tay/chua-can-tru" },
      { ten: "Huỷ thuê bao", href: "/cam-tay/huy" },
      { ten: "Máy cho thuê", href: "/cam-tay/may" },
      { ten: "Đối chiếu kho", href: "/cam-tay/kho" },
      { ten: "Hai bên biết gì", href: "/cam-tay/kho/hai-ben" },
    ],
  },
  {
    nhom: "Wifi cố định",
    muc: [
      { ten: "Hôm nay", href: "/hom-nay/co-dinh" },
      { ten: "Hợp đồng theo tháng", href: "/thang" },
      { ten: "Tiền theo tháng", href: "/thang/tien" },
      { ten: "Kỳ cước và dòng tiền", href: "/dong-tien" },
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
