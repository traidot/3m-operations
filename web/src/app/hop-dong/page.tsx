import {
  CONTRACTS_PER_PAGE,
  countContracts,
  getContracts,
  type ContractFilter,
} from "@/lib/queries";
import { HOP_DONG, LAP_DAT, TINH_TRANG_CUOC } from "@/lib/nhan";

export const dynamic = "force-dynamic";

const n = (v: string | null) => (v === null ? "—" : Number(v).toLocaleString("vi-VN"));

type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function Chon({
  ten,
  nhan,
  chon,
  lua,
}: {
  ten: string;
  nhan: string;
  chon: string;
  lua: Record<string, string>;
}) {
  return (
    <label>
      {nhan}
      <select name={ten} defaultValue={chon}>
        <option value="">tất cả</option>
        {Object.entries(lua).map(([ma, chu]) => (
          <option key={ma} value={ma}>
            {chu}
          </option>
        ))}
      </select>
    </label>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<Tham> }) {
  const sp = await searchParams;
  const loc: ContractFilter = {
    q: mot(sp.q),
    hopDong: mot(sp.hd),
    lapDat: mot(sp.lap),
    cuoc: mot(sp.cuoc),
    trang: Math.max(1, Number(mot(sp.trang)) || 1),
  };

  const [rows, tong] = await Promise.all([getContracts(loc), countContracts(loc)]);
  const soTrang = Math.max(1, Math.ceil(tong / CONTRACTS_PER_PAGE));
  const trang = loc.trang!;

  const linkTrang = (t: number) => {
    const p = new URLSearchParams();
    if (loc.q) p.set("q", loc.q);
    if (loc.hopDong) p.set("hd", loc.hopDong);
    if (loc.lapDat) p.set("lap", loc.lapDat);
    if (loc.cuoc) p.set("cuoc", loc.cuoc);
    p.set("trang", String(t));
    return `/hop-dong?${p}`;
  };

  return (
    <main>
      <h1>Hợp đồng wifi cố định</h1>
      <p className="muted">
        Toàn bộ hợp đồng trong hệ thống wifi cố định. Bấm mã hợp đồng để xem cước từng
        tháng. “Chưa tính được” là hợp đồng thiếu giá cước hoặc thiếu ngày bắt đầu thu
        nên không sinh được kỳ nào — không phải đã thu đủ.
      </p>

      <form method="get">
        <div className="formgrid">
          <label>
            Mã hợp đồng hoặc địa chỉ
            <input type="search" name="q" defaultValue={loc.q} placeholder="HD000216, 川崎区…" />
          </label>
          <Chon ten="hd" nhan="Trạng thái hợp đồng" chon={loc.hopDong!} lua={HOP_DONG} />
          <Chon ten="lap" nhan="Lắp đặt" chon={loc.lapDat!} lua={LAP_DAT} />
          <Chon ten="cuoc" nhan="Tình trạng cước" chon={loc.cuoc!} lua={TINH_TRANG_CUOC} />
          <div className="actions">
            <button className="primary" type="submit">
              Lọc
            </button>
            <a href="/hop-dong">
              <button type="button">Bỏ lọc</button>
            </a>
          </div>
        </div>
      </form>

      <h2>
        {n(String(tong))} hợp đồng
        {soTrang > 1 ? ` — trang ${trang}/${soTrang}` : ""}
      </h2>

      {rows.length === 0 ? (
        <p className="empty">Không có hợp đồng nào khớp.</p>
      ) : (
        <div className="scroller">
          <table>
            <thead>
              <tr>
                <th>Mã</th>
                <th>Địa chỉ lắp</th>
                <th>Hợp đồng</th>
                <th>Lắp đặt</th>
                <th className="num">Cước/tháng</th>
                <th className="num">Kỳ</th>
                <th className="num">Miễn</th>
                <th className="num">Nợ</th>
                <th className="num">Còn nợ</th>
                <th>Thu tới</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.subscription_id}>
                  <td className="mono">
                    <a href={`/hop-dong/${r.subscription_id}`}>{r.contract_code ?? "—"}</a>
                  </td>
                  <td>{r.dia_chi ?? "—"}</td>
                  <td>{HOP_DONG[r.trang_thai_hop_dong] ?? r.trang_thai_hop_dong}</td>
                  <td>{r.trang_thai_lap_dat ? (LAP_DAT[r.trang_thai_lap_dat] ?? r.trang_thai_lap_dat) : "—"}</td>
                  <td className="num mono">{n(r.cuoc_thang)}</td>
                  <td className="num mono">
                    {r.tinh_trang_cuoc === "CHUA_TINH_DUOC" ? "—" : n(r.so_ky)}
                  </td>
                  <td className="num mono">{n(r.so_ky_mien_phi)}</td>
                  <td className={`num mono${Number(r.so_ky_no) > 0 ? " bad" : ""}`}>
                    {r.tinh_trang_cuoc === "CHUA_TINH_DUOC" ? "—" : n(r.so_ky_no)}
                  </td>
                  <td className={`num mono${Number(r.con_no) > 0 ? " bad" : ""}`}>
                    {n(r.con_no)}
                  </td>
                  <td className="mono">{r.ky_da_thu_gan_nhat ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {soTrang > 1 && (
        <div className="actions">
          {trang > 1 && (
            <a href={linkTrang(trang - 1)}>
              <button type="button">← Trang trước</button>
            </a>
          )}
          {trang < soTrang && (
            <a href={linkTrang(trang + 1)}>
              <button type="button">Trang sau →</button>
            </a>
          )}
        </div>
      )}
    </main>
  );
}
