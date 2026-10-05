import Link from "next/link";
import {
  getNamCoSoLieu,
  getTelecomChannels,
  getTelecomMonthsNam,
  getThangDichVu,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

const n = (v: string | number | null) =>
  v === null ? "—" : Math.round(Number(v)).toLocaleString("vi-VN");

type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? "";

const DUONG_DAN = "/tien/cam-tay";
const thangVn = (ky: string) => `${ky.slice(5, 7)}/${ky.slice(0, 4)}`;

/** Thu dưới mức này thì tháng đó có chuyện, không phải dao động thường. */
const TY_LE_XAU = 90;

/**
 * Tiền của mảng wifi cầm tay.
 *
 * Khác bên cố định ở gốc: hệ này có HOÁ ĐƠN thật nên công nợ đọc thẳng, không
 * phải suy từ sổ thu. Vì vậy màn không có hai trục "kỳ cước / ngày tiền về"
 * như bên kia — chỉ một trục kỳ cước, và phải thu / đã thu nằm cùng một dòng.
 *
 * Số đếm theo hoá đơn nên gồm cả cọc, bán máy và phí đăng ký, không riêng cước.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Tham>;
}) {
  const [namRows, sp] = await Promise.all([getNamCoSoLieu(), searchParams]);

  // Danh sách trả về mới nhất trước, nên mặc định lấy phần tử đầu chứ không
  // phải cuối — lấy cuối thì mở màn ra là năm cũ nhất.
  const cacNam = namRows.map((r) => r.nam);
  const namNay = new Date().toISOString().slice(0, 4);
  const nam = cacNam.includes(mot(sp.nam))
    ? mot(sp.nam)
    : cacNam.includes(namNay)
      ? namNay
      : (cacNam[0] ?? namNay);

  const [thang, kenh, dichVu] = await Promise.all([
    getTelecomMonthsNam(nam),
    getTelecomChannels(`${nam}-01-01`, `${nam}-12-31`),
    getThangDichVu(nam),
  ]);

  const cong = (lay: (r: (typeof thang)[number]) => string | null) =>
    thang.reduce((t, r) => t + Number(lay(r) ?? 0), 0);
  const phaiThu = cong((r) => r.phai_thu);
  const daThu = cong((r) => r.da_thu);
  const conDoi = cong((r) => r.con_doi);
  const matTrang = cong((r) => r.mat_trang);

  // Dịch vụ gom cả năm, vì xem từng tháng × từng dịch vụ là bảng quá dày.
  const theoDichVu = [...new Set(dichVu.map((r) => r.dich_vu))]
    .map((dv) => {
      const ds = dichVu.filter((r) => r.dich_vu === dv);
      const p = ds.reduce((t, r) => t + Number(r.phai_thu ?? 0), 0);
      const d = ds.reduce((t, r) => t + Number(r.da_thu ?? 0), 0);
      return { dv, phai_thu: p, da_thu: d, chua: p - d };
    })
    .sort((a, b) => b.phai_thu - a.phai_thu);

  return (
    <main>
      <h1>Tiền · wifi cầm tay · năm {nam}</h1>
      <p className="muted">
        Hệ này có <b>hoá đơn thật</b> nên công nợ đọc thẳng, không phải suy từ
        sổ thu như bên cố định. Vì vậy không có hai trục &ldquo;kỳ cước / ngày
        tiền về&rdquo; — chỉ một trục kỳ cước, phải thu và đã thu nằm cùng một
        dòng. Bên cố định xem ở <Link href="/tien/co-dinh">Tiền · cố định →</Link>
      </p>
      <p className="muted">
        Số đếm theo <b>hoá đơn</b>, tức gồm cả cọc, bán máy và phí đăng ký chứ
        không riêng tiền cước. Thuê bao của đại lý không tính vì đại lý tự thu.
      </p>

      <div className="nhom-loc">
        <div className="muted nhan-nhom">Năm</div>
        <p className="actions">
          {cacNam.map((y) => (
            <Link key={y} href={`${DUONG_DAN}?nam=${y}`}>
              <button type="button" className={y === nam ? "primary" : undefined}>
                {y}
              </button>
            </Link>
          ))}
        </p>
      </div>

      <h2>
        Năm {nam} phải thu {n(phaiThu)}, đã thu {n(daThu)}
      </h2>
      <p className="muted">
        Ghép theo <b>kỳ cước</b>, không theo ngày lập hoá đơn. &ldquo;Còn
        đòi&rdquo; là hoá đơn chưa thu mà vẫn đòi được; &ldquo;mất trắng&rdquo;
        là đã đánh dấu không đòi được nữa — hai cột đó không cộng vào nhau.
        Tháng thu dưới {TY_LE_XAU}% tô đỏ.
      </p>
      <div className="scroller">
        <table>
          <thead>
            <tr>
              <th>Tháng</th>
              <th className="num">Hoá đơn</th>
              <th className="num">Thuê bao</th>
              <th className="num">Phải thu</th>
              <th className="num">Đã thu</th>
              <th className="num">Còn đòi</th>
              <th className="num">Mất trắng</th>
              <th className="num">Tỷ lệ thu</th>
            </tr>
          </thead>
          <tbody>
            <tr className="hang-tong">
              <td>
                <b>Cả năm</b>
              </td>
              <td className="num mono">{n(cong((r) => r.so_hoa_don))}</td>
              <td className="num mono muted">—</td>
              <td className="num mono">{n(phaiThu)}</td>
              <td className="num mono">
                <b>{n(daThu)}</b>
              </td>
              <td className="num mono">{n(conDoi)}</td>
              <td className={`num mono${matTrang > 0 ? " bad" : ""}`}>
                {n(matTrang)}
              </td>
              <td className="num mono">
                {phaiThu === 0 ? "—" : `${Math.round((daThu / phaiThu) * 1000) / 10}%`}
              </td>
            </tr>
            {thang.map((r) => {
              const ty = r.ty_le_thu === null ? null : Number(r.ty_le_thu);
              return (
                <tr key={r.ky}>
                  <td className="mono">{thangVn(r.ky)}</td>
                  <td className="num mono muted">{n(r.so_hoa_don)}</td>
                  <td className="num mono muted">{n(r.so_thue_bao)}</td>
                  <td className="num mono">{n(r.phai_thu)}</td>
                  <td className="num mono">
                    <b>{n(r.da_thu)}</b>
                  </td>
                  <td className="num mono muted">{n(r.con_doi)}</td>
                  <td
                    className={`num mono${Number(r.mat_trang ?? 0) > 0 ? " bad" : " muted"}`}
                  >
                    {n(r.mat_trang)}
                  </td>
                  <td
                    className={`num mono${ty !== null && ty < TY_LE_XAU ? " bad" : ""}`}
                  >
                    {ty === null ? "—" : `${ty}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>Tiền về theo kênh</h2>
      <p className="muted">
        Khách trả bằng đường nào. Gom theo <b>ngày tiền về</b> trong năm {nam},
        nên không cộng chéo được với bảng trên — bảng trên xếp theo kỳ cước.
      </p>
      {kenh.length === 0 ? (
        <p className="muted">Năm này chưa có lần thu nào.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Kênh</th>
              <th className="num">Số lần</th>
              <th className="num">Tiền</th>
            </tr>
          </thead>
          <tbody>
            {kenh.map((r) => (
              <tr key={r.kenh}>
                <td>{r.kenh}</td>
                <td className="num mono muted">{n(r.so_ky)}</td>
                <td className="num mono">{n(r.tien)}</td>
              </tr>
            ))}
            <tr className="hang-tong">
              <td>
                <b>Tổng</b>
              </td>
              <td className="num mono">
                {n(kenh.reduce((t, r) => t + Number(r.so_ky), 0))}
              </td>
              <td className="num mono">
                <b>{n(kenh.reduce((t, r) => t + Number(r.tien), 0))}</b>
              </td>
            </tr>
          </tbody>
        </table>
      )}

      <h2>Theo dịch vụ</h2>
      <p className="muted">
        Cả năm {nam}, gom mọi tháng. Xem từng tháng × từng dịch vụ thì bảng quá
        dày mà không thêm được kết luận nào.
      </p>
      {theoDichVu.length === 0 ? (
        <p className="muted">Năm này chưa có dịch vụ nào ra cước.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Dịch vụ</th>
              <th className="num">Phải thu</th>
              <th className="num">Đã thu</th>
              <th className="num">Chưa thu</th>
              <th className="num">Tỷ lệ</th>
            </tr>
          </thead>
          <tbody>
            {theoDichVu.map((r) => {
              const ty =
                r.phai_thu === 0
                  ? null
                  : Math.round((r.da_thu / r.phai_thu) * 1000) / 10;
              return (
                <tr key={r.dv}>
                  <td>{r.dv}</td>
                  <td className="num mono">{n(r.phai_thu)}</td>
                  <td className="num mono">
                    <b>{n(r.da_thu)}</b>
                  </td>
                  <td className={`num mono${r.chua > 0 ? " bad" : " muted"}`}>
                    {n(r.chua)}
                  </td>
                  <td
                    className={`num mono${ty !== null && ty < TY_LE_XAU ? " bad" : ""}`}
                  >
                    {ty === null ? "—" : `${ty}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <h2>Lỗ hổng</h2>
      <p className="muted">
        Tiền đã về mà chưa ai nói nó trả cho hoá đơn nào thì khách vẫn bị tính
        là đang nợ — đống đó nằm ở{" "}
        <Link href="/diem-nghen?mo=CHO_GAN_HD">trạm chờ gán hoá đơn →</Link>{" "}
        Máy của thuê bao đã đóng mà chưa về kho giữ tiền cọc, xem ở{" "}
        <Link href="/diem-nghen?mo=CHO_THU_MAY">trạm chờ thu hồi máy →</Link>
      </p>
    </main>
  );
}
