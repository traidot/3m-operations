import { NganKeo } from "../ngan-keo";
import { BangDon } from "./bang-don";
import { getInstallPendingList } from "@/lib/queries";

export const NHAN_CHO: Record<string, string> = {
  "1": "dưới 1 tuần",
  "2": "1–4 tuần",
  "3": "1–2 tháng",
  "4": "quá 2 tháng",
};

export async function ChiTietChoLap({
  nhom,
  phuTrach,
  dongLai,
}: {
  nhom: string;
  /** "CONG_TY" | "DAI_LY" | "" — lọc của cả trang, áp luôn cho danh sách. */
  phuTrach: string;
  dongLai: string;
}) {
  const tatCa = await getInstallPendingList(nhom);
  const rows =
    phuTrach === "" ? tatCa : tatCa.filter((r) => r.do_cong_ty === (phuTrach === "CONG_TY"));

  return (
    <NganKeo dongLai={dongLai}>
      <h1>Đang chờ lắp · {NHAN_CHO[nhom] ?? nhom}</h1>
      <p className="muted">
        {rows.length.toLocaleString("vi-VN")} đơn đã ký, đã qua khảo sát, chưa lắp xong và chưa
        huỷ. Xếp đơn chờ lâu nhất lên đầu.
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
