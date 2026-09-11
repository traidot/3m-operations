import Link from "next/link";
import { Chip } from "../../chip";
import { Dong } from "../../hop-dong/dong";
import { ChiTietThueBao } from "./chi-tiet";
import {
  CONTRACTS_PER_PAGE,
  countTelecomSubs,
  getTelecomSubs,
  type TelecomFilter,
} from "@/lib/queries";
import {
  CANH_BAO_TELECOM,
  CANH_BAO_TELECOM_NANG,
  DICH_VU,
  HOP_DONG,
} from "@/lib/nhan";

export const dynamic = "force-dynamic";

const n = (v: string | null) => (v === null ? "—" : Number(v).toLocaleString("vi-VN"));

type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const TRANG_THAI = {
  ACTIVE: "đang chạy",
  TERMINATED: "đã ngừng",
  SUSPENDED: "tạm ngưng",
  PENDING: "chờ kích hoạt",
};

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
  const loc: TelecomFilter = {
    q: mot(sp.q),
    trangThai: mot(sp.tt),
    dichVu: mot(sp.dv),
    canhBao: mot(sp.cb),
    trang: Math.max(1, Number(mot(sp.trang)) || 1),
  };

  const [rows, tong] = await Promise.all([getTelecomSubs(loc), countTelecomSubs(loc)]);
  const soTrang = Math.max(1, Math.ceil(tong / CONTRACTS_PER_PAGE));
  const trang = loc.trang!;
  const dangMo = mot(sp.xem);

  const link = (doi: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    if (loc.q) p.set("q", loc.q);
    if (loc.trangThai) p.set("tt", loc.trangThai);
    if (loc.dichVu) p.set("dv", loc.dichVu);
    if (loc.canhBao) p.set("cb", loc.canhBao);
    if (trang > 1) p.set("trang", String(trang));
    for (const [k, v] of Object.entries(doi)) {
      if (v === undefined) p.delete(k);
      else p.set(k, v);
    }
    const duoi = p.toString();
    return duoi ? `/cam-tay/thue-bao?${duoi}` : "/cam-tay/thue-bao";
  };

  return (
    <main>
      <h1>Thuê bao wifi cầm tay</h1>
      <p className="muted">
        Toàn bộ thuê bao trong hệ telecom. Bấm vào dòng để xem từng hoá đơn. Công nợ đọc
        thẳng từ hoá đơn chứ không suy ra như bên wifi cố định.
      </p>

      <form method="get">
        <div className="formgrid">
          <label>
            Khách hoặc mã máy
            <input type="search" name="q" defaultValue={loc.q} placeholder="tên, mã máy…" />
          </label>
          <Chon ten="tt" nhan="Trạng thái" chon={loc.trangThai!} lua={TRANG_THAI} />
          <Chon ten="dv" nhan="Dịch vụ" chon={loc.dichVu!} lua={DICH_VU} />
          <Chon
            ten="cb"
            nhan="Cảnh báo"
            chon={loc.canhBao!}
            lua={{ CO: "có cảnh báo", ...CANH_BAO_TELECOM }}
          />
          <div className="actions">
            <button className="primary" type="submit">
              Lọc
            </button>
            <a href="/cam-tay/thue-bao">
              <button type="button">Bỏ lọc</button>
            </a>
          </div>
        </div>
      </form>

      <h2>
        {n(String(tong))} thuê bao
        {soTrang > 1 ? ` — trang ${trang}/${soTrang}` : ""}
      </h2>

      {rows.length === 0 ? (
        <p className="empty">Không có thuê bao nào khớp.</p>
      ) : (
        <div className="scroller">
          <table className="bang-chon">
            <thead>
              <tr>
                <th>Khách</th>
                <th>Dịch vụ</th>
                <th>Trạng thái</th>
                <th>Cảnh báo</th>
                <th className="num">Giá/tháng</th>
                <th className="num">Hoá đơn</th>
                <th className="num">Đã thu</th>
                <th className="num">Còn nợ</th>
                <th className="num">Mất trắng</th>
                <th>Kỳ gần nhất</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Dong
                  key={r.subscription_id}
                  href={link({ xem: r.subscription_id })}
                  dangMo={r.subscription_id === dangMo}
                >
                  <td>
                    <Link href={link({ xem: r.subscription_id })} scroll={false}>
                      {r.khach ?? `#${r.subscription_id}`}
                    </Link>
                    {r.ma_may && <div className="mono muted">{r.ma_may}</div>}
                  </td>
                  <td>{DICH_VU[r.service_type ?? ""] ?? r.service_type ?? "—"}</td>
                  <td>
                    <Chip ma={r.trang_thai} nhan={HOP_DONG} />
                  </td>
                  <td>
                    {r.canh_bao.length === 0 ? (
                      <span className="muted">—</span>
                    ) : (
                      r.canh_bao.map((cb) => (
                        <span
                          key={cb}
                          className={`tag ${CANH_BAO_TELECOM_NANG.has(cb) ? "critical" : "warn"}`}
                        >
                          {CANH_BAO_TELECOM[cb] ?? cb}
                        </span>
                      ))
                    )}
                  </td>
                  <td className="num mono">{n(r.gia_thang)}</td>
                  <td className="num mono muted">{n(r.so_hoa_don)}</td>
                  <td className="num mono">{n(r.da_thu)}</td>
                  <td className={`num mono${Number(r.con_no) > 0 ? " bad" : ""}`}>
                    {n(r.con_no)}
                  </td>
                  <td className={`num mono${Number(r.tien_mat) > 0 ? " bad" : ""}`}>
                    {n(r.tien_mat)}
                  </td>
                  <td className="mono">{r.ky_gan_nhat_den?.slice(0, 7) ?? "—"}</td>
                </Dong>
              ))}
            </tbody>
          </table>
        </div>
      )}

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

      {dangMo && <ChiTietThueBao id={dangMo} dongLai={link({ xem: undefined })} />}
    </main>
  );
}
