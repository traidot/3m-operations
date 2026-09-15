import { query } from "@/lib/db";
import { SyncButton } from "./sync-button";

export const dynamic = "force-dynamic";

type Run = {
  source: string;
  table_name: string;
  started_at: Date;
  finished_at: Date | null;
  rows_written: number | null;
  status: string;
  error: string | null;
  triggered_by: string;
};

export default async function Page() {
  const runs = await query<Run>(
    `select source, table_name, started_at, finished_at, rows_written,
            status, error, triggered_by
       from sync_run order by started_at desc limit 40`,
  );

  const moiNhat = runs.find((r) => r.status === "OK")?.finished_at ?? null;

  return (
    <main>
      <h1>Đồng bộ</h1>
      <p className="muted">
        Kéo dữ liệu từ hệ thống nguồn về kho số liệu, mỗi nguồn một nút. Chỉ đọc — không ghi gì ngược
        lại hệ thống nguồn. Hai nguồn dùng chung một khoá nên không chạy song song được: bấm nút
        này lúc nút kia đang chạy sẽ bị từ chối.
      </p>
      <p className="muted">
        {moiNhat
          ? `Lượt gần nhất thành công: ${moiNhat.toLocaleString("vi-VN")}`
          : "Chưa có lượt nào thành công."}
      </p>

      <SyncButton />

      <h2>Lịch sử</h2>
      <div className="scroller">
        <table>
          <thead>
            <tr>
              <th>Bắt đầu</th>
              <th>Nguồn</th>
              <th>Bảng</th>
              <th className="num">Dòng</th>
              <th>Kết quả</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r, i) => (
              <tr key={`${r.started_at.toISOString()}-${i}`}>
                <td className="mono">{r.started_at.toLocaleString("vi-VN")}</td>
                <td className="mono muted">{r.source}</td>
                <td className="mono">{r.table_name}</td>
                <td className="num mono">{r.rows_written ?? "—"}</td>
                <td className={r.status === "OK" ? "mono muted" : "mono bad"}>
                  {r.status}
                  {r.triggered_by === "manual" && <span className="muted"> · bấm tay</span>}
                  {r.error && <div className="muted">{r.error}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
