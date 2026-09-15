import Link from "next/link";
import { getThuNgoaiHopDong, type ThuNgoaiHopDong } from "@/lib/queries";
import {
  HOP_DONG,
  THU_NGOAI,
  THU_NGOAI_CACH_XU_LY,
  THU_NGOAI_NANG,
} from "@/lib/nhan";

export const dynamic = "force-dynamic";

const n = (v: string | null) => (v === null ? "—" : Number(v).toLocaleString("vi-VN"));

type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const cong = (rows: ThuNgoaiHopDong[]) => rows.reduce((t, r) => t + Number(r.tien), 0);

export default async function Page({ searchParams }: { searchParams: Promise<Tham> }) {
  const sp = await searchParams;
  const moiThu = await getThuNgoaiHopDong();
  // Lọc theo kỳ trước, để mấy nút tình huống bên dưới đếm trong phạm vi đang xem.
  const ky = /^\d{4}-\d{2}$/.test(mot(sp.ky)) ? mot(sp.ky) : "";
  const tatCa = ky ? moiThu.filter((r) => r.ky === ky) : moiThu;
  const loc = mot(sp.th);
  const rows = loc ? tatCa.filter((r) => r.tinh_huong === loc) : tatCa;

  // Nhóm nặng lên trước: đó là tiền phải trả lại hoặc đòi lại, không phải dọn dữ liệu.
  const nhom = [...new Set(tatCa.map((r) => r.tinh_huong ?? "KHAC"))].sort((a, b) => {
    const na = THU_NGOAI_NANG.has(a) ? 0 : 1;
    const nb = THU_NGOAI_NANG.has(b) ? 0 : 1;
    return na - nb || a.localeCompare(b);
  });
  const dem = (t: string) => tatCa.filter((r) => r.tinh_huong === t);

  const link = (t?: string) => {
    const p = new URLSearchParams();
    if (ky) p.set("ky", ky);
    if (t) p.set("th", t);
    const duoi = p.toString();
    return duoi ? `/thu-ngoai?${duoi}` : "/thu-ngoai";
  };

  return (
    <main>
      <h1>Kỳ thu ngoài hợp đồng{ky && ` · kỳ ${ky}`}</h1>
      <p className="muted">
        Kỳ đã thu tiền thật nhưng rơi ra ngoài khoảng thu ghi trên hợp đồng — đối chiếu giữa sổ
        cước bên CMS và ngày bắt đầu thu, ngày kết thúc thu, ngày lắp xong, ngày huỷ của chính
        hợp đồng đó. Khách trả trước cho tháng tương lai <b>không</b> nằm ở đây: kỳ đó vẫn trong
        khoảng hợp đồng, chỉ là xa hơn mốc sinh kỳ của mình. Hợp đồng của đại lý cũng không:
        đại lý tự thu nên mình không quản cước của họ.
      </p>

      {ky && (
        <p className="actions">
          <Link href="/thu-ngoai">
            <button type="button">← Xem tất cả các kỳ ({moiThu.length})</button>
          </Link>
        </p>
      )}

      {tatCa.length === 0 ? (
        <p className="khop">
          ✓ Không có kỳ nào thu ngoài khoảng hợp đồng{ky && ` trong kỳ ${ky}`}.
        </p>
      ) : (
        <>
          <div className="the-hang">
            <div className="the-so">
              <div className="the-ten">Tiền sai chỗ</div>
              <div className="the-gia-tri mono bad">
                {cong(tatCa.filter((r) => THU_NGOAI_NANG.has(r.tinh_huong ?? ""))).toLocaleString(
                  "vi-VN",
                )}
              </div>
              <div className="the-phu">phải hoàn hoặc đòi lại</div>
            </div>
            <div className="the-so">
              <div className="the-ten">Tổng kỳ</div>
              <div className="the-gia-tri mono">{tatCa.length.toLocaleString("vi-VN")}</div>
              <div className="the-phu">
                {new Set(tatCa.map((r) => r.subscription_id)).size.toLocaleString("vi-VN")} hợp
                đồng · {cong(tatCa).toLocaleString("vi-VN")} yên
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
                  {THU_NGOAI[t] ?? t} · {dem(t).length}
                </button>
              </Link>
            ))}
          </p>

          {loc && THU_NGOAI_CACH_XU_LY[loc] && (
            <p className={THU_NGOAI_NANG.has(loc) ? "stale" : "muted"}>
              {THU_NGOAI_CACH_XU_LY[loc]}
            </p>
          )}

          <div className="scroller">
            <table>
              <thead>
                <tr>
                  <th>Hợp đồng</th>
                  <th>Kỳ đã thu</th>
                  <th className="num">Tiền</th>
                  <th>Tình huống</th>
                  <th>Khoảng thu của hợp đồng</th>
                  <th>Người nhập</th>
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
                    <td className="mono">
                      {r.ky}
                      <div className="muted">thu {r.ngay_thu ?? "—"}</div>
                    </td>
                    <td className="num mono bad">{n(r.tien)}</td>
                    <td>
                      <span
                        className={`chip ${THU_NGOAI_NANG.has(r.tinh_huong ?? "") ? "tat" : "cam"}`}
                      >
                        {THU_NGOAI[r.tinh_huong ?? ""] ?? r.tinh_huong ?? "—"}
                      </span>
                      <div className="mono muted">
                        {HOP_DONG[r.trang_thai_hop_dong] ?? r.trang_thai_hop_dong}
                        {r.ngay_huy && ` ${r.ngay_huy}`}
                      </div>
                    </td>
                    <td className="mono muted">
                      {r.fee_start_on ?? "—"} → {r.fee_end_on ?? "chưa đặt"}
                      <div>lắp xong {r.ngay_lap_xong ?? "—"}</div>
                    </td>
                    <td className="muted">
                      {r.nguoi_nhap ?? "—"}
                      <div className="mono">{r.kenh ?? "—"}</div>
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
            Lớp giám sát này chỉ đọc, không sửa được gì bên nguồn — mọi thao tác phải làm trong
            CMS. Sau khi sửa bên đó, đồng bộ lại là dòng ở đây tự biến mất.
          </p>
        </>
      )}
    </main>
  );
}
