import Link from "next/link";
import { getFreshness } from "@/lib/queries";

/**
 * Dải cảnh báo khi kho chưa đồng bộ kịp.
 *
 * Đặt ở layout chứ không ở từng màn: mọi con số trên hệ này đều đọc từ kho,
 * nên nguồn chết là CẢ BẢY màn cùng nói sai mà vẫn trông như thật. Trước đây
 * chỉ màn Hôm nay có dải này, và khi màn đó bị gộp thành một tab thì phần còn
 * lại của hệ mất luôn cảnh báo.
 *
 * Lỗi đọc kho thì im lặng: layout bọc mọi trang kể cả trang lỗi, ném ở đây là
 * không ai vào được chỗ nào nữa.
 */
export async function BangCu() {
  let cu: { source: string; table_name: string }[] = [];
  try {
    const rows = await getFreshness();
    cu = rows.filter(
      (f) =>
        f.lan_dong_bo_cuoi === null ||
        Number(f.gio_ke_tu_lan_cuoi) > Number(f.nguong_gio),
    );
  } catch {
    return null;
  }
  if (cu.length === 0) return null;

  const nguon = [...new Set(cu.map((f) => f.source))].join(", ");
  return (
    <p className="stale">
      <b>Số trên màn có thể đã cũ.</b> {cu.length} bảng chưa đồng bộ kịp (
      {nguon}). Mọi con số ở đây đọc từ kho, nên trước khi đối chiếu với CMS
      thì đồng bộ lại đã. <Link href="/dong-bo">Xem đồng bộ →</Link>
    </p>
  );
}
