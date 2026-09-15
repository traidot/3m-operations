import Link from "next/link";
import { NganKeo } from "../ngan-keo";
import { Chip } from "../chip";
import { getHopDongThang, type HopDongThang } from "@/lib/queries";
import { HOP_DONG, KY_CUOC } from "@/lib/nhan";

/** Một tháng có tới hơn 3.000 hợp đồng; dựng hết vào ngăn kéo thì chậm. */
const TOI_DA = 500;

const n = (v: string | null) =>
  v === null ? "—" : Number(v).toLocaleString("vi-VN", { maximumFractionDigits: 0 });

export const NHOM_CD = {
  chua_ky: "Công ty, chưa ra kỳ cước",
  da_ngung: "Có kỳ cước, đã ngừng",
  dai_ly: "Của đại lý",
  tat_ca: "Tất cả",
} as const;
export type NhomCd = keyof typeof NHOM_CD;

/** Đại lý tự thu nên không có kỳ cước — để riêng, không trộn vào nhóm cần xử lý. */
const thuoc = (r: HopDongThang, nhom: NhomCd) => {
  if (nhom === "chua_ky") return r.dang_chay && r.do_cong_ty && !r.co_ky_cuoc;
  if (nhom === "da_ngung") return r.co_ky_cuoc && !r.dang_chay;
  if (nhom === "dai_ly") return r.dang_chay && !r.do_cong_ty;
  return true;
};

export async function ChiTietThangCoDinh({
  ky,
  nhom,
  dongLai,
  linkNhom,
}: {
  ky: string;
  nhom: NhomCd;
  dongLai: string;
  linkNhom: (nhom: NhomCd) => string;
}) {
  const tatCa = await getHopDongThang(ky);
  const rows = tatCa.filter((r) => thuoc(r, nhom));
  const dem = (k: NhomCd) => tatCa.filter((r) => thuoc(r, k)).length;
  const thieuGia = tatCa.filter(
    (r) => r.dang_chay && r.do_cong_ty && !r.co_ky_cuoc && r.thieu_gia,
  ).length;

  return (
    <NganKeo dongLai={dongLai}>
      <h1>Tháng {ky}</h1>
      <p className="muted">
        {tatCa.filter((r) => r.dang_chay && r.do_cong_ty).length.toLocaleString("vi-VN")} hợp đồng
        công ty đang chạy · {tatCa.filter((r) => r.co_ky_cuoc).length.toLocaleString("vi-VN")} có
        kỳ cước trong sổ ·{" "}
        {tatCa.filter((r) => r.dang_chay && !r.do_cong_ty).length.toLocaleString("vi-VN")} của đại lý
      </p>

      <p className="actions">
        {(Object.keys(NHOM_CD) as NhomCd[]).map((k) => (
          <Link key={k} href={linkNhom(k)} scroll={false}>
            <button type="button" className={nhom === k ? "primary" : undefined}>
              {NHOM_CD[k]} · {dem(k).toLocaleString("vi-VN")}
            </button>
          </Link>
        ))}
        {/* Thẻ a thường: trả về tệp tải xuống, không phải trang. */}
        <a href={`/cuoc/xuat?thang=${ky}`} download>
          <button type="button">Xuất Excel</button>
        </a>
      </p>

      {nhom === "chua_ky" && thieuGia > 0 && (
        <p className="stale">
          {thieuGia.toLocaleString("vi-VN")} hợp đồng trong nhóm này thiếu giá cước hoặc ngày bắt
          đầu thu, nên hệ thống không sinh được kỳ nào. Phải điền bên CMS thì mới thu được.
        </p>
      )}

      {rows.length === 0 ? (
        <p className="empty">Không có hợp đồng nào trong nhóm này.</p>
      ) : (
        <div className="scroller">
          <table>
            <thead>
              <tr>
                <th>Hợp đồng</th>
                <th>Địa chỉ</th>
                <th>Trạng thái</th>
                <th>Lắp xong → huỷ</th>
                <th className="num">Cước/tháng</th>
                <th>Kỳ tháng này</th>
                <th className="num">Phải thu</th>
                <th className="num">Đã thu</th>
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
                    {r.kho_doi && <span className="tag critical"> khó đòi</span>}
                  </td>
                  {/* Địa chỉ Nhật rất dài, cắt ở hai dòng; rê chuột xem đủ. */}
                  <td>
                    <span className="hai-dong" title={r.dia_chi ?? undefined}>
                      {r.dia_chi ?? "—"}
                    </span>
                  </td>
                  <td>
                    <Chip ma={r.trang_thai_hop_dong} nhan={HOP_DONG} />
                    <div>
                      <span className={`chip ${r.do_cong_ty ? "ctv" : "tat"}`}>
                        {r.do_cong_ty ? "công ty" : "đại lý"}
                      </span>
                    </div>
                    <div className="muted">{r.nguoi_tao ?? "—"}</div>
                  </td>
                  <td className="mono">
                    {r.ngay_lap_xong ?? "—"}
                    <div className="muted">→ {r.ngay_huy ?? "chưa huỷ"}</div>
                  </td>
                  <td className="num mono">
                    {r.thieu_gia ? <span className="bad">thiếu giá</span> : n(r.cuoc_thang)}
                  </td>
                  <td>
                    {r.trang_thai_ky
                      ? (KY_CUOC[r.trang_thai_ky] ?? r.trang_thai_ky)
                      : <span className="muted">không có kỳ</span>}
                  </td>
                  <td className="num mono">{n(r.phai_thu)}</td>
                  <td className="num mono">{n(r.da_thu)}</td>
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
          Đang bày {TOI_DA.toLocaleString("vi-VN")} / {rows.length.toLocaleString("vi-VN")} hợp đồng.
          Tải Excel để xem đủ.
        </p>
      )}
      <p className="muted khoi-ghi-chu">
        “Đang chạy” là hợp đồng đã lắp xong trước hết tháng và chưa huỷ trước đầu tháng. “Có kỳ cước”
        là có dòng trong sổ cước của tháng đó. Hợp đồng do công ty phụ trách mà đang chạy lại chưa ra
        kỳ cước là chỗ thất thu; hợp đồng của đại lý thì đại lý tự thu nên không có kỳ là bình thường.
      </p>
    </NganKeo>
  );
}
