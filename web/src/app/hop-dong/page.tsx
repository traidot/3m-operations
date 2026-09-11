import Link from "next/link";
import { ChiTiet } from "./chi-tiet";
import { Chip } from "../chip";
import { DaiKy } from "./dai-ky";
import { Dong } from "./dong";
import {
  CONTRACTS_PER_PAGE,
  countContracts,
  getContracts,
  getYearStatus,
  type ContractFilter,
} from "@/lib/queries";
import {
  CANH_BAO,
  CANH_BAO_NANG,
  HOP_DONG,
  KY_CUOC,
  LAP_DAT,
  LY_DO_HUY,
  TINH_TRANG_CUOC,
} from "@/lib/nhan";

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
      <span className="o-chon">
        <select name={ten} defaultValue={chon}>
          <option value="">tất cả</option>
          {Object.entries(lua).map(([ma, chu]) => (
            <option key={ma} value={ma}>
              {chu}
            </option>
          ))}
        </select>
      </span>
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
    ky: mot(sp.ky),
    kyTrangThai: mot(sp.ky_tt),
    thangKy: mot(sp.thang_ky),
    thangHuy: mot(sp.thang_huy),
    lyDoHuy: mot(sp.ly_do),
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
    if (loc.ky) p.set("ky", loc.ky);
    if (loc.kyTrangThai) p.set("ky_tt", loc.kyTrangThai);
    if (loc.thangKy) p.set("thang_ky", loc.thangKy);
    if (loc.thangHuy) p.set("thang_huy", loc.thangHuy);
    if (loc.lyDoHuy) p.set("ly_do", loc.lyDoHuy);
    if (trang > 1) p.set("trang", String(trang));
    for (const [k, v] of Object.entries(doi)) {
      if (v === undefined) p.delete(k);
      else p.set(k, v);
    }
    const duoi = p.toString();
    return duoi ? `/hop-dong?${duoi}` : "/hop-dong";
  };
  const dangMo = mot(sp.xem);

  const theoThang = [
    loc.ky && `kỳ cước ${loc.ky}${loc.kyTrangThai ? ` — ${KY_CUOC[loc.kyTrangThai] ?? loc.kyTrangThai}` : ""}`,
    loc.thangKy && `ký trong ${loc.thangKy}`,
    loc.thangHuy && `huỷ trong ${loc.thangHuy}`,
    loc.lyDoHuy && `huỷ vì ${LY_DO_HUY[loc.lyDoHuy] ?? loc.lyDoHuy}`,
  ].filter(Boolean) as string[];

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
          <Chon ten="ly_do" nhan="Lý do huỷ" chon={loc.lyDoHuy!} lua={LY_DO_HUY} />
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
            <Link href="/hop-dong">
              <button type="button">Bỏ lọc</button>
            </Link>
          </div>
        </div>
      </form>

      {theoThang.length > 0 && (
        <p className="loc-thang">
          Đang lọc: {theoThang.join(" · ")}
          <a
            href={link({
              ky: undefined,
              ky_tt: undefined,
              thang_ky: undefined,
              thang_huy: undefined,
              ly_do: undefined,
            })}
          >
            gỡ
          </a>
        </p>
      )}

      <h2>
        {n(String(tong))} hợp đồng
        {soTrang > 1 ? ` — trang ${trang}/${soTrang}` : ""}
      </h2>

      {rows.length === 0 ? (
        <p className="empty">Không có hợp đồng nào khớp.</p>
      ) : (
        <div className="scroller">
          <table className="bang-chon">
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
                <Dong
                  key={r.subscription_id}
                  href={link({ xem: r.subscription_id })}
                  dangMo={r.subscription_id === dangMo}
                >
                  <td className="mono">
                    <Link href={link({ xem: r.subscription_id })} scroll={false}>
                      {r.contract_code ?? "—"}
                    </Link>
                  </td>
                  <td>
                    {r.dia_chi ?? "—"}
                    <DaiKy nam={theoNam.get(r.subscription_id)} />
                  </td>
                  <td>
                    <Chip ma={r.trang_thai_hop_dong} nhan={HOP_DONG} />
                  </td>
                  <td>
                    <Chip ma={r.trang_thai_lap_dat} nhan={LAP_DAT} />
                  </td>
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
                </Dong>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="muted chu-giai">
        Dải {nam}: mỗi ô một tháng, tháng 1 bên trái. Khối đậm là thời hạn hợp đồng —
        cạnh bo tròn là đầu hoặc đuôi thật, cạnh vuông là còn chạy sang năm khác.
        <span className="chu-thich"><i className="o-ky mau da-thu" /> đã thu</span>
        <span className="chu-thich"><i className="o-ky mau mien-phi" /> miễn phí</span>
        <span className="chu-thich"><i className="o-ky mau cho-duyet" /> chờ duyệt hoặc ghi chú</span>
        <span className="chu-thich"><i className="o-ky mau no" /> chưa thu</span>
        <span className="chu-thich"><i className="o-ky mau na" /> chưa tới hạn</span>
        <span className="chu-thich"><i className="o-ky mau ngoai" /> ngoài thời hạn</span>
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
