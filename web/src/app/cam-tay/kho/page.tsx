import Link from "next/link";
import { ThanBam } from "../../than-bam";
import { getKhoDoiChieu, getKhoThieuOFile } from "@/lib/queries";
import { KHO_PM, PHIEU_KHO } from "@/lib/nhan";

export const dynamic = "force-dynamic";

/**
 * Bảng này 6.852 dòng × 7 cột dày, dựng hết một lượt thì trang nặng gấp đôi màn
 * hình máy. Cắt ở đây và nói rõ đã cắt, còn muốn xem nhóm nào thì lọc.
 */
const GIOI_HAN = 1000;

const n = (v: string | number | null) =>
  v === null ? "—" : Number(v).toLocaleString("vi-VN");

type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Số thứ tự đầu mỗi kết luận trong file ("03. Không có trong sổ…"). */
const maKetLuan = (s: string | null) => (s ?? "").slice(0, 2);

const MAU_PM: Record<string, string> = {
  O_KHACH: "ok",
  TRONG_KHO: "ok",
  TRA_NCC: "tat",
  CHI_NHA_MANG: "cho",
  PM_KHONG_BIET: "xau",
};

export default async function Page({ searchParams }: { searchParams: Promise<Tham> }) {
  const sp = await searchParams;
  const [tatCa, thieu] = await Promise.all([getKhoDoiChieu(), getKhoThieuOFile()]);

  const pm = mot(sp.pm);
  const kl = mot(sp.kl);
  const tim = mot(sp.q).trim().toLowerCase();

  let rows = tatCa;
  if (pm) rows = rows.filter((r) => r.pm_ket_luan === pm);
  if (kl) rows = rows.filter((r) => maKetLuan(r.ket_luan) === kl);
  if (tim) {
    rows = rows.filter((r) =>
      [r.ma, r.pm_khach, r.pm_ma_khach, r.nguoi_giu, r.vi_tri_so]
        .some((v) => v?.toLowerCase().includes(tim)),
    );
  }

  // Bảng chéo: kết luận của file × kết luận của phần mềm.
  const cotPm = Object.keys(KHO_PM).filter((k) => tatCa.some((r) => r.pm_ket_luan === k));
  const dongKl = [...new Set(tatCa.map((r) => r.ket_luan ?? "(trống)"))].sort();
  const o = (k: string, p: string) =>
    tatCa.filter((r) => (r.ket_luan ?? "(trống)") === k && r.pm_ket_luan === p).length;

  const link = (t: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(t)) if (v) p.set(k, v);
    const duoi = p.toString();
    return duoi ? `/cam-tay/kho?${duoi}` : "/cam-tay/kho";
  };

  return (
    <main>
      <h1>Đối chiếu kho</h1>
      <p className="muted">
        Bản đối chiếu làm tay ở ngoài, đặt cạnh những gì phần mềm đang ghi. File nhập{" "}
        <b>{n(tatCa.length)}</b> mã; phần mềm có module kho riêng với{" "}
        <b>13.327</b> dòng phiếu trên <b>5.706</b> mã, và <b>{n(thieu.length)}</b> mã trong
        đó file không nhắc tới. Cột “phần mềm” là kết luận <b>suy ra từ phiếu kho gần
        nhất</b>, không phải một cột có sẵn bên nguồn: phiếu xuất gần nhất thì máy đang ở
        khách, phiếu nhập gần nhất thì máy đã về kho.
      </p>

      <p className="stale">
        Trang này <b>không tự chấm khớp hay không khớp</b>. Hai bên trả lời hai câu hỏi hơi
        khác nhau — file hỏi “mã này ở đâu theo sổ và theo lần kiểm kho 15/09”, phần mềm trả
        lời “phiếu gần nhất của mã này là phiếu gì”. Tự đặt luật khớp thì thành mình chấm bài
        mình, nên ở đây để nguyên bảng chéo, chỗ nào lệch thì nhìn thấy ngay.
      </p>

      <h2>Kết luận của file × kết luận của phần mềm</h2>
      <div className="scroller">
        <table className="bang-thang">
          <thead>
            <tr>
              <th>Kết luận ở file</th>
              {cotPm.map((p) => (
                <th key={p} className="num">
                  {KHO_PM[p]}
                </th>
              ))}
              <th className="num">Cộng</th>
            </tr>
          </thead>
          <tbody>
            {dongKl.map((k) => {
              const tong = tatCa.filter((r) => (r.ket_luan ?? "(trống)") === k).length;
              return (
                <tr key={k}>
                  <td>{k}</td>
                  {cotPm.map((p) => {
                    const v = o(k, p);
                    return (
                      <td key={p} className={`num mono${v === 0 ? " muted" : ""}`}>
                        {v === 0 ? "—" : (
                          <Link href={link({ kl: maKetLuan(k), pm: p })}>{n(v)}</Link>
                        )}
                      </td>
                    );
                  })}
                  <td className="num mono">{n(tong)}</td>
                </tr>
              );
            })}
            <tr>
              <td>
                <b>Cộng</b>
              </td>
              {cotPm.map((p) => (
                <td key={p} className="num mono">
                  <b>{n(tatCa.filter((r) => r.pm_ket_luan === p).length)}</b>
                </td>
              ))}
              <td className="num mono">
                <b>{n(tatCa.length)}</b>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Từng mã</h2>
      <form method="get">
        <div className="formgrid">
          <label>
            Mã máy, tên khách hoặc người giữ
            <input type="text" name="q" defaultValue={mot(sp.q)} placeholder="IMEI, tên…" />
          </label>
          <div className="actions">
            <button className="primary" type="submit">
              Tìm
            </button>
            <Link href="/cam-tay/kho">
              <button type="button">Bỏ lọc</button>
            </Link>
          </div>
        </div>
      </form>

      <p className="actions">
        <Link href={link({ q: mot(sp.q) || undefined, kl: kl || undefined })}>
          <button type="button" className={pm === "" ? "primary" : undefined}>
            Tất cả · {n(tatCa.length)}
          </button>
        </Link>
        {cotPm.map((p) => (
          <Link key={p} href={link({ pm: p, q: mot(sp.q) || undefined, kl: kl || undefined })}>
            <button type="button" className={pm === p ? "primary" : undefined}>
              {KHO_PM[p]} · {n(tatCa.filter((r) => r.pm_ket_luan === p).length)}
            </button>
          </Link>
        ))}
      </p>

      <p className="muted">
        {n(rows.length)} mã
        {pm && ` · ${KHO_PM[pm]}`}
        {kl && ` · file kết luận “${kl}”`}
        {tim && ` · tìm “${mot(sp.q)}”`}
      </p>

      {rows.length === 0 ? (
        <p className="empty">Không có mã nào khớp.</p>
      ) : (
        <div className="scroller">
          <table className="bang-thang">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Nhóm ở file</th>
                <th>Kết luận ở file</th>
                <th>Vị trí theo sổ / kiểm kho</th>
                <th>Phần mềm</th>
                <th>Phiếu kho gần nhất</th>
                <th>Đời máy / khách theo phần mềm</th>
              </tr>
            </thead>
            <ThanBam>
              {rows.slice(0, GIOI_HAN).map((r) => (
                <tr key={r.ma}>
                  <td className="mono">{r.ma}</td>
                  <td className="muted">{r.nhom_hang ?? "—"}</td>
                  <td>{r.ket_luan ?? "—"}</td>
                  <td className="muted">
                    {r.vi_tri_so ?? "không có trong sổ"}
                    {r.vi_tri_kiem_kho && <div>kho 15/09: {r.vi_tri_kiem_kho}</div>}
                    {r.nguoi_giu && <div>{r.nguoi_giu}</div>}
                  </td>
                  <td>
                    <span className={`chip ${MAU_PM[r.pm_ket_luan] ?? "tat"}`}>
                      {KHO_PM[r.pm_ket_luan] ?? r.pm_ket_luan}
                    </span>
                    {r.pm_nha_mang && (
                      <div className="muted">
                        nhà mạng: {r.pm_nha_mang} · {r.pm_vendor}
                      </div>
                    )}
                  </td>
                  <td className="muted">
                    {r.pm_phieu ? (
                      <>
                        {PHIEU_KHO[r.pm_phieu] ?? r.pm_phieu}
                        <div className="mono">
                          {r.pm_ngay_phieu} · {r.pm_kho ?? "không ghi kho"}
                        </div>
                        <div>{r.pm_ly_do}</div>
                      </>
                    ) : (
                      "chưa có phiếu nào"
                    )}
                  </td>
                  <td className="muted">
                    {r.pm_doi_may ?? "—"}
                    {r.pm_khach && (
                      <div>
                        {r.pm_khach}
                        {r.pm_ma_khach && ` · ${r.pm_ma_khach}`}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </ThanBam>
          </table>
        </div>
      )}
      {rows.length > GIOI_HAN && (
        <p className="muted">
          Mới hiện {n(GIOI_HAN)} dòng đầu trên {n(rows.length)}. Lọc hẹp lại để xem phần
          còn lại.
        </p>
      )}
    </main>
  );
}
