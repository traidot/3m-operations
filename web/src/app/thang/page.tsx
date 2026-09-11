import { getMonthStats } from "@/lib/queries";
import { Bars } from "../wifi/bars";

export const dynamic = "force-dynamic";

const n = (v: string | null) => (v === null ? "—" : Number(v).toLocaleString("vi-VN"));
const so = (v: string | null) => (v === null ? null : Number(v));

/** Dẫn sang danh sách hợp đồng đã lọc sẵn, để bấm số là ra ngay từng hợp đồng. */
const loc = (tham: Record<string, string>) => `/hop-dong?${new URLSearchParams(tham)}`;

function So({ gia_tri, den, xau }: { gia_tri: string | null; den?: string; xau?: boolean }) {
  const chu = n(gia_tri);
  if (gia_tri === null || Number(gia_tri) === 0 || !den) {
    return <span className={xau && Number(gia_tri) > 0 ? "bad" : undefined}>{chu}</span>;
  }
  return (
    <a href={den} className={xau ? "bad" : undefined}>
      {chu}
    </a>
  );
}

export default async function Page() {
  const rows = await getMonthStats();
  const nhan = rows.map((r) => r.ky);
  const nguoc = [...rows].reverse();

  return (
    <main>
      <h1>Wifi cố định theo tháng</h1>
      <p className="muted">
        Vòng đời hợp đồng lấy theo ngày ký và ngày huỷ trong hệ thống; cước lấy theo kỳ
        cước, không theo ngày thu — tiền một kỳ có thể thu ở tháng khác. Bấm vào con số
        để ra danh sách hợp đồng tương ứng.
      </p>

      <h2>Ký mới, lắp xong và huỷ</h2>
      <Bars
        nhan={nhan}
        chuoi={[
          { ten: "Ký mới", mau: "var(--line-strong)", gia_tri: rows.map((r) => so(r.ky_moi)) },
          { ten: "Lắp xong", mau: "var(--ok)", gia_tri: rows.map((r) => so(r.lap_xong)) },
          { ten: "Huỷ", mau: "var(--bad)", gia_tri: rows.map((r) => so(r.huy)) },
        ]}
      />

      <h2>Kỳ cước phải thu và kỳ chưa thu</h2>
      <Bars
        nhan={nhan}
        chuoi={[
          { ten: "Tổng kỳ", mau: "var(--line-strong)", gia_tri: rows.map((r) => so(r.so_ky)) },
          { ten: "Đã thu", mau: "var(--ok)", gia_tri: rows.map((r) => so(r.ky_da_thu)) },
          { ten: "Chưa thu", mau: "var(--bad)", gia_tri: rows.map((r) => so(r.ky_chua_thu)) },
        ]}
      />

      <h2>Số chi tiết</h2>
      <div className="scroller">
        <table>
          <thead>
            <tr>
              <th>Tháng</th>
              <th className="num">Ký mới</th>
              <th className="num">Lắp xong</th>
              <th className="num">Huỷ</th>
              <th className="num">Luỹ kế chưa huỷ</th>
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
            {nguoc.map((r) => {
              const ty = r.ty_le_ky_xong === null ? null : Number(r.ty_le_ky_xong);
              return (
                <tr key={r.ky}>
                  <td className="mono">{r.ky}</td>
                  <td className="num mono">
                    <So gia_tri={r.ky_moi} den={loc({ thang_ky: r.ky })} />
                  </td>
                  <td className="num mono">{n(r.lap_xong)}</td>
                  <td className="num mono">
                    <So gia_tri={r.huy} den={loc({ thang_huy: r.ky })} />
                  </td>
                  <td className="num mono muted">{n(r.luy_ke_chua_huy)}</td>
                  <td className="num mono">
                    <So gia_tri={r.so_ky} den={loc({ ky: r.ky })} />
                  </td>
                  <td className="num mono">
                    <So gia_tri={r.ky_da_thu} den={loc({ ky: r.ky, ky_tt: "DA_THU" })} />
                  </td>
                  <td className="num mono muted">
                    <So gia_tri={r.ky_mien_phi} den={loc({ ky: r.ky, ky_tt: "MIEN_PHI" })} />
                  </td>
                  <td className="num mono">
                    <So gia_tri={r.ky_cho_duyet} den={loc({ ky: r.ky, ky_tt: "CHO_DUYET" })} />
                  </td>
                  <td className="num mono">
                    <So gia_tri={r.ky_ghi_chu} den={loc({ ky: r.ky, ky_tt: "GHI_CHU" })} />
                  </td>
                  <td className="num mono">
                    <So gia_tri={r.ky_chua_thu} den={loc({ ky: r.ky, ky_tt: "NO" })} xau />
                  </td>
                  <td className="num mono">{n(r.tien_da_thu)}</td>
                  <td className="num mono">
                    <span className={Number(r.tien_chua_thu ?? 0) > 0 ? "bad" : undefined}>
                      {n(r.tien_chua_thu)}
                    </span>
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
      <p className="muted">
        “Luỹ kế chưa huỷ” đếm hợp đồng đã ký và chưa ghi ngày huỷ tính tới cuối tháng —
        gồm cả hợp đồng chưa lắp, nên cao hơn số hợp đồng đang chạy thật.
      </p>
    </main>
  );
}
