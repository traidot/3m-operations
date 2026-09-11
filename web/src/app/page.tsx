import { setFindingStatus, unignoreFinding } from "@/lib/actions";
import { getFindings, getFreshness, getIgnored, type Finding } from "@/lib/queries";
import { Evidence } from "./evidence";

export const dynamic = "force-dynamic";

const NHOM_LABEL: Record<Finding["nhom"], string> = {
  moi: "mới hôm nay",
  dang_ton: "đang tồn",
  nhac_lai_nhieu_lan: "nhắc lại nhiều lần",
};

export default async function Page() {
  const [findings, freshness, ignored] = await Promise.all([
    getFindings(),
    getFreshness(),
    getIgnored(),
  ]);

  // Đồng bộ chết âm thầm thì trang vẫn hiện số, chỉ là số của hôm kia.
  const stale = freshness.filter(
    (f) => f.lan_dong_bo_cuoi === null || Number(f.gio_ke_tu_lan_cuoi) > Number(f.nguong_gio),
  );

  return (
    <main>
      <h1>Bản tin</h1>
      <p className="muted">
        {findings.length === 0
          ? "Không có việc nào cần xử lý."
          : `${findings.length} việc đang mở.`}
      </p>

      {stale.length > 0 && (
        <div className="stale">
          Dữ liệu chưa được đồng bộ: {stale.map((f) => `${f.source}/${f.table_name}`).join(", ")}.
          Mọi con số bên dưới đang là số cũ.
        </div>
      )}

      {findings.length === 0 ? (
        <p className="empty">Chưa có gì. Bản tin trống là kết quả tốt.</p>
      ) : (
        findings.map((f) => <FindingCard key={f.id} finding={f} />)
      )}

      {ignored.length > 0 && (
        <details>
          <summary>Đã bỏ qua vĩnh viễn ({ignored.length})</summary>
          <p className="muted">
            Những việc này không hiện lại dù vấn đề còn nguyên. Gỡ đánh dấu thì lượt
            chạy sau tự quyết có mở lại hay không.
          </p>
          {ignored.map((f) => (
            <div key={f.id} className="card info">
              <div className="card-head">
                <span className="card-title">{f.title}</span>
                <form action={unignoreFinding} className="inline">
                  <input type="hidden" name="id" value={f.id} />
                  <button type="submit">Gỡ bỏ qua</button>
                </form>
              </div>
              <p className="mono muted">{f.rule_key}</p>
            </div>
          ))}
        </details>
      )}

      <h2>Mốc đồng bộ</h2>
      <table>
        <thead>
          <tr>
            <th>Nguồn</th>
            <th>Bảng</th>
            <th>Lần cuối</th>
          </tr>
        </thead>
        <tbody>
          {freshness.map((f) => (
            <tr key={`${f.source}-${f.table_name}`}>
              <td className="mono">{f.source}</td>
              <td className="mono">{f.table_name}</td>
              <td>
                {f.lan_dong_bo_cuoi
                  ? `${f.gio_ke_tu_lan_cuoi} giờ trước`
                  : "chưa từng đồng bộ được"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  const level = finding.severity.toLowerCase();

  return (
    <article className={`card ${level}`}>
      <div className="card-head">
        <span className="card-title">{finding.title}</span>
        <span className={`tag ${level}`}>{finding.severity}</span>
      </div>

      <Evidence data={finding.evidence} />

      {finding.action && <p>{finding.action}</p>}

      <p className="muted">
        {NHOM_LABEL[finding.nhom]} · tồn {finding.so_ngay_ton} ngày · đã nhắc{" "}
        {finding.times_reported} lần
        {finding.reopened_count > 0 && (
          <> · đã đóng rồi tái diễn {finding.reopened_count} lần</>
        )}
        {finding.metabase_url && (
          <>
            {" · "}
            <a href={finding.metabase_url}>xem sâu</a>
          </>
        )}
      </p>

      <div className="actions">
        <StatusButton id={finding.id} status="ACKNOWLEDGED" label="Đã tiếp nhận" />
        <StatusButton id={finding.id} status="RESOLVED" label="Đã xử lý" primary />
        <StatusButton id={finding.id} status="IGNORED" label="Bỏ qua vĩnh viễn" />
      </div>
    </article>
  );
}

function StatusButton({
  id,
  status,
  label,
  primary,
}: {
  id: string;
  status: string;
  label: string;
  primary?: boolean;
}) {
  return (
    <form action={setFindingStatus} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" className={primary ? "primary" : undefined}>
        {label}
      </button>
    </form>
  );
}
