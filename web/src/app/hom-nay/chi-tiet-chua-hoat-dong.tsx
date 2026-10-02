import { NganKeo } from "../ngan-keo";
import { getChuaHoatDong } from "@/lib/queries";

const n = (v: string | number | null) =>
  v === null ? "—" : Math.round(Number(v)).toLocaleString("vi-VN");

const ngayVn = (iso: string | null) =>
  iso === null ? "—" : `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/**
 * Hợp đồng đã lắp xong nhưng chưa tới ngày bắt đầu thu.
 *
 * Xếp hợp đồng KHÔNG ghi lý do lên trước: hợp đồng có ghi "chờ TP Link",
 * "khách hẹn ngày 20" là đang chờ thật, còn hợp đồng không ai ghi gì thì không
 * biết nó đợi điều gì — đó mới là việc phải làm.
 */
export async function ChiTietChuaHoatDong({ dongLai }: { dongLai: string }) {
  const rows = await getChuaHoatDong();
  const khongLyDo = rows.filter((r) => r.ly_do === null);
  const cuocKhong = khongLyDo.reduce((t, r) => t + Number(r.cuoc_thang ?? 0), 0);
  const cuoc = rows.reduce((t, r) => t + Number(r.cuoc_thang ?? 0), 0);

  return (
    <NganKeo dongLai={dongLai}>
      <h1>Hợp đồng chưa hoạt động</h1>
      <p className="muted">
        {n(rows.length)} hợp đồng của công ty đã lắp xong nhưng chưa tới ngày bắt
        đầu thu, tổng <b>{n(cuoc)}</b> yên cước mỗi tháng chưa chạy. Trong đó{" "}
        <b>{n(khongLyDo.length)}</b> cái không ghi lý do gì ({n(cuocKhong)} yên) —
        hợp đồng có ghi “chờ TP Link”, “khách hẹn ngày…” thì đang chờ thật, còn
        những cái này không ai biết nó đợi điều gì.
      </p>

      {rows.length === 0 ? (
        <p className="muted">Không có hợp đồng nào.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Hợp đồng</th>
              <th>Địa chỉ</th>
              <th className="num">Cước/tháng</th>
              <th>Lắp xong</th>
              <th className="num">Sau lắp</th>
              <th>Lý do chưa hoàn thành</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
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
                <td className="num mono muted">{n(r.cuoc_thang)}</td>
                <td className="mono muted">{ngayVn(r.ngay_lap_xong)}</td>
                <td className="num mono muted">
                  {r.sau_lap_ngay === null ? "—" : `${n(r.sau_lap_ngay)} ngày`}
                </td>
                <td>
                  {r.ly_do === null ? (
                    <span className="tag warn">không ghi lý do</span>
                  ) : (
                    <span className="muted">{r.ly_do}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </NganKeo>
  );
}
