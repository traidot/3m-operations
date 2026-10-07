import Link from "next/link";
import { Bars } from "../../wifi/bars";
import { LocKhoang, docKhoang, type Tham } from "../khoang";
import {
  getChannelReport,
  getCollectionReport,
  getMonthStats,
} from "@/lib/queries";

const n = (v: string | null) => (v === null ? "—" : Number(v).toLocaleString("vi-VN"));
const so = (v: string | null) => (v === null ? null : Number(v));
const loc = (tham: Record<string, string>) => `/tra-cuu/co-dinh?${new URLSearchParams(tham)}`;

export async function NoiDungTienThang({ searchParams }: { searchParams: Promise<Tham> }) {
  const sp = await searchParams;
  const { donVi, tu, den } = docKhoang(sp);

  const [thu, kenh, thang] = await Promise.all([
    getCollectionReport(donVi, tu, den),
    getChannelReport(tu, den),
    getMonthStats(tu, den),
  ]);

  return (
    <>
      <p className="muted">
        Hai bảng đầu xếp theo <b>ngày tiền về</b>, bảng cuối theo <b>kỳ cước</b> — tháng
        đáng lẽ phải thu. Cùng một đồng tiền nhưng hai trục khác nhau, đừng cộng chéo
        giữa chúng. Phần đăng ký, lắp đặt và huỷ nằm ở{" "}
        <Link href="/diem-nghen?xem=dong-chay&he=co-dinh">Hợp đồng theo tháng</Link>.
      </p>

      <LocKhoang donVi={donVi} tu={tu} den={den} veMacDinh="/tien/co-dinh?xem=thuc-nhan" />

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
              <th className="num">Khó đòi</th>
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
                    <Link href={loc({ ky: r.ky })}>{n(r.so_ky)}</Link>
                  </td>
                  <td className="num mono">
                    <Link href={loc({ ky: r.ky, ky_tt: "DA_THU" })}>{n(r.ky_da_thu)}</Link>
                  </td>
                  <td className="num mono muted">{n(r.ky_mien_phi)}</td>
                  <td className="num mono">{n(r.ky_cho_duyet)}</td>
                  <td className="num mono">{n(r.ky_ghi_chu)}</td>
                  <td className={`num mono${Number(r.ky_chua_thu ?? 0) > 0 ? " bad" : ""}`}>
                    <Link href={loc({ ky: r.ky, ky_tt: "NO" })}>{n(r.ky_chua_thu)}</Link>
                  </td>
                  <td className={`num mono${Number(r.hop_dong_kho_doi ?? 0) > 0 ? " bad" : ""}`}>
                    {Number(r.hop_dong_kho_doi ?? 0) > 0 ? (
                      <Link href={loc({ ky: r.ky, cb: "KHO_DOI" })}>{n(r.hop_dong_kho_doi)}</Link>
                    ) : (
                      n(r.hop_dong_kho_doi)
                    )}
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
    </>
  );
}
