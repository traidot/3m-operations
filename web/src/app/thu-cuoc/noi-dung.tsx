import Link from "next/link";
import { getDifficultDebt, getKhoanThu, getThuCuocTomTat } from "@/lib/queries";
import { HOP_DONG } from "@/lib/nhan";
import { Chip } from "../chip";
import { DICH_VU, KY_CUOC } from "@/lib/nhan";
import { them } from "../duong-dan";

const n = (v: string | null) =>
  v === null ? "—" : Number(v).toLocaleString("vi-VN");

type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? "";

const NGUON: Record<string, string> = {
  FIXED: "wifi cố định",
  TELECOM: "wifi cầm tay",
};

const LOAI_HOA_DON: Record<string, string> = {
  SUBSCRIPTION: "cước tháng",
  ORDER: "đơn hàng",
  OTHER: "thu khác",
};

function duongDan(nguon: string, id: string): string {
  return nguon === "FIXED"
    ? `/tra-cuu/co-dinh?xem=${encodeURIComponent(id)}`
    : `/cam-tay/thue-bao?xem=${encodeURIComponent(id)}`;
}

export async function NoiDungThuCuoc({
  searchParams,
  khoaNguon,
  moTai,
}: {
  searchParams: Promise<Tham>;
  /** Màn chứa đã chọn mảng rồi thì khoá lại và giấu hàng nút chọn mảng —
   *  để hở thì bấm vào không ăn, vì màn ngoài ép lại ngay. */
  khoaNguon?: string;
  /** Đường dẫn màn chứa, để các nút lọc còn lại trỏ về đúng chỗ. */
  moTai?: string;
}) {
  const sp = await searchParams;
  const nguon = khoaNguon ?? (mot(sp.nguon) in NGUON ? mot(sp.nguon) : "");
  const chiQuaHan = mot(sp.qh) === "1";

  const [rows, tomTat, khoDoi] = await Promise.all([
    getKhoanThu(nguon || undefined, chiQuaHan),
    getThuCuocTomTat(),
    getDifficultDebt(),
  ]);

  // Khoá mảng thì các thẻ cũng phải theo mảng đó. Để nguyên thì tiêu đề ghi
  // "wifi cố định" mà thẻ "quá hạn" cộng cả cầm tay, lệch gần gấp đôi.
  const cong = (loc: (t: (typeof tomTat)[number]) => boolean) =>
    tomTat
      .filter((t) => khoaNguon === undefined || t.nguon === khoaNguon)
      .filter(loc)
      .reduce(
        (s, t) => ({
          khoan: s.khoan + Number(t.so_khoan),
          tien: s.tien + Number(t.tien),
        }),
        { khoan: 0, tien: 0 },
      );
  const hop = (v: { khoan: number; tien: number }) =>
    `${v.khoan.toLocaleString("vi-VN")} khoản · ${v.tien.toLocaleString("vi-VN")} yên`;

  const link = (t: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(t)) if (v) p.set(k, v);
    const duoi = p.toString();
    const goc = moTai ?? "/thu-cuoc";
    return duoi ? them(goc, duoi) : goc;
  };

  return (
    <>
      <p className="muted">
        Từng khoản còn phải thu, xếp theo hạn — cái quá hạn lâu nhất lên đầu,
        rồi tới cái sắp tới hạn. Hạn của wifi cầm tay là mùng 1 của tháng dùng.
        Wifi cố định thì <b>tính tới hết tháng hiện tại</b>: kỳ tháng này chưa
        có phiếu thu đã duyệt là vào danh sách ngay, không chờ mùng 10 tháng
        sau. Hoàn tiền cho khách không nằm ở đây vì đó là khoản 3M phải trả,
        không phải khoản đi thu.
      </p>

      <div className="the-hang">
        <div className="the-so">
          <div className="the-ten">Quá hạn</div>
          <div className="the-gia-tri">
            {cong((t) => t.qua_han).tien.toLocaleString("vi-VN")}
          </div>
          <div className="the-phu">{hop(cong((t) => t.qua_han))}</div>
        </div>
        <div className="the-so">
          <div className="the-ten">Chưa tới hạn</div>
          <div className="the-gia-tri">
            {cong((t) => !t.qua_han).tien.toLocaleString("vi-VN")}
          </div>
          <div className="the-phu">{hop(cong((t) => !t.qua_han))}</div>
        </div>
        {khoaNguon === undefined && (
          <>
            <div className="the-so">
              <div className="the-ten">Wifi cố định</div>
              <div className="the-gia-tri">
                {cong((t) => t.nguon === "FIXED").tien.toLocaleString("vi-VN")}
              </div>
              <div className="the-phu">
                {hop(cong((t) => t.nguon === "FIXED"))}
              </div>
            </div>
            <div className="the-so">
              <div className="the-ten">Wifi cầm tay</div>
              <div className="the-gia-tri">
                {cong((t) => t.nguon === "TELECOM").tien.toLocaleString(
                  "vi-VN",
                )}
              </div>
              <div className="the-phu">
                {hop(cong((t) => t.nguon === "TELECOM"))}
              </div>
            </div>
          </>
        )}
      </div>

      <p className="actions">
        {khoaNguon === undefined && (
          <>
            <Link href={link({ qh: chiQuaHan ? "1" : undefined })}>
              <button
                type="button"
                className={nguon === "" ? "primary" : undefined}
              >
                Cả hai mảng
              </button>
            </Link>
            {Object.entries(NGUON).map(([ma, ten]) => (
              <Link
                key={ma}
                href={link({ nguon: ma, qh: chiQuaHan ? "1" : undefined })}
              >
                <button
                  type="button"
                  className={nguon === ma ? "primary" : undefined}
                >
                  {ten}
                </button>
              </Link>
            ))}
          </>
        )}
        <Link
          href={link({
            nguon: nguon || undefined,
            qh: chiQuaHan ? undefined : "1",
          })}
        >
          <button type="button" className={chiQuaHan ? "primary" : undefined}>
            {chiQuaHan ? "✓ chỉ quá hạn" : "chỉ quá hạn"}
          </button>
        </Link>
      </p>

      {rows.length === 0 ? (
        <p className="empty">Không có khoản nào phải thu.</p>
      ) : (
        <div className="scroller">
          <table>
            <thead>
              <tr>
                <th>Mảng</th>
                <th>Mã</th>
                <th>Khách · địa chỉ</th>
                <th>Kỳ</th>
                <th>Loại</th>
                <th className="num">Tiền</th>
                <th>Hạn</th>
                <th className="num">Trễ</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.nguon}-${r.so_hoa_don ?? r.id}-${r.ky}`}>
                  <td>
                    <span
                      className={`chip ${r.nguon === "FIXED" ? "cam" : "ctv"}`}
                    >
                      {NGUON[r.nguon] ?? r.nguon}
                    </span>
                  </td>
                  <td className="mono">
                    <Link href={duongDan(r.nguon, r.id)}>{r.ma ?? r.id}</Link>
                    {r.so_hoa_don && (
                      <div className="muted">{r.so_hoa_don}</div>
                    )}
                  </td>
                  <td>
                    {r.khach ?? "—"}
                    {r.kho_doi && (
                      <span className="tag critical"> khó đòi</span>
                    )}
                  </td>
                  <td className="mono">{r.ky ?? "—"}</td>
                  <td className="muted">
                    {r.loai_hoa_don
                      ? (LOAI_HOA_DON[r.loai_hoa_don] ?? r.loai_hoa_don)
                      : r.tinh_trang && r.tinh_trang !== "NO"
                        ? (KY_CUOC[r.tinh_trang] ?? r.tinh_trang)
                        : (DICH_VU[r.dich_vu ?? ""] ?? "—")}
                  </td>
                  <td className={`num mono${r.qua_han ? " bad" : ""}`}>
                    {n(r.tien)}
                  </td>
                  <td className="mono">{r.han_tra ?? "—"}</td>
                  <td className={`num mono${r.qua_han ? " bad" : ""}`}>
                    {r.qua_han ? `${n(r.ngay_le)} ngày` : "—"}
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

      <h2>Khách khó đòi</h2>
      <p className="muted">
        Kế toán đánh dấu tay bên hệ thống nguồn, không suy ra từ số kỳ nợ — nên
        có hợp đồng đang nợ 0 đồng vẫn nằm đây, và ngược lại hợp đồng nợ nặng
        chưa chắc đã bị đánh dấu. Đây là danh sách hiện tại, không có trục thời
        gian.
      </p>
      {khoDoi.length === 0 ? (
        <p className="empty">Chưa hợp đồng nào bị đánh dấu khó đòi.</p>
      ) : (
        <div className="scroller">
          <table>
            <thead>
              <tr>
                <th>Hợp đồng</th>
                <th>Trạng thái</th>
                <th>Thu tới kỳ</th>
                <th className="num">Kỳ nợ</th>
                <th className="num">Còn nợ</th>
              </tr>
            </thead>
            <tbody>
              {khoDoi.map((k) => (
                <tr key={k.subscription_id}>
                  <td className="mono">
                    <Link href={`/tra-cuu/co-dinh?xem=${k.subscription_id}`}>
                      {k.contract_code ?? "—"}
                    </Link>
                  </td>
                  <td>
                    <Chip ma={k.trang_thai_hop_dong} nhan={HOP_DONG} />
                  </td>
                  <td className="mono">
                    {k.ky_da_thu_gan_nhat ?? "chưa thu kỳ nào"}
                  </td>
                  <td
                    className={`num mono${Number(k.so_ky_no) > 0 ? " bad" : ""}`}
                  >
                    {n(k.so_ky_no)}
                  </td>
                  <td
                    className={`num mono${Number(k.con_no) > 0 ? " bad" : ""}`}
                  >
                    {n(k.con_no)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="muted khoi-ghi-chu">
        “Chờ duyệt” và “chỉ ghi chú” bên wifi cố định là kỳ chưa ai chốt là thu
        hay miễn — vẫn nằm trong danh sách vì tiền chưa vào. Bảng cắt ở 500
        dòng; lọc theo mảng hoặc “chỉ quá hạn” để thu hẹp.
      </p>
    </>
  );
}
