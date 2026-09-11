import { Bars } from "../wifi/bars";
import {
  getTelecomChannels,
  getTelecomMonths,
  getTelecomTotals,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

const n = (v: string | null) => (v === null ? "—" : Number(v).toLocaleString("vi-VN"));
const so = (v: string | null) => (v === null ? null : Number(v));
const loc = (t: Record<string, string>) => `/cam-tay/thue-bao?${new URLSearchParams(t)}`;
const locKhach = (t: Record<string, string>) => `/cam-tay/khach?${new URLSearchParams(t)}`;

type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const ngay = (d: Date) => d.toISOString().slice(0, 10);

function The({ ten, gia_tri, den, xau }: { ten: string; gia_tri: string; den?: string; xau?: boolean }) {
  const so_ = <div className={`the-gia-tri mono${xau ? " bad" : ""}`}>{n(gia_tri)}</div>;
  return (
    <div className="the-so">
      <div className="the-ten">{ten}</div>
      {den ? <a href={den}>{so_}</a> : so_}
    </div>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<Tham> }) {
  const sp = await searchParams;
  const macDinh = new Date();
  const truoc = new Date(macDinh);
  truoc.setMonth(truoc.getMonth() - 2);
  const tu = mot(sp.tu) || ngay(truoc);
  const den = mot(sp.den) || ngay(macDinh);

  const [thang, kenh, tong] = await Promise.all([
    getTelecomMonths(),
    getTelecomChannels(tu, den),
    getTelecomTotals(),
  ]);

  const nhan = thang.map((r) => r.ky);

  return (
    <main>
      <h1>Wifi cầm tay</h1>
      <p className="muted">
        Hệ telecom có hoá đơn thật nên công nợ đọc thẳng, không phải suy từ sổ thu như
        bên wifi cố định. Bảng theo tháng ghép theo <b>kỳ cước</b>, không theo ngày lập.
      </p>

      <div className="the-hang">
        <The ten="Khách" gia_tri={tong.khach} den={locKhach({})} />
        <The ten="Thuê bao" gia_tri={tong.thue_bao} den={loc({})} />
        <The ten="Đang chạy" gia_tri={tong.dang_chay} den={loc({ tt: "ACTIVE" })} />
        <The ten="Còn đang đòi" gia_tri={tong.con_no} den={locKhach({ cb: "CO" })} xau />
        <The ten="Nợ quá hạn" gia_tri={tong.no_qua_han} den={locKhach({ cb: "NO_QUA_HAN" })} xau />
        <The ten="Mất trắng" gia_tri={tong.tien_mat} den={locKhach({ cb: "KHONG_DOI_DUOC" })} xau />
        <The
          ten="Chạy mà không hoá đơn"
          gia_tri={tong.thieu_hoa_don}
          den={loc({ cb: "THIEU_HOA_DON" })}
          xau
        />
        <The ten="Máy chưa thu hồi" gia_tri={tong.may_chua_tra} den={loc({ cb: "MAY_CHUA_TRA" })} />
      </div>

      <h2>Doanh thu theo kỳ cước</h2>
      <Bars
        nhan={nhan}
        cao={150}
        chuoi={[
          { ten: "Phải thu", mau: "var(--line-strong)", gia_tri: thang.map((r) => so(r.phai_thu)) },
          { ten: "Đã thu", mau: "var(--ok)", gia_tri: thang.map((r) => so(r.da_thu)) },
        ]}
      />

      <div className="scroller">
        <table>
          <thead>
            <tr>
              <th>Kỳ</th>
              <th className="num">Thuê bao</th>
              <th className="num">Hoá đơn</th>
              <th className="num">Phải thu</th>
              <th className="num">Đã thu</th>
              <th className="num">Còn đòi</th>
              <th className="num">Mất trắng</th>
              <th>Tỉ lệ thu</th>
            </tr>
          </thead>
          <tbody>
            {[...thang].reverse().map((r) => {
              const ty = r.ty_le_thu === null ? null : Number(r.ty_le_thu);
              return (
                <tr key={r.ky}>
                  <td className="mono">{r.ky}</td>
                  <td className="num mono">{n(r.so_thue_bao)}</td>
                  <td className="num mono muted">{n(r.so_hoa_don)}</td>
                  <td className="num mono">{n(r.phai_thu)}</td>
                  <td className="num mono">{n(r.da_thu)}</td>
                  <td className={`num mono${Number(r.con_doi ?? 0) > 0 ? " bad" : ""}`}>
                    {n(r.con_doi)}
                  </td>
                  <td className={`num mono${Number(r.mat_trang ?? 0) > 0 ? " bad" : ""}`}>
                    {n(r.mat_trang)}
                  </td>
                  <td>
                    {ty === null ? (
                      <span className="muted">—</span>
                    ) : (
                      <span className="bar">
                        <span className="bar-fill" style={{ width: `${Math.min(ty, 100)}%` }} />
                        <span className="bar-label mono">{ty}%</span>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>Tiền về theo kênh</h2>
      <form method="get" className="formgrid">
        <label>
          Từ ngày
          <input type="date" name="tu" defaultValue={tu} />
        </label>
        <label>
          Đến ngày
          <input type="date" name="den" defaultValue={den} />
        </label>
        <div className="actions">
          <button className="primary" type="submit">
            Xem
          </button>
        </div>
      </form>
      <div className="scroller">
        <table>
          <thead>
            <tr>
              <th>Kênh</th>
              <th className="num">Số lần</th>
              <th className="num">Tiền</th>
            </tr>
          </thead>
          <tbody>
            {kenh.map((k) => (
              <tr key={k.kenh}>
                <td>{k.kenh}</td>
                <td className="num mono">{n(k.so_ky)}</td>
                <td className="num mono">{n(k.tien)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
