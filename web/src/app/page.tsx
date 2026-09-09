import { setFindingStatus } from "@/lib/actions";
import { getFindings, getFreshness, type Finding } from "@/lib/queries";

export const dynamic = "force-dynamic";

const NHOM_LABEL: Record<Finding["nhom"], string> = {
  moi: "mới hôm nay",
  dang_ton: "đang tồn",
  nhac_lai_nhieu_lan: "nhắc lại nhiều lần",
};

export default async function Page() {
  const [findings, freshness] = await Promise.all([getFindings(), getFreshness()]);

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

      <p className="mono">{JSON.stringify(finding.evidence)}</p>

      {finding.action && <p>{finding.action}</p>}

      <p className="muted">
        {NHOM_LABEL[finding.nhom]} · tồn {finding.so_ngay_ton} ngày · đã nhắc{" "}
        {finding.times_reported} lần
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
