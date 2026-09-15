import Link from "next/link";
import { NganKeo } from "../ngan-keo";
import { BangDon } from "./bang-don";
import { getInstallCohort, type InstallOrder } from "@/lib/queries";

export const NHOM_LAP = {
  chua_lap: "Chưa lắp",
  lap_xong: "Lắp thành công",
  lap_hong: "Lắp thất bại",
  huy: "Huỷ",
  tat_ca: "Tất cả",
} as const;
export type NhomLap = keyof typeof NHOM_LAP;

/** Bảy tình huống của CMS gom về bốn nhóm để bấm cho nhanh. */
const TRONG_NHOM: Record<Exclude<NhomLap, "tat_ca">, string[]> = {
  chua_lap: ["CO_LICH", "CHUA_CO_LICH"],
  lap_xong: ["LAP_XONG"],
  lap_hong: ["LAP_HONG"],
  huy: ["HUY_TRUOC_LICH", "HUY_SAU_LICH", "HUY_SAU_LAP"],
};

const thuoc = (r: InstallOrder, nhom: NhomLap) =>
  nhom === "tat_ca" || TRONG_NHOM[nhom].includes(r.tinh_huong);

export async function ChiTietThangKy({
  ky,
  nhom,
  dongLai,
  linkNhom,
}: {
  ky: string;
  nhom: NhomLap;
  dongLai: string;
  linkNhom: (nhom: NhomLap) => string;
}) {
  const tatCa = await getInstallCohort(ky);
  const rows = tatCa.filter((r) => thuoc(r, nhom));
  const dem = (k: NhomLap) => tatCa.filter((r) => thuoc(r, k)).length;
  const chuaLich = tatCa.filter((r) => r.tinh_huong === "CHUA_CO_LICH").length;
  const choLau = tatCa.filter(
    (r) => thuoc(r, "chua_lap") && Number(r.so_ngay_cho) > 60,
  ).length;

  return (
    <NganKeo dongLai={dongLai}>
      <h1>Đơn ký tháng {ky}</h1>
      <p className="muted">
        {tatCa.length.toLocaleString("vi-VN")} đơn ·{" "}
        {dem("lap_xong").toLocaleString("vi-VN")} lắp thành công ·{" "}
        {dem("chua_lap").toLocaleString("vi-VN")} chưa lắp ({chuaLich.toLocaleString("vi-VN")}{" "}
        chưa có lịch) · {dem("huy").toLocaleString("vi-VN")} huỷ
      </p>

      <p className="actions">
        {(Object.keys(NHOM_LAP) as NhomLap[]).map((k) => (
          <Link key={k} href={linkNhom(k)} scroll={false}>
            <button type="button" className={nhom === k ? "primary" : undefined}>
              {NHOM_LAP[k]} · {dem(k).toLocaleString("vi-VN")}
            </button>
          </Link>
        ))}
        <a href={`/lap-dat/xuat?thang=${ky}`} download>
          <button type="button">Xuất Excel</button>
        </a>
      </p>

      {nhom === "chua_lap" && choLau > 0 && (
        <p className="stale">
          {choLau.toLocaleString("vi-VN")} đơn trong nhóm này đã chờ quá 60 ngày kể từ ngày ký —
          quá mốc p90 của toàn hệ thống, tức là bất thường chứ không phải nhịp bình thường.
        </p>
      )}

      <BangDon rows={rows} />

      <p className="muted khoi-ghi-chu">
        “Số ngày” tính từ ngày ký tới ngày lắp xong; đơn chưa lắp thì tính tới hôm nay. Trung vị
        toàn hệ thống là 37 ngày, nên đơn chờ quá 60 ngày được tô đỏ.
      </p>
    </NganKeo>
  );
}
