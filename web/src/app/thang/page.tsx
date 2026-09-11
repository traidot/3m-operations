import {
  getCancelReasons,
  getDifficultDebt,
  getChannelReport,
  getCollectionReport,
  getMonthStats,
  getRegisterReport,
  type RegisterReport,
} from "@/lib/queries";
import { Bars } from "../wifi/bars";
import { HOP_DONG, LY_DO_HUY } from "@/lib/nhan";
import { Chip } from "../chip";

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

  const [dk, thang, thu, kenh, lyDo, khoDoi] = await Promise.all([
    getRegisterReport(donVi, tu, den),
    getMonthStats(),
    getCollectionReport(donVi, tu, den),
    getChannelReport(tu, den),
    getCancelReasons(tu, den),
    getDifficultDebt(),
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

      {/* Theo ngày thì cột quá dày, đọc bảng nhanh hơn nhìn đồ thị. */}
      {donVi === "thang" && (
        <>
          <h2>Đăng ký và huỷ theo tháng</h2>
          <Bars
            nhan={dk.map((r) => r.ky)}
            chuoi={[
              { ten: "Đăng ký", mau: "var(--line-strong)", gia_tri: dk.map((r) => so(r.dang_ky)) },
              { ten: "Lắp xong", mau: "var(--ok)", gia_tri: dk.map((r) => so(r.lap_xong)) },
              { ten: "Huỷ", mau: "var(--bad)", gia_tri: dk.map((r) => so(r.huy)) },
            ]}
          />
        </>
      )}

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

      <h2>Vì sao huỷ</h2>
      <p className="muted">
        Lý do bên nguồn là ô chữ tự do — 582 cách viết cho cùng vài ý, lẫn tiếng Nhật và
        lỗi chính tả — nên phải gom nhóm theo từ khoá. Bấm vào nhóm để ra danh sách.
      </p>
      <div className="scroller">
        <table>
          <thead>
            <tr>
              <th>Nhóm lý do</th>
              <th className="num">Hợp đồng</th>
              <th className="num">Trước lịch</th>
              <th className="num">Sau lịch</th>
              <th className="num">Sau lắp xong</th>
              <th>Tỉ trọng</th>
            </tr>
          </thead>
          <tbody>
            {lyDo.map((r) => {
              const ty = tongHuy > 0 ? (100 * Number(r.so_hop_dong)) / tongHuy : 0;
              return (
                <tr key={r.nhom}>
                  <td>
                    <a href={loc({ ly_do: r.nhom })}>{LY_DO_HUY[r.nhom] ?? r.nhom}</a>
                  </td>
                  <td className="num mono">{n(r.so_hop_dong)}</td>
                  <td className="num mono">{n(r.truoc_lich)}</td>
                  <td className="num mono">{n(r.sau_lich)}</td>
                  <td className={`num mono${Number(r.sau_lap) > 0 ? " bad" : ""}`}>
                    {n(r.sau_lap)}
                  </td>
                  <td>
                    <span className="bar">
                      <span className="bar-fill" style={{ width: `${Math.min(ty, 100)}%` }} />
                      <span className="bar-label mono">{ty.toFixed(1)}%</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted">
        Cột “sau lắp xong” là mất khách sau khi đã tốn tiền thi công — đắt nhất trong ba
        mốc.
      </p>

      <h2>Khách khó đòi</h2>
      <p className="muted">
        Kế toán đánh dấu tay bên hệ thống nguồn, không suy ra từ số kỳ nợ — nên có hợp
        đồng đang nợ 0 đồng vẫn nằm đây, và ngược lại hợp đồng nợ nặng chưa chắc đã bị
        đánh dấu. Không lọc theo khoảng ngày.
      </p>
      {khoDoi.length === 0 ? (
        <p className="empty">Chưa hợp đồng nào bị đánh dấu khó đòi.</p>
      ) : (
        <div className="scroller">
          <table>
            <thead>
              <tr>
                <th>Hợp đồng</th>
                <th>Trạng thái</th>
                <th>Thu tới kỳ</th>
                <th className="num">Kỳ nợ</th>
                <th className="num">Còn nợ</th>
              </tr>
            </thead>
            <tbody>
              {khoDoi.map((k) => (
                <tr key={k.subscription_id}>
                  <td className="mono">
                    <a href={`/hop-dong?xem=${k.subscription_id}`}>{k.contract_code ?? "—"}</a>
                  </td>
                  <td>
                    <Chip ma={k.trang_thai_hop_dong} nhan={HOP_DONG} />
                  </td>
                  <td className="mono">{k.ky_da_thu_gan_nhat ?? "chưa thu kỳ nào"}</td>
                  <td className={`num mono${Number(k.so_ky_no) > 0 ? " bad" : ""}`}>
                    {n(k.so_ky_no)}
                  </td>
                  <td className={`num mono${Number(k.con_no) > 0 ? " bad" : ""}`}>
                    {n(k.con_no)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>Tiền cước thực nhận theo {donVi === "ngay" ? "ngày thu" : "tháng thu"}</h2>
      <p className="muted">
        Gom theo <b>ngày thu tiền</b>, không theo kỳ cước — hôm đó nhận về bao nhiêu, của
        kỳ nào cũng tính. Kỳ miễn phí và kỳ chỉ ghi chú vẫn đếm là một lần chốt sổ nhưng
        không sinh tiền.
      </p>
      {thu.length === 0 ? (
        <p className="empty">Khoảng này không có lần thu nào.</p>
      ) : (
        <>
          {donVi === "thang" && (
            <Bars
              nhan={thu.map((r) => r.ky)}
              cao={150}
              chuoi={[
                { ten: "Tiền thu", mau: "var(--ok)", gia_tri: thu.map((r) => so(r.tien_thu)) },
              ]}
            />
          )}
          <div className="scroller">
            <table>
              <thead>
                <tr>
                  <th>{donVi === "ngay" ? "Ngày thu" : "Tháng thu"}</th>
                  <th className="num">Kỳ chốt</th>
                  <th className="num">Thu tiền</th>
                  <th className="num">Miễn phí</th>
                  <th className="num">Chờ duyệt</th>
                  <th className="num">Ghi chú</th>
                  <th className="num">Hợp đồng</th>
                  <th className="num">Tiền</th>
                </tr>
              </thead>
              <tbody>
                {[...thu].reverse().map((r) => (
                  <tr key={r.ky}>
                    <td className="mono">{r.ky}</td>
                    <td className="num mono">{n(r.so_ky)}</td>
                    <td className="num mono">{n(r.ky_duyet)}</td>
                    <td className="num mono muted">{n(r.ky_mien_phi)}</td>
                    <td className="num mono">{n(r.ky_cho_duyet)}</td>
                    <td className="num mono">{n(r.ky_ghi_chu)}</td>
                    <td className="num mono muted">{n(r.so_hop_dong)}</td>
                    <td className="num mono">{n(r.tien_thu)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2>Theo kênh thu</h2>
      <div className="scroller">
        <table>
          <thead>
            <tr>
              <th>Kênh</th>
              <th className="num">Kỳ chốt</th>
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

      <h2>Cước theo kỳ</h2>
      <p className="muted">
        Kỳ cước bên nguồn ghi dạng YYYY-MM nên phần này chỉ có đơn vị tháng — đây là
        tháng <b>đáng lẽ phải thu</b>, khác với bảng trên. Bấm vào con số để ra danh sách
        hợp đồng.
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
