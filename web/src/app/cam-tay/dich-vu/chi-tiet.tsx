import Link from "next/link";
import { NganKeo } from "../../ngan-keo";
import { Chip } from "../../chip";
import { getThueBaoThang, type ThueBaoThang } from "@/lib/queries";
import { DICH_VU, HOP_DONG } from "@/lib/nhan";

/** Một tháng có tới ~1.600 thuê bao; dựng hết vào ngăn kéo thì chậm và không ai đọc hết. */
const TOI_DA = 500;

const n = (v: string | null) =>
  v === null ? "—" : Number(v).toLocaleString("vi-VN", { maximumFractionDigits: 0 });

export const NHOM = {
  thieu: "Đang dùng, chưa có phiếu thu",
  thua: "Có phiếu thu, đã ngừng",
  tat_ca: "Tất cả",
} as const;
export type Nhom = keyof typeof NHOM;

const thuoc = (r: ThueBaoThang, nhom: Nhom) =>
  nhom === "thieu"
    ? r.dang_chay && !r.co_cuoc
    : nhom === "thua"
      ? r.co_cuoc && !r.dang_chay
      : true;

export async function ChiTietThang({
  ky,
  dichVu,
  nhom,
  dongLai,
  linkNhom,
}: {
  ky: string;
  dichVu?: string;
  nhom: Nhom;
  dongLai: string;
  linkNhom: (nhom: Nhom) => string;
}) {
  const tatCa = await getThueBaoThang(ky, dichVu);

  // Tháng chưa tới thì "đang chạy" chỉ là trạng thái hôm nay, so với cước đã xuất
  // trước là vô nghĩa — chỉ bày thuê bao có cước, không chia nhóm lệch.
  const thangNay = new Date().toLocaleDateString("sv-SE").slice(0, 7);
  const tuongLai = ky > thangNay;
  const nguon = tuongLai ? tatCa.filter((r) => r.co_cuoc) : tatCa;
  const dang = tuongLai ? "tat_ca" : nhom;
  const rows = nguon.filter((r) => thuoc(r, dang));
  const dem = (k: Nhom) => nguon.filter((r) => thuoc(r, k)).length;

  const dangChay = nguon.filter((r) => r.dang_chay).length;
  const coCuoc = nguon.filter((r) => r.co_cuoc).length;

  return (
    <NganKeo dongLai={dongLai}>
      <h1>
        Tháng {ky}
        {dichVu && ` · ${DICH_VU[dichVu] ?? dichVu}`}
      </h1>
      <p className="muted">
        {tuongLai
          ? `${coCuoc.toLocaleString("vi-VN")} thuê bao có phiếu thu. Tháng chưa tới nên chưa so được với số đang dùng.`
          : `${dangChay.toLocaleString("vi-VN")} thuê bao đang dùng · ${coCuoc.toLocaleString("vi-VN")} có phiếu thu`}
      </p>

      <p className="actions">
        {!tuongLai &&
          (Object.keys(NHOM) as Nhom[]).map((k) => (
            <Link key={k} href={linkNhom(k)} scroll={false}>
              <button type="button" className={dang === k ? "primary" : undefined}>
                {NHOM[k]} · {dem(k).toLocaleString("vi-VN")}
              </button>
            </Link>
          ))}
        {/* Thẻ a thường chứ không phải Link: trả về tệp tải xuống, không phải trang. */}
        <a
          href={`/cam-tay/dich-vu/xuat?thang=${ky}${dichVu ? `&tdv=${dichVu}` : ""}`}
          download
        >
          <button type="button">Xuất Excel</button>
        </a>
      </p>

      {rows.length === 0 ? (
        <p className="empty">Không có thuê bao nào trong nhóm này.</p>
      ) : (
        <div className="scroller">
          <table>
            <thead>
              <tr>
                <th>Thuê bao</th>
                <th>Khách</th>
                <th>Trạng thái</th>
                <th>Kích hoạt → ngừng</th>
                <th>Cước cuối</th>
                <th className="num">Phải thu</th>
                <th className="num">Đã thu</th>
                <th className="num">Chưa thu</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, TOI_DA).map((r) => (
                <tr key={r.subscription_id}>
                  <td className="mono">
                    <Link href={`/cam-tay/thue-bao?xem=${encodeURIComponent(r.subscription_id)}`}>
                      {r.subscription_id}
                    </Link>
                    {!dichVu && (
                      <div>
                        <span className="chip tat">{DICH_VU[r.dich_vu ?? ""] ?? r.dich_vu}</span>
                      </div>
                    )}
                  </td>
                  <td>
                    {r.khach ?? "—"}
                    <div className="mono muted">
                      {[r.ma_khach, r.goi].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </td>
                  <td>
                    <Chip ma={r.trang_thai} nhan={HOP_DONG} />
                  </td>
                  <td className="mono">
                    {r.kich_hoat ?? "—"}
                    <div className="muted">→ {r.ngung ?? "chưa ngừng"}</div>
                  </td>
                  <td className="mono">{r.cuoc_cuoi ?? "chưa từng có"}</td>
                  <td className="num mono">{n(r.phai_thu)}</td>
                  <td className="num mono">{n(r.da_thu)}</td>
                  <td className={`num mono${Number(r.chua_thu) > 0 ? " bad" : ""}`}>
                    {n(r.chua_thu)}
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
          Đang bày {TOI_DA.toLocaleString("vi-VN")} / {rows.length.toLocaleString("vi-VN")} thuê bao.
          Bấm dòng dịch vụ trên bảng để thu hẹp.
        </p>
      )}
      <p className="muted khoi-ghi-chu">
        Thuê bao đang dùng mà chưa có phiếu thu: cần xuất phiếu thu, hoặc chốt huỷ nếu khách
        đã ngừng. “Cước cuối” là tháng gần nhất có phiếu thu.
      </p>
    </NganKeo>
  );
}
