import Link from "next/link";
import type { InstallOrder } from "@/lib/queries";
import { LY_DO_HUY, TINH_HUONG_LAP } from "@/lib/nhan";

/** Một tháng ký có tới gần 900 đơn; dựng hết vào ngăn kéo thì chậm. */
export const TOI_DA_DON = 500;

const MAU: Record<string, string> = {
  LAP_XONG: "ok",
  CO_LICH: "cho",
  CHUA_CO_LICH: "cam",
};

/** Đơn chưa lắp mới cần đếm ngày chờ; đơn đã xong hay đã huỷ thì số ngày là lịch sử. */
const CHUA_LAP = new Set(["CO_LICH", "CHUA_CO_LICH"]);

/** Bảng đơn lắp, dùng chung cho ngăn kéo theo tháng ký và ngăn kéo đang chờ lắp. */
export function BangDon({ rows }: { rows: InstallOrder[] }) {
  if (rows.length === 0) return <p className="empty">Không có đơn nào trong nhóm này.</p>;

  return (
    <>
      <div className="scroller">
        <table>
          <thead>
            <tr>
              <th>Hợp đồng</th>
              <th>Địa chỉ</th>
              <th>Tình huống</th>
              <th>Ngày ký</th>
              <th>Lịch lắp</th>
              <th>Lắp xong</th>
              <th className="num">Số ngày</th>
              <th>Lý do huỷ</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, TOI_DA_DON).map((r) => (
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
                  <span className={`chip ${MAU[r.tinh_huong] ?? "tat"}`}>
                    {TINH_HUONG_LAP[r.tinh_huong] ?? r.tinh_huong}
                  </span>
                  <div>
                    <span className={`chip ${r.do_cong_ty ? "ctv" : "tat"}`}>
                      {r.do_cong_ty ? "công ty" : "đại lý"}
                    </span>
                  </div>
                </td>
                <td className="mono">{r.ngay_ky ?? "—"}</td>
                <td className="mono muted">{r.ngay_hen ?? "—"}</td>
                <td className="mono">{r.ngay_lap_xong ?? "—"}</td>
                <td
                  className={`num mono${
                    CHUA_LAP.has(r.tinh_huong) && Number(r.so_ngay_cho) > 60 ? " bad" : ""
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

      {rows.length > TOI_DA_DON && (
        <p className="muted">
          Đang bày {TOI_DA_DON.toLocaleString("vi-VN")} / {rows.length.toLocaleString("vi-VN")} đơn.
          Tải Excel để xem đủ.
        </p>
      )}
    </>
  );
}
