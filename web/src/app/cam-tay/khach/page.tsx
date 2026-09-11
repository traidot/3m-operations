import Link from "next/link";
import { Dong } from "../../hop-dong/dong";
import { ChiTietKhach } from "./chi-tiet";
import {
  CONTRACTS_PER_PAGE,
  countTelecomCustomers,
  getTelecomCustomers,
  type CustomerFilter,
} from "@/lib/queries";
import { CANH_BAO_TELECOM, CANH_BAO_TELECOM_NANG, DICH_VU } from "@/lib/nhan";

export const dynamic = "force-dynamic";

const n = (v: string | null) => (v === null ? "—" : Number(v).toLocaleString("vi-VN"));

type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function Chon({ ten, nhan, chon, lua }: {
  ten: string; nhan: string; chon: string; lua: Record<string, string>;
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
  const loc: CustomerFilter = {
    q: mot(sp.q),
    dichVu: mot(sp.dv),
    canhBao: mot(sp.cb),
    nhieuTb: mot(sp.nhieu),
    trang: Math.max(1, Number(mot(sp.trang)) || 1),
  };

  const [rows, tong] = await Promise.all([
    getTelecomCustomers(loc),
    countTelecomCustomers(loc),
  ]);
  const soTrang = Math.max(1, Math.ceil(tong / CONTRACTS_PER_PAGE));
  const trang = loc.trang!;
  const dangMo = mot(sp.xem);

  const link = (doi: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    if (loc.q) p.set("q", loc.q);
    if (loc.dichVu) p.set("dv", loc.dichVu);
    if (loc.canhBao) p.set("cb", loc.canhBao);
    if (loc.nhieuTb) p.set("nhieu", loc.nhieuTb);
    if (trang > 1) p.set("trang", String(trang));
    for (const [k, v] of Object.entries(doi)) {
      if (v === undefined) p.delete(k);
      else p.set(k, v);
    }
    const duoi = p.toString();
    return duoi ? `/cam-tay/khach?${duoi}` : "/cam-tay/khach";
  };

  return (
    <main>
      <h1>Khách wifi cầm tay</h1>
      <p className="muted">
        Một khách có thể dùng nhiều dịch vụ cùng lúc, nên nợ phải cộng theo người chứ
        không theo thuê bao. Bấm vào dòng để xem từng thuê bao của khách đó. Có party là
        tài khoản CTV hoặc đại lý giữ hàng trăm thuê bao — lọc “nhiều thuê bao” để thấy.
      </p>

      <form method="get">
        <div className="formgrid">
          <label>
            Tên hoặc điện thoại
            <input type="search" name="q" defaultValue={loc.q} placeholder="tên khách…" />
          </label>
          <Chon ten="dv" nhan="Dịch vụ" chon={loc.dichVu!} lua={DICH_VU} />
          <Chon
            ten="cb"
            nhan="Cảnh báo"
            chon={loc.canhBao!}
            lua={{ CO: "có cảnh báo", ...CANH_BAO_TELECOM }}
          />
          <Chon
            ten="nhieu"
            nhan="Số thuê bao"
            chon={loc.nhieuTb!}
            lua={{ "1": "từ 2 thuê bao trở lên" }}
          />
          <div className="actions">
            <button className="primary" type="submit">
              Lọc
            </button>
            <a href="/cam-tay/khach">
              <button type="button">Bỏ lọc</button>
            </a>
          </div>
        </div>
      </form>

      <h2>
        {n(String(tong))} khách
        {soTrang > 1 ? ` — trang ${trang}/${soTrang}` : ""}
      </h2>

      {rows.length === 0 ? (
        <p className="empty">Không có khách nào khớp.</p>
      ) : (
        <div className="scroller">
          <table className="bang-chon">
            <thead>
              <tr>
                <th>Khách</th>
                <th>Dịch vụ đang dùng</th>
                <th className="num">Thuê bao</th>
                <th className="num">Đang chạy</th>
                <th>Cảnh báo</th>
                <th className="num">Đã thu</th>
                <th className="num">Còn nợ</th>
                <th className="num">Mất trắng</th>
                <th className="num">Máy chưa trả</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Dong
                  key={r.party_id}
                  href={link({ xem: r.party_id })}
                  dangMo={r.party_id === dangMo}
                >
                  <td>
                    <Link href={link({ xem: r.party_id })} scroll={false}>
                      {r.khach}
                    </Link>
                    {r.dien_thoai && <div className="mono muted">{r.dien_thoai}</div>}
                  </td>
                  <td>
                    {(r.dich_vu ?? []).map((d) => DICH_VU[d] ?? d).join(", ") || "—"}
                  </td>
                  <td className="num mono">{n(r.so_thue_bao)}</td>
                  <td className="num mono muted">{n(r.dang_chay)}</td>
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
                  <td className="num mono">{n(r.da_thu)}</td>
                  <td className={`num mono${Number(r.con_no) > 0 ? " bad" : ""}`}>
                    {n(r.con_no)}
                  </td>
                  <td className={`num mono${Number(r.tien_mat) > 0 ? " bad" : ""}`}>
                    {n(r.tien_mat)}
                  </td>
                  <td className={`num mono${Number(r.may_chua_tra) > 0 ? " bad" : ""}`}>
                    {n(r.may_chua_tra)}
                  </td>
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

      {dangMo && <ChiTietKhach id={dangMo} dongLai={link({ xem: undefined })} />}
    </main>
  );
}
