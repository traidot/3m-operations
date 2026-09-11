import Link from "next/link";
import { ChiTiet } from "./chi-tiet";
import { DaiKy } from "./dai-ky";
import {
  CONTRACTS_PER_PAGE,
  countContracts,
  getContracts,
  getYearStatus,
  type ContractFilter,
} from "@/lib/queries";
import { CANH_BAO, CANH_BAO_NANG, HOP_DONG, LAP_DAT, TINH_TRANG_CUOC } from "@/lib/nhan";

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
    canhBao: mot(sp.cb),
    trang: Math.max(1, Number(mot(sp.trang)) || 1),
  };

  const [rows, tong] = await Promise.all([getContracts(loc), countContracts(loc)]);
  const nam = new Date().getFullYear();
  const theoNam = await getYearStatus(rows.map((r) => r.subscription_id));
  const soTrang = Math.max(1, Math.ceil(tong / CONTRACTS_PER_PAGE));
  const trang = loc.trang!;

  // Giữ nguyên bộ lọc khi sang trang hoặc mở ngăn kéo, chỉ đổi một tham số.
  const link = (doi: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    if (loc.q) p.set("q", loc.q);
    if (loc.hopDong) p.set("hd", loc.hopDong);
    if (loc.lapDat) p.set("lap", loc.lapDat);
    if (loc.cuoc) p.set("cuoc", loc.cuoc);
    if (loc.canhBao) p.set("cb", loc.canhBao);
    if (trang > 1) p.set("trang", String(trang));
    for (const [k, v] of Object.entries(doi)) {
      if (v === undefined) p.delete(k);
      else p.set(k, v);
    }
    const duoi = p.toString();
    return duoi ? `/hop-dong?${duoi}` : "/hop-dong";
  };
  const dangMo = mot(sp.xem);

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
          <Chon
            ten="cb"
            nhan="Cảnh báo"
            chon={loc.canhBao!}
            lua={{ CO: "có cảnh báo", ...CANH_BAO }}
          />
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
                <th>Cảnh báo</th>
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
                <tr key={r.subscription_id} className={r.subscription_id === dangMo ? "dang-mo" : undefined}>
                  <td className="mono">
                    <Link href={link({ xem: r.subscription_id })} scroll={false}>
                      {r.contract_code ?? "—"}
                    </Link>
                  </td>
                  <td>
                    {r.dia_chi ?? "—"}
                    <DaiKy cac_ky={theoNam.get(r.subscription_id)} nam={nam} />
                  </td>
                  <td>{HOP_DONG[r.trang_thai_hop_dong] ?? r.trang_thai_hop_dong}</td>
                  <td>{r.trang_thai_lap_dat ? (LAP_DAT[r.trang_thai_lap_dat] ?? r.trang_thai_lap_dat) : "—"}</td>
                  <td>
                    {r.canh_bao.length === 0 ? (
                      <span className="muted">—</span>
                    ) : (
                      r.canh_bao.map((cb) => (
                        <span
                          key={cb}
                          className={`tag ${CANH_BAO_NANG.has(cb) ? "critical" : "warn"}`}
                        >
                          {CANH_BAO[cb] ?? cb}
                        </span>
                      ))
                    )}
                  </td>
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

      <p className="muted chu-giai">
        Dải {nam}: mỗi ô một tháng, tháng 1 bên trái.
        <span className="chu-thich"><i className="o-ky mau da-thu" /> đã thu</span>
        <span className="chu-thich"><i className="o-ky mau mien-phi" /> miễn phí</span>
        <span className="chu-thich"><i className="o-ky mau cho-duyet" /> chờ duyệt hoặc ghi chú</span>
        <span className="chu-thich"><i className="o-ky mau no" /> chưa thu</span>
        <span className="chu-thich"><i className="o-ky mau na" /> ngoài khoảng đóng cước</span>
      </p>

      {soTrang > 1 && (
        <div className="actions">
          {trang > 1 && (
            <Link href={link({ trang: String(trang - 1), xem: undefined })}>
              <button type="button">← Trang trước</button>
            </Link>
          )}
          {trang < soTrang && (
            <Link href={link({ trang: String(trang + 1), xem: undefined })}>
              <button type="button">Trang sau →</button>
            </Link>
          )}
        </div>
      )}

      {dangMo && <ChiTiet id={dangMo} dongLai={link({ xem: undefined })} />}
    </main>
  );
}
