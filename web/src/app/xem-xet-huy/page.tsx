import Link from "next/link";
import { getCanHuy } from "@/lib/queries";
import { DICH_VU } from "@/lib/nhan";

export const dynamic = "force-dynamic";

const n = (v: string | null) => (v === null ? "—" : Number(v).toLocaleString("vi-VN"));

type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const NGUON: Record<string, string> = {
  FIXED: "wifi cố định",
  TELECOM: "wifi cầm tay",
};

/** Mỗi mảng có màn hình riêng, dẫn về đúng ngăn kéo của nó. */
function duongDan(nguon: string, id: string): string {
  return nguon === "FIXED"
    ? `/hop-dong?xem=${encodeURIComponent(id)}`
    : `/cam-tay/thue-bao?xem=${encodeURIComponent(id)}`;
}

export default async function Page({ searchParams }: { searchParams: Promise<Tham> }) {
  const sp = await searchParams;
  const nguon = mot(sp.nguon) in NGUON ? mot(sp.nguon) : "";
  const rows = await getCanHuy(nguon || undefined);

  const tong = rows.reduce((s, r) => s + Number(r.con_no), 0);
  const theoNguon = (k: string) => rows.filter((r) => r.nguon === k).length;

  return (
    <main>
      <h1>Dự kiến huỷ</h1>
      <p className="muted">
        Dịch vụ <b>còn đang chạy</b> mà đã quá hạn thu cước. Mốc biết được quá hạn hay
        chưa: wifi cầm tay là mùng 1 hàng tháng, wifi cố định là mùng 10. Xếp cái treo
        lâu nhất lên đầu. Dịch vụ đã huỷ rồi thì không có ở đây, và hợp đồng cố định đã
        trừ tiền cọc chờ duyệt — khách nộp rồi thì không đem ra cân nhắc cắt. Muốn xem
        từng khoản phải thu, kể cả cái chưa tới hạn, thì sang{" "}
        <Link href="/thu-cuoc">Thu cước</Link>.
      </p>

      <div className="the-hang">
        <div className="the-so">
          <div className="the-ten">Cần xem xét</div>
          <div className="the-gia-tri">{rows.length.toLocaleString("vi-VN")}</div>
          <div className="the-phu">
            {theoNguon("FIXED")} cố định · {theoNguon("TELECOM")} cầm tay
          </div>
        </div>
        <div className="the-so">
          <div className="the-ten">Nợ quá hạn</div>
          <div className="the-gia-tri">{tong.toLocaleString("vi-VN")}</div>
          <div className="the-phu">yên</div>
        </div>
      </div>

      <p className="actions">
        <Link href="/xem-xet-huy">
          <button type="button" className={nguon === "" ? "primary" : undefined}>
            Cả hai
          </button>
        </Link>
        {Object.entries(NGUON).map(([ma, ten]) => (
          <Link key={ma} href={`/xem-xet-huy?nguon=${ma}`}>
            <button type="button" className={nguon === ma ? "primary" : undefined}>
              {ten}
            </button>
          </Link>
        ))}
      </p>

      {rows.length === 0 ? (
        <p className="empty">Không có dịch vụ nào quá hạn.</p>
      ) : (
        <div className="scroller">
          <table>
            <thead>
              <tr>
                <th>Mảng</th>
                <th>Mã</th>
                <th>Khách · địa chỉ</th>
                <th>Gói</th>
                <th className="num">Cước/tháng</th>
                <th className="num">Nợ quá hạn</th>
                <th className="num">Kỳ nợ</th>
                <th>Nợ từ kỳ</th>
                <th className="num">Quá hạn</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.nguon}-${r.id}`}>
                  <td>
                    <span className={`chip ${r.nguon === "FIXED" ? "cam" : "ctv"}`}>
                      {NGUON[r.nguon] ?? r.nguon}
                    </span>
                  </td>
                  <td className="mono">
                    <Link href={duongDan(r.nguon, r.id)}>{r.ma ?? r.id}</Link>
                  </td>
                  <td>
                    {r.khach ?? "—"}
                    {r.kho_doi && <span className="tag critical"> khó đòi</span>}
                  </td>
                  <td className="muted">
                    {r.goi ?? DICH_VU[r.dich_vu ?? ""] ?? r.dich_vu ?? "—"}
                  </td>
                  <td className="num mono">{n(r.gia_thang)}</td>
                  <td className="num mono bad">{n(r.con_no)}</td>
                  <td className="num mono">{n(r.so_ky_no)}</td>
                  <td className="mono">{r.ky_no_cu_nhat ?? "—"}</td>
                  <td className="num mono">
                    {r.ngay_qua_han === null ? "—" : `${n(r.ngay_qua_han)} ngày`}
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

      <p className="muted khoi-ghi-chu">
        Đây là danh sách để cân nhắc, không phải lệnh cắt. Mọi thao tác huỷ đều làm bên
        CMS nguồn — lớp giám sát này chỉ đọc.
      </p>
    </main>
  );
}
