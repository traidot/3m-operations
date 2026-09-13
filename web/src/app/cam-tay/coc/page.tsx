import Link from "next/link";
import { Chip, ChipLoaiKhach } from "../../chip";
import {
  CONTRACTS_PER_PAGE,
  countDeposits,
  getDepositSummary,
  getDeposits,
} from "@/lib/queries";
import { COC, DICH_VU, HOP_DONG, MAY, NHOM_COC, NHOM_COC_VIEC } from "@/lib/nhan";

export const dynamic = "force-dynamic";

const n = (v: string | null) => (v === null ? "—" : Number(v).toLocaleString("vi-VN"));

type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function Page({ searchParams }: { searchParams: Promise<Tham> }) {
  const sp = await searchParams;
  const nhom = NHOM_COC_VIEC.includes(mot(sp.nhom)) ? mot(sp.nhom) : "";
  const trang = Math.max(1, Number(mot(sp.trang)) || 1);

  const [tomTat, rows, tong] = await Promise.all([
    getDepositSummary(),
    getDeposits(nhom, trang),
    countDeposits(nhom),
  ]);

  const theoNhom = new Map(tomTat.map((t) => [t.nhom, t]));
  const soTrang = Math.max(1, Math.ceil(tong.so / CONTRACTS_PER_PAGE));
  const link = (t: Record<string, string>) => `/cam-tay/coc?${new URLSearchParams(t)}`;

  return (
    <main>
      <h1>Cọc cần xử lý</h1>
      <p className="muted">
        Máy đang gắn vào thuê bao mà tiền cọc chưa chốt. “Còn giữ” nghĩa là 3M đang cầm
        tiền cọc, chưa hoàn cho khách cũng chưa quyết giữ luôn — với máy đang thuê thì đó
        là bình thường, chỉ thành việc khi thuê bao đã ngừng hoặc máy đã bị đánh dấu chưa
        trả.
      </p>

      <div className="the-hang">
        {NHOM_COC_VIEC.map((k) => {
          const t = theoNhom.get(k);
          const dang = nhom === k;
          return (
            <Link key={k} href={dang ? "/cam-tay/coc" : link({ nhom: k })} className="the-so">
              <div className="the-ten">
                {NHOM_COC[k]}
                {dang && " ·  đang lọc"}
              </div>
              <div className="the-gia-tri mono bad">{n(t?.tien ?? "0")}</div>
              <div className="the-phu mono">
                {n(t?.so_may ?? "0")} máy · treo lâu nhất {n(t?.treo_lau_nhat ?? null)} ngày
              </div>
            </Link>
          );
        })}
        <div className="the-so">
          <div className="the-ten">{NHOM_COC.DANG_THUE}</div>
          <div className="the-gia-tri mono">{n(theoNhom.get("DANG_THUE")?.tien ?? "0")}</div>
          <div className="the-phu mono">
            {n(theoNhom.get("DANG_THUE")?.so_may ?? "0")} máy · chưa phải việc
          </div>
        </div>
      </div>

      <h2>
        {n(String(tong.so))} máy · {n(tong.tien)} yên
        {nhom ? ` — ${NHOM_COC[nhom]}` : " — cả ba nhóm cần xử lý"}
        {soTrang > 1 ? ` · trang ${trang}/${soTrang}` : ""}
      </h2>

      {rows.length === 0 ? (
        <p className="empty">Không có máy nào trong nhóm này.</p>
      ) : (
        <div className="scroller">
          <table>
            <thead>
              <tr>
                <th>IMEI</th>
                <th>Khách</th>
                <th>Dịch vụ</th>
                <th>Thuê bao</th>
                <th>Máy</th>
                <th className="num">Cọc</th>
                <th className="num">Treo</th>
                <th>Việc</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.imei}-${r.subscription_id}`}>
                  <td className="mono">
                    {r.imei}
                    {r.ngay_thue && <div className="muted">thuê {r.ngay_thue}</div>}
                  </td>
                  <td>
                    {r.party_id ? (
                      <Link href={`/cam-tay/khach?xem=${r.party_id}`}>{r.khach}</Link>
                    ) : (
                      r.khach
                    )}
                    <div><ChipLoaiKhach ma={r.loai_khach} /></div>
                  </td>
                  <td>{DICH_VU[r.service_type ?? ""] ?? r.service_type ?? "—"}</td>
                  <td>
                    {r.trang_thai_thue_bao && (
                      <Chip ma={r.trang_thai_thue_bao} nhan={HOP_DONG} />
                    )}
                    {r.ngay_ngung && <div className="muted">ngừng {r.ngay_ngung}</div>}
                  </td>
                  <td>
                    {r.trang_thai_may ? (
                      <Chip ma={r.trang_thai_may} nhan={MAY} />
                    ) : (
                      <span className="muted">không có phiếu</span>
                    )}
                  </td>
                  <td className="num mono">
                    {n(r.coc)}
                    {r.trang_thai_coc && (
                      <div className="muted">{COC[r.trang_thai_coc] ?? r.trang_thai_coc}</div>
                    )}
                  </td>
                  <td className={`num mono${Number(r.so_ngay_treo ?? 0) > 180 ? " bad" : ""}`}>
                    {n(r.so_ngay_treo)}
                  </td>
                  <td>
                    <Link href={link({ nhom: r.nhom })}>{NHOM_COC[r.nhom] ?? r.nhom}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {soTrang > 1 && (
        <div className="actions">
          {trang > 1 && (
            <Link href={link({ ...(nhom && { nhom }), trang: String(trang - 1) })}>
              <button type="button">← Trang trước</button>
            </Link>
          )}
          {trang < soTrang && (
            <Link href={link({ ...(nhom && { nhom }), trang: String(trang + 1) })}>
              <button type="button">Trang sau →</button>
            </Link>
          )}
        </div>
      )}

      <p className="muted">
        “Không có phiếu thuê” là máy gắn vào thuê bao nhưng bên nguồn không có dòng nào
        trong sổ cho thuê, nên không biết đã thu cọc hay chưa — cột cọc để trống chứ không
        phải bằng không.
      </p>
    </main>
  );
}
