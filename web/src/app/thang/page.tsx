import { getMonthStats, getRegisterReport, type RegisterReport } from "@/lib/queries";
import { Bars } from "../wifi/bars";

export const dynamic = "force-dynamic";

const n = (v: string | null) => (v === null ? "—" : Number(v).toLocaleString("vi-VN"));
const so = (v: string | null) => (v === null ? null : Number(v));
const loc = (tham: Record<string, string>) => `/hop-dong?${new URLSearchParams(tham)}`;
const ngay = (d: Date) => d.toISOString().slice(0, 10);

type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Mặc định: theo tháng thì 12 tháng gần nhất, theo ngày thì 30 ngày. */
function khoang(donVi: "ngay" | "thang") {
  const den = new Date();
  const tu = new Date(den);
  if (donVi === "ngay") tu.setDate(tu.getDate() - 30);
  else tu.setMonth(tu.getMonth() - 11, 1);
  return { tu: ngay(tu), den: ngay(den) };
}

function cong(rows: RegisterReport[], k: keyof RegisterReport) {
  return rows.reduce((t, r) => t + Number(r[k] ?? 0), 0);
}

function The({ ten, gia_tri, phu }: { ten: string; gia_tri: number; phu?: string }) {
  return (
    <div className="the-so">
      <div className="the-ten">{ten}</div>
      <div className="the-gia-tri mono">{gia_tri.toLocaleString("vi-VN")}</div>
      {phu && <div className="the-phu mono">{phu}</div>}
    </div>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<Tham> }) {
  const sp = await searchParams;
  const donVi: "ngay" | "thang" = mot(sp.don_vi) === "ngay" ? "ngay" : "thang";
  const mac = khoang(donVi);
  const tu = mot(sp.tu) || mac.tu;
  const den = mot(sp.den) || mac.den;

  const [dk, thang] = await Promise.all([
    getRegisterReport(donVi, tu, den),
    getMonthStats(),
  ]);

  const tongDangKy = cong(dk, "dang_ky");
  const tongHuy = cong(dk, "huy");
  const nguoc = [...dk].reverse();

  return (
    <main>
      <h1>Báo cáo wifi cố định</h1>
      <p className="muted">
        Xếp theo <b>ngày ký</b>: hợp đồng ký tháng 3 huỷ tháng 7 vẫn nằm ở dòng tháng 3.
        Đây là báo cáo theo lứa đăng ký, không phải theo ngày xảy ra sự việc. Cách chia
        giống báo cáo tổng hợp bên CMS nên đối chiếu được.
      </p>

      <form method="get" className="formgrid">
        <label>
          Đơn vị
          <span className="o-chon">
            <select name="don_vi" defaultValue={donVi}>
              <option value="thang">theo tháng</option>
              <option value="ngay">theo ngày</option>
            </select>
          </span>
        </label>
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
          <a href="/thang">
            <button type="button">Mặc định</button>
          </a>
        </div>
      </form>

      <div className="the-hang">
        <The ten="Đăng ký lần đầu" gia_tri={cong(dk, "dang_ky_lan_dau")} />
        <The ten="Đăng ký lại" gia_tri={cong(dk, "dang_ky_lai")} />
        <The
          ten="Tổng huỷ"
          gia_tri={tongHuy}
          phu={tongDangKy > 0 ? `${((100 * tongHuy) / tongDangKy).toFixed(2)}%` : undefined}
        />
        <The ten="Lắp đặt thành công" gia_tri={cong(dk, "lap_xong")} />
        <The ten="Có lịch chưa lắp" gia_tri={cong(dk, "co_lich_lap")} />
        <The ten="Lắp đặt thất bại" gia_tri={cong(dk, "lap_that_bai")} />
        <The ten="Còn lại" gia_tri={cong(dk, "con_lai")} />
      </div>

      <h2>Đăng ký và huỷ theo {donVi === "ngay" ? "ngày" : "tháng"}</h2>
      <Bars
        nhan={dk.map((r) => r.ky)}
        chuoi={[
          { ten: "Đăng ký", mau: "var(--line-strong)", gia_tri: dk.map((r) => so(r.dang_ky)) },
          { ten: "Lắp xong", mau: "var(--ok)", gia_tri: dk.map((r) => so(r.lap_xong)) },
          { ten: "Huỷ", mau: "var(--bad)", gia_tri: dk.map((r) => so(r.huy)) },
        ]}
      />

      <div className="scroller">
        <table>
          <thead>
            <tr>
              <th rowSpan={2}>{donVi === "ngay" ? "Ngày" : "Tháng"}</th>
              <th colSpan={3} className="nhom">Đăng ký</th>
              <th colSpan={4} className="nhom">Huỷ</th>
              <th rowSpan={2} className="num">Còn lại</th>
              <th colSpan={2} className="nhom">Lịch lắp của địa chỉ chưa huỷ</th>
              <th rowSpan={2} className="num">Lắp xong</th>
              <th rowSpan={2} className="num">Lắp thất bại</th>
            </tr>
            <tr>
              <th className="num">Lần đầu</th>
              <th className="num">Đăng ký lại</th>
              <th className="num">Tổng</th>
              <th className="num">Trước lịch</th>
              <th className="num">Sau lịch</th>
              <th className="num">Sau lắp xong</th>
              <th className="num">Tỷ lệ</th>
              <th className="num">Có lịch</th>
              <th className="num">Chưa có lịch</th>
            </tr>
          </thead>
          <tbody>
            {nguoc.map((r) => {
              const ty = r.ty_le_huy === null ? null : Number(r.ty_le_huy);
              return (
                <tr key={r.ky}>
                  <td className="mono">
                    {donVi === "ngay" ? r.ky : <a href={loc({ thang_ky: r.ky })}>{r.ky}</a>}
                  </td>
                  <td className="num mono">{n(r.dang_ky_lan_dau)}</td>
                  <td className="num mono muted">{n(r.dang_ky_lai)}</td>
                  <td className="num mono">{n(r.dang_ky)}</td>
                  <td className="num mono">{n(r.huy_truoc_lich)}</td>
                  <td className="num mono">{n(r.huy_sau_lich)}</td>
                  <td className="num mono">{n(r.huy_sau_lap)}</td>
                  <td className={`num mono${ty !== null && ty >= 40 ? " bad" : ""}`}>
                    {ty === null ? "—" : `${ty}%`}
                  </td>
                  <td className="num mono">{n(r.con_lai)}</td>
                  <td className="num mono">{n(r.co_lich_lap)}</td>
                  <td className="num mono">{n(r.chua_co_lich)}</td>
                  <td className="num mono">{n(r.lap_xong)}</td>
                  <td className={`num mono${Number(r.lap_that_bai) > 0 ? " bad" : ""}`}>
                    {n(r.lap_that_bai)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>Cước theo kỳ</h2>
      <p className="muted">
        Kỳ cước luôn là tháng nên phần này không chia theo ngày được. Ghép theo kỳ, không
        theo ngày thu. Bấm vào con số để ra danh sách hợp đồng.
      </p>
      <div className="scroller">
        <table>
          <thead>
            <tr>
              <th>Kỳ</th>
              <th className="num">Tổng kỳ</th>
              <th className="num">Đã thu</th>
              <th className="num">Miễn</th>
              <th className="num">Chờ duyệt</th>
              <th className="num">Ghi chú</th>
              <th className="num">Chưa thu</th>
              <th className="num">Tiền đã thu</th>
              <th className="num">Tiền thiếu</th>
              <th>Kỳ xong</th>
            </tr>
          </thead>
          <tbody>
            {[...thang].reverse().map((r) => {
              const ty = r.ty_le_ky_xong === null ? null : Number(r.ty_le_ky_xong);
              return (
                <tr key={r.ky}>
                  <td className="mono">{r.ky}</td>
                  <td className="num mono">
                    <a href={loc({ ky: r.ky })}>{n(r.so_ky)}</a>
                  </td>
                  <td className="num mono">
                    <a href={loc({ ky: r.ky, ky_tt: "DA_THU" })}>{n(r.ky_da_thu)}</a>
                  </td>
                  <td className="num mono muted">{n(r.ky_mien_phi)}</td>
                  <td className="num mono">{n(r.ky_cho_duyet)}</td>
                  <td className="num mono">{n(r.ky_ghi_chu)}</td>
                  <td className={`num mono${Number(r.ky_chua_thu ?? 0) > 0 ? " bad" : ""}`}>
                    <a href={loc({ ky: r.ky, ky_tt: "NO" })}>{n(r.ky_chua_thu)}</a>
                  </td>
                  <td className="num mono">{n(r.tien_da_thu)}</td>
                  <td className={`num mono${Number(r.tien_chua_thu ?? 0) > 0 ? " bad" : ""}`}>
                    {n(r.tien_chua_thu)}
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
    </main>
  );
}
