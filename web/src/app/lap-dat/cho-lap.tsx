import { NganKeo } from "../ngan-keo";
import { BangDon } from "./bang-don";
import { getInstallPendingList } from "@/lib/queries";

export async function ChiTietChoLap({
  nhom,
  tenNhom,
  phuTrach,
  dongLai,
}: {
  nhom: string;
  tenNhom: string;
  /** "CONG_TY" | "DAI_LY" | "" — lọc của cả trang, áp luôn cho danh sách. */
  phuTrach: string;
  dongLai: string;
}) {
  const tatCa = await getInstallPendingList(nhom);
  const rows =
    phuTrach === "" ? tatCa : tatCa.filter((r) => r.do_cong_ty === (phuTrach === "CONG_TY"));
  const chuaLich = rows.filter((r) => r.tinh_huong === "CHUA_CO_LICH").length;

  return (
    <NganKeo dongLai={dongLai}>
      <h1>Đang chờ lắp · {tenNhom}</h1>
      <p className="muted">
        {rows.length.toLocaleString("vi-VN")} đơn đã ký, chưa lắp xong và chưa huỷ, trong đó{" "}
        {chuaLich.toLocaleString("vi-VN")} đơn chưa hẹn được ngày lắp. Xếp đơn chờ lâu nhất lên
        đầu.
      </p>

      <p className="actions">
        <a href={`/lap-dat/xuat?cho=${nhom}`} download>
          <button type="button">Xuất Excel</button>
        </a>
      </p>

      <BangDon rows={rows} />

      <p className="muted khoi-ghi-chu">
        “Số ngày” tính từ ngày ký tới hôm nay. Trung vị ký đến lắp xong của toàn hệ thống là 37
        ngày, p90 là 59 — nên quá 60 ngày tô đỏ.
      </p>
    </NganKeo>
  );
}
