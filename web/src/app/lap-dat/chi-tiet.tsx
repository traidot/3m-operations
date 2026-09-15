import Link from "next/link";
import { NganKeo } from "../ngan-keo";
import { getInstallCohort, type InstallOrder } from "@/lib/queries";
import { LY_DO_HUY, TINH_HUONG_LAP } from "@/lib/nhan";

const TOI_DA = 500;

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

      {rows.length === 0 ? (
        <p className="empty">Không có đơn nào trong nhóm này.</p>
      ) : (
        <div className="scroller">
          <table>
            <thead>
              <tr>
                <th>Hợp đồng</th>
                <th>Địa chỉ</th>
                <th>Tình huống</th>
                <th>Ngày ký</th>
                <th>Lắp xong</th>
                <th className="num">Số ngày</th>
                <th>Lý do huỷ</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, TOI_DA).map((r) => (
                <tr key={r.subscription_id}>
                  <td className="mono">
                    <Link href={`/hop-dong?xem=${encodeURIComponent(r.subscription_id)}`}>
                      {r.ma_hop_dong ?? r.subscription_id}
                    </Link>
                    <div className="muted">{r.nguoi_tao ?? "—"}</div>
                  </td>
                  <td>
                    <span className="hai-dong" title={r.dia_chi ?? undefined}>
                      {r.dia_chi ?? "—"}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`chip ${
                        r.tinh_huong === "DA_LAP"
                          ? "ok"
                          : r.tinh_huong === "CHO_LAP"
                            ? "cho"
                            : "tat"
                      }`}
                    >
                      {TINH_HUONG_LAP[r.tinh_huong] ?? r.tinh_huong}
                    </span>
                    <div>
                      <span className={`chip ${r.do_cong_ty ? "ctv" : "tat"}`}>
                        {r.do_cong_ty ? "công ty" : "đại lý"}
                      </span>
                    </div>
                  </td>
                  <td className="mono">{r.ngay_ky ?? "—"}</td>
                  <td className="mono">{r.ngay_lap_xong ?? "—"}</td>
                  <td
                    className={`num mono${
                      r.tinh_huong === "CHO_LAP" && Number(r.so_ngay_cho) > 60 ? " bad" : ""
                    }`}
                  >
                    {r.so_ngay_cho ?? "—"}
                  </td>
                  <td className="muted">
                    {r.nhom_ly_do_huy ? (LY_DO_HUY[r.nhom_ly_do_huy] ?? r.nhom_ly_do_huy) : "—"}
                  </td>
                  <td>
                    {r.link_cms && (
                      <a href={r.link_cms} target="_blank" rel="noreferrer">
                        CMS ↗
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > TOI_DA && (
        <p className="muted">
          Đang bày {TOI_DA.toLocaleString("vi-VN")} / {rows.length.toLocaleString("vi-VN")} đơn.
          Tải Excel để xem đủ.
        </p>
      )}
      <p className="muted khoi-ghi-chu">
        “Số ngày” tính từ ngày ký tới ngày lắp xong; đơn còn chờ thì tính tới hôm nay. Trung vị
        toàn hệ thống là 37 ngày, nên đơn chờ quá 60 ngày được tô đỏ.
      </p>
    </NganKeo>
  );
}
