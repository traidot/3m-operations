import Link from "next/link";
import { NganKeo } from "../ngan-keo";
import { BangDon } from "./bang-don";
import { getInstallCohort, type InstallOrder } from "@/lib/queries";


export const NHOM_LAP = {
  cho_lap: "Còn chờ lắp",
  da_lap: "Đã lắp xong",
  huy: "Huỷ trước khi lắp",
  tat_ca: "Tất cả",
} as const;
export type NhomLap = keyof typeof NHOM_LAP;

const thuoc = (r: InstallOrder, nhom: NhomLap) => {
  if (nhom === "cho_lap") return r.tinh_huong === "CHO_LAP";
  if (nhom === "da_lap") return r.tinh_huong === "DA_LAP" || r.tinh_huong === "LAP_ROI_HUY";
  if (nhom === "huy") return r.tinh_huong === "HUY_TRUOC_LAP" || r.tinh_huong === "LAP_HONG";
  return true;
};

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
  const choLau = tatCa.filter((r) => r.tinh_huong === "CHO_LAP" && Number(r.so_ngay_cho) > 60).length;

  return (
    <NganKeo dongLai={dongLai}>
      <h1>Đơn ký tháng {ky}</h1>
      <p className="muted">
        {tatCa.length.toLocaleString("vi-VN")} đơn · {dem("da_lap").toLocaleString("vi-VN")} đã lắp ·{" "}
        {dem("cho_lap").toLocaleString("vi-VN")} còn chờ · {dem("huy").toLocaleString("vi-VN")} huỷ
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

      {nhom === "cho_lap" && choLau > 0 && (
        <p className="stale">
          {choLau.toLocaleString("vi-VN")} đơn trong nhóm này đã chờ quá 60 ngày kể từ ngày ký —
          quá mốc p90 của toàn hệ thống, tức là bất thường chứ không phải nhịp bình thường.
        </p>
      )}

      <BangDon rows={rows} />

      <p className="muted khoi-ghi-chu">
        “Số ngày” tính từ ngày ký tới ngày lắp xong; đơn còn chờ thì tính tới hôm nay. Trung vị
        toàn hệ thống là 37 ngày, nên đơn chờ quá 60 ngày được tô đỏ.
      </p>
    </NganKeo>
  );
}
