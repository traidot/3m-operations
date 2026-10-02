import { NganKeo } from "../ngan-keo";
import { getHuyNgay } from "@/lib/queries";
import { LY_DO_HUY } from "@/lib/nhan";

const n = (v: string | number | null) =>
  v === null ? "—" : Math.round(Number(v)).toLocaleString("vi-VN");

const ngayVn = (iso: string | null) =>
  iso === null ? "—" : `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** Số ngày từ ký tới huỷ, để thấy hợp đồng sống được bao lâu. */
const song = (ky: string | null, huy: string) => {
  if (ky === null) return null;
  const ms = Date.parse(huy) - Date.parse(ky);
  return Number.isNaN(ms) ? null : Math.round(ms / 86_400_000);
};

/**
 * Hợp đồng huỷ trong một ngày.
 *
 * Cột "sống được" là khoảng từ ngày ký tới ngày huỷ: huỷ sau vài ngày là đơn
 * hỏng ngay từ đầu, huỷ sau một năm là khách bỏ đi — hai chuyện khác hẳn nhau
 * mà nhìn tổng số huỷ thì không phân biệt được.
 */
export async function ChiTietHuy({ ngay, dongLai }: { ngay: string; dongLai: string }) {
  const rows = await getHuyNgay(ngay);
  const no = rows.reduce((t, r) => t + Number(r.con_no ?? 0), 0);
  const chuaLap = rows.filter((r) => r.ngay_lap_xong === null).length;
  const khongLyDo = rows.filter((r) => r.nhom_ly_do_huy === null).length;

  return (
    <NganKeo dongLai={dongLai}>
      <h1>Huỷ ngày {ngayVn(ngay)}</h1>
      <p className="muted">
        {n(rows.length)} hợp đồng.
        {chuaLap > 0 && ` ${n(chuaLap)} cái huỷ khi còn chưa lắp xong.`}
        {no > 0 && ` Còn nợ ${n(no)} yên khi huỷ.`}
        {khongLyDo > 0 && ` ${n(khongLyDo)} cái không ghi lý do.`}
      </p>

      {rows.length === 0 ? (
        <p className="muted">Không có hợp đồng nào huỷ ngày này.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Hợp đồng</th>
              <th>Địa chỉ</th>
              <th>Ký</th>
              <th className="num">Sống được</th>
              <th>Lý do</th>
              <th className="num">Còn nợ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const ngaySong = song(r.ngay_ky, ngay);
              return (
                <tr key={r.subscription_id}>
                  <td className="mono">
                    {r.url === null ? (
                      (r.ma_hd ?? "—")
                    ) : (
                      <a href={r.url} target="_blank" rel="noreferrer">
                        {r.ma_hd ?? "mở CMS"}
                      </a>
                    )}
                  </td>
                  <td className="muted">{r.dia_chi ?? "—"}</td>
                  <td className="mono muted">{ngayVn(r.ngay_ky)}</td>
                  <td className="num mono muted">
                    {ngaySong === null ? "—" : `${n(ngaySong)} ngày`}
                  </td>
                  <td className="muted">
                    {r.nhom_ly_do_huy === null
                      ? "—"
                      : (LY_DO_HUY[r.nhom_ly_do_huy] ?? r.nhom_ly_do_huy)}
                  </td>
                  <td className={`num mono${Number(r.con_no ?? 0) > 0 ? " bad" : " muted"}`}>
                    {Number(r.con_no ?? 0) === 0 ? "—" : n(r.con_no)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </NganKeo>
  );
}
