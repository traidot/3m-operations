import {
  getArrears,
  getCoverage,
  getMonthlyByStatus,
  getMonthlyTotal,
  getPendingPeriods,
  type MonthlyByStatus,
} from "@/lib/queries";
import { HOP_DONG, LAP_DAT } from "@/lib/nhan";

export const dynamic = "force-dynamic";

const n = (v: string | null) => (v === null ? "—" : Number(v).toLocaleString("vi-VN"));


export default async function Page() {
  const [total, byStatus, [coverage], arrears, pending] = await Promise.all([
    getMonthlyTotal(),
    getMonthlyByStatus(),
    getCoverage(),
    getArrears(),
    getPendingPeriods(),
  ]);

  const theoKy = new Map<string, MonthlyByStatus[]>();
  for (const r of byStatus) {
    theoKy.set(r.ky, [...(theoKy.get(r.ky) ?? []), r]);
  }

  const phu = Number(coverage?.ty_le_tinh_duoc ?? 0);

  return (
    <main>
      <h1>Cước wifi cố định</h1>

      {/* Độ phủ đứng trên cùng: không biết nó thì mọi số dưới đều đọc sai. */}
      <div className={phu < 80 ? "stale" : "muted"}>
        Chỉ tính được cước cho <b>{n(coverage?.tinh_duoc ?? null)}</b> trên{" "}
        <b>{n(coverage?.hop_dong_dang_chay ?? null)}</b> hợp đồng đang chạy ({phu}%).
        {Number(coverage?.thieu_gia_cuoc ?? 0) > 0 && (
          <> {n(coverage!.thieu_gia_cuoc)} hợp đồng thiếu giá cước nên không sinh được kỳ.</>
        )}{" "}
        Mọi con số bên dưới là phần tính được, không phải toàn bộ.
      </div>

      <h2>Theo tháng</h2>
      <p className="muted">
        Ghép theo kỳ cước, không theo ngày thu — tiền một kỳ có thể được thu ở tháng khác.
      </p>
      <div className="scroller">
        <table>
          <thead>
            <tr>
              <th>Kỳ</th>
              <th className="num">Hợp đồng</th>
              <th className="num">Phải thu</th>
              <th className="num">Miễn phí</th>
              <th className="num">Đã thu</th>
              <th className="num">Còn thiếu</th>
              <th>Tỉ lệ thu</th>
            </tr>
          </thead>
          <tbody>
            {total.map((r) => (
              <TableRows key={r.ky} row={r} chiTiet={theoKy.get(r.ky) ?? []} />
            ))}
          </tbody>
        </table>
      </div>

      {pending.length > 0 && (
        <p className="muted">
          Chưa chốt:{" "}
          {pending
            .map((p) => `${n(p.so_ky)} kỳ ${p.status}${Number(p.tien) > 0 ? ` (${n(p.tien)})` : ""}`)
            .join(", ")}
          . Những kỳ này chưa quyết là thu hay miễn nên chưa vào bảng trên.
        </p>
      )}

      <h2>Nợ từ ba kỳ trở lên ({arrears.length >= 20 ? "20 nặng nhất" : arrears.length})</h2>
      {arrears.length === 0 ? (
        <p className="empty">Không có hợp đồng nào nợ quá ngưỡng.</p>
      ) : (
        <div className="scroller">
          <table>
            <thead>
              <tr>
                <th>Hợp đồng</th>
                <th>Trạng thái</th>
                <th>Thu tới kỳ</th>
                <th className="num">Tổng kỳ</th>
                <th className="num">Miễn phí</th>
                <th className="num">Kỳ nợ</th>
                <th className="num">Đã thu</th>
                <th className="num">Còn nợ</th>
              </tr>
            </thead>
            <tbody>
              {arrears.map((a) => (
                <tr key={a.subscription_id}>
                  <td className="mono">
                    {/* Lớp giám sát chỉ đọc, muốn sửa phải sang hệ thống nguồn. */}
                    {a.lien_ket ? (
                      <a href={a.lien_ket} target="_blank" rel="noreferrer">
                        {a.contract_code}
                      </a>
                    ) : (
                      a.contract_code
                    )}
                  </td>
                  <td>
                    <span className="mono">{HOP_DONG[a.trang_thai_hop_dong] ?? a.trang_thai_hop_dong}</span>
                    <br />
                    <span className="mono muted">
                      {a.trang_thai_lap_dat ? (LAP_DAT[a.trang_thai_lap_dat] ?? a.trang_thai_lap_dat) : "—"}
                    </span>
                  </td>
                  <td>
                    <span className="mono">{a.ky_da_thu_gan_nhat ?? "chưa thu kỳ nào"}</span>
                    {(a.ky_cho_duyet > 0 || a.ky_ghi_chu > 0) && (
                      <>
                        <br />
                        <span className="mono muted">
                          {a.ky_cho_duyet > 0 && `${a.ky_cho_duyet} kỳ chờ duyệt`}
                          {a.ky_cho_duyet > 0 && a.ky_ghi_chu > 0 && " · "}
                          {a.ky_ghi_chu > 0 && `${a.ky_ghi_chu} kỳ ghi chú`}
                        </span>
                      </>
                    )}
                  </td>
                  <td className="num mono muted">{a.so_ky}</td>
                  <td className="num mono muted">{a.so_ky_mien_phi || "—"}</td>
                  <td className={`num mono ${a.so_ky_no >= 6 ? "bad" : ""}`}>{a.so_ky_no}</td>
                  <td className="num mono">{n(a.tong_da_thu)}</td>
                  <td className="num mono bad">{n(a.con_no)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function TableRows({ row, chiTiet }: { row: MonthlyByStatus | any; chiTiet: MonthlyByStatus[] }) {
  const ty = row.ty_le_thu === null ? null : Number(row.ty_le_thu);

  return (
    <>
      <tr>
        <td className="mono">{row.ky}</td>
        <td className="num mono">{n(row.so_hop_dong)}</td>
        <td className="num mono">{n(row.phai_thu)}</td>
        <td className="num mono muted">{n(row.tien_mien_phi)}</td>
        <td className="num mono">{n(row.da_thu)}</td>
        <td className="num mono">{n(row.con_thieu)}</td>
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
      {chiTiet.length > 1 &&
        chiTiet.map((c) => (
          <tr key={`${c.ky}-${c.trang_thai}`} className="sub">
            <td className="mono muted">{c.trang_thai}</td>
            <td className="num mono muted">{n(c.so_hop_dong)}</td>
            <td className="num mono muted">{n(c.phai_thu)}</td>
            <td className="num mono muted">{n(c.tien_mien_phi)}</td>
            <td className="num mono muted">{n(c.da_thu)}</td>
            <td className="num mono muted">{n(c.con_thieu)}</td>
            <td className="mono muted">{c.ty_le_thu === null ? "—" : `${c.ty_le_thu}%`}</td>
          </tr>
        ))}
    </>
  );
}
