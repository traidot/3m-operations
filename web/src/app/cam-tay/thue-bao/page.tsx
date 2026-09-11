import { redirect } from "next/navigation";
import { ChiTietThueBao } from "./chi-tiet";

export const dynamic = "force-dynamic";

type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/**
 * Bảng phẳng cũ đã bỏ: một khách dùng nhiều dịch vụ thì hiện ra nhiều lần, hai
 * danh sách song song chỉ gây lẫn. Đường dẫn giữ lại để mở ngăn kéo hoá đơn
 * của một thuê bao, còn lại chuyển hết về trang gom theo khách.
 */
export default async function Page({ searchParams }: { searchParams: Promise<Tham> }) {
  const sp = await searchParams;
  const xem = mot(sp.xem);
  if (!xem) redirect("/cam-tay/khach");

  return (
    <main>
      <h1>Hoá đơn thuê bao</h1>
      <p className="muted">
        Quay lại <a href="/cam-tay/khach">Khách và dịch vụ</a>.
      </p>
      <ChiTietThueBao id={xem} dongLai="/cam-tay/khach" />
    </main>
  );
}
