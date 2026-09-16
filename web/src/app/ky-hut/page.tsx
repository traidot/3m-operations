import Link from "next/link";
import { getKyHut, type KyHut } from "@/lib/queries";
import { KY_HUT, KY_HUT_MAT_TIEN, LY_DO_HUY } from "@/lib/nhan";

export const dynamic = "force-dynamic";

const n = (v: string | null) => (v === null ? "—" : Number(v).toLocaleString("vi-VN"));

type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const cong = (rows: KyHut[]) => rows.reduce((t, r) => t + Number(r.tien_le_ra), 0);

export default async function Page({ searchParams }: { searchParams: Promise<Tham> }) {
  const tatCa = await getKyHut();
  const loc = mot((await searchParams).tt);
  const rows = loc ? tatCa.filter((r) => r.trang_thai_so === loc) : tatCa;

  // Mất tiền lên trước, còn lại là đã xử lý xong theo cách khác.
  const nhom = [...new Set(tatCa.map((r) => r.trang_thai_so))].sort((a, b) => {
    const na = KY_HUT_MAT_TIEN.has(a) ? 0 : 1;
    const nb = KY_HUT_MAT_TIEN.has(b) ? 0 : 1;
    return na - nb || a.localeCompare(b);
  });
  const dem = (t: string) => tatCa.filter((r) => r.trang_thai_so === t);

  const matTien = tatCa.filter((r) => KY_HUT_MAT_TIEN.has(r.trang_thai_so));
  const link = (t?: string) => (t ? `/ky-hut?tt=${t}` : "/ky-hut");

  return (
    <main>
      <h1>Tháng chạy mà không ra kỳ cước</h1>
      <p className="muted">
        Hợp đồng bên nguồn có hai mốc rời nhau: <b>ngày kết thúc thu</b> và <b>ngày huỷ</b>.
        Khi mốc thu đóng trước, những tháng ở giữa khách vẫn dùng dịch vụ nhưng luật sinh kỳ
        không đẻ kỳ nào — nên quãng đó không nằm trong “phải thu”, cũng không nằm trong “còn
        thiếu”, không cột nào trên màn hình cước thấy nó. Đây là chỗ xem từng tháng một.
      </p>

      {tatCa.length === 0 ? (
        <p className="khop">✓ Không có tháng nào rơi vào khoảng lệch.</p>
      ) : (
        <>
          <div className="the-hang">
            <div className="the-so">
              <div className="the-ten">Chưa thu được đồng nào</div>
              <div className="the-gia-tri mono bad">
                {cong(matTien).toLocaleString("vi-VN")}
              </div>
              <div className="the-phu">
                {matTien.length.toLocaleString("vi-VN")} tháng ·{" "}
                {new Set(matTien.map((r) => r.subscription_id)).size.toLocaleString("vi-VN")} hợp
                đồng
              </div>
            </div>
            <div className="the-so">
              <div className="the-ten">Tổng khoảng lệch</div>
              <div className="the-gia-tri mono">{tatCa.length.toLocaleString("vi-VN")}</div>
              <div className="the-phu">
                tháng · {new Set(tatCa.map((r) => r.subscription_id)).size} hợp đồng ·{" "}
                {cong(tatCa).toLocaleString("vi-VN")} yên theo giá cước
              </div>
            </div>
          </div>

          <p className="actions">
            <Link href={link()}>
              <button type="button" className={loc === "" ? "primary" : undefined}>
                Tất cả · {tatCa.length}
              </button>
            </Link>
            {nhom.map((t) => (
              <Link key={t} href={link(t)}>
                <button type="button" className={loc === t ? "primary" : undefined}>
                  {KY_HUT[t] ?? t} · {dem(t).length}
                </button>
              </Link>
            ))}
          </p>

          <div className="scroller">
            <table>
              <thead>
                <tr>
                  <th>Hợp đồng</th>
                  <th>Tháng</th>
                  <th className="num">Giá cước</th>
                  <th>Sổ ghi gì</th>
                  <th>Khoảng lệch</th>
                  <th>Lý do huỷ</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.subscription_id}-${r.ky}`}>
                    <td className="mono">
                      <Link href={`/hop-dong?xem=${encodeURIComponent(r.subscription_id)}`}>
                        {r.ma_hop_dong ?? r.subscription_id}
                      </Link>
                      <div className="hai-dong muted" title={r.dia_chi ?? undefined}>
                        {r.dia_chi ?? "—"}
                      </div>
                    </td>
                    <td className="mono">{r.ky}</td>
                    <td
                      className={`num mono${
                        KY_HUT_MAT_TIEN.has(r.trang_thai_so) ? " bad" : " muted"
                      }`}
                    >
                      {n(r.tien_le_ra)}
                    </td>
                    <td>
                      <span
                        className={`chip ${
                          KY_HUT_MAT_TIEN.has(r.trang_thai_so) ? "xau" : "tat"
                        }`}
                      >
                        {KY_HUT[r.trang_thai_so] ?? r.trang_thai_so}
                      </span>
                    </td>
                    <td className="mono muted">
                      thu tới {r.fee_end_on ?? "—"}
                      <div>huỷ {r.ngay_huy ?? "—"} · lệch {n(r.so_ngay_lech)} ngày</div>
                    </td>
                    <td className="muted">
                      {r.nhom_ly_do_huy
                        ? (LY_DO_HUY[r.nhom_ly_do_huy] ?? r.nhom_ly_do_huy)
                        : "—"}
                    </td>
                    <td>
                      {r.link_cms && (
                        <a href={r.link_cms} target="_blank" rel="noreferrer">
                          <button type="button">Mở bên CMS →</button>
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="muted khoi-ghi-chu">
            “Giá cước” là số tiền của tháng đó theo hợp đồng, không phải số đã ghi trong sổ —
            sổ không có dòng nào thì không có số nào để lấy. Tháng “chỉ ghi chú” nghĩa là có
            người đụng vào nhưng không thu; đó là nhóm đông nhất, và cũng là nhóm dễ quên
            nhất vì nhìn trong CMS thì tháng đó trông như đã xử lý.
          </p>
        </>
      )}
    </main>
  );
}
