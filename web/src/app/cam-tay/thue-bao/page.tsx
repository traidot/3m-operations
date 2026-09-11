import { redirect } from "next/navigation";

type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/**
 * Bảng phẳng cũ đã bỏ. Đường dẫn giữ lại cho link cũ còn chạy: chuyển hết về
 * trang gom theo khách, ?xem= thành ?hd= để ngăn kéo hoá đơn mở ngay trên đó
 * thay vì mở một trang trống trơn.
 */
export default async function Page({ searchParams }: { searchParams: Promise<Tham> }) {
  const xem = mot((await searchParams).xem);
  redirect(xem ? `/cam-tay/khach?hd=${encodeURIComponent(xem)}` : "/cam-tay/khach");
}
