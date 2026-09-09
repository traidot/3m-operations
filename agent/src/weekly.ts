import { q } from "./db.js";
import type { Judgement } from "./judge.js";

export type WeeklyMetric = {
  metric_key: string;
  dimension: string | null;
  tuan_nay: string | null;
  tuan_truoc: string | null;
  tb_4_tuan: string | null;
};

export type WeeklyDigest = {
  ngay: string;
  metrics: WeeklyMetric[];
};

/** p_week là thứ hai đầu tuần cần báo cáo. Mặc định là tuần vừa kết thúc. */
export async function collectWeekly(week?: string): Promise<WeeklyDigest> {
  const [row] = await q<{ tuan: string }>(
    "select coalesce($1::date, (date_trunc('week', current_date) - interval '7 days')::date)::text as tuan",
    [week ?? null],
  );
  const tuan = row!.tuan;

  const metrics = await q<WeeklyMetric>(
    `select metric_key, dimension,
            tuan_nay::text, tuan_truoc::text, tb_4_tuan::text
       from weekly_report($1::date)`,
    [tuan],
  );

  return { ngay: tuan, metrics };
}

const num = (v: string | null) =>
  v === null ? "—" : Number(v).toLocaleString("vi-VN");

export function renderWeekly(digest: WeeklyDigest, j: Judgement): string {
  const out: string[] = [];

  out.push(`BÁO CÁO TUẦN 3M — tuần bắt đầu ${digest.ngay}`);
  out.push("");
  out.push(
    "  " +
      "chỉ số".padEnd(34) +
      "tuần này".padStart(14) +
      "tuần trước".padStart(14) +
      "tb 4 tuần".padStart(14),
  );

  for (const m of digest.metrics) {
    const ten = m.dimension ? `${m.metric_key} · ${m.dimension}` : m.metric_key;
    out.push(
      "  " +
        ten.padEnd(34) +
        num(m.tuan_nay).padStart(14) +
        num(m.tuan_truoc).padStart(14) +
        num(m.tb_4_tuan).padStart(14),
    );
  }

  out.push("");
  out.push("─".repeat(76));
  out.push(j.mo_dau);
  out.push("");

  if (j.phan_quyet.length === 0) {
    out.push("Không có xu hướng nào đáng chú ý tuần này.");
    return out.join("\n");
  }

  for (const v of j.phan_quyet) {
    out.push(`[${v.severity}] ${v.title}`);
    out.push(`  ${v.evidence}`);
    if (v.so_sanh) out.push(`  ${v.so_sanh}`);
    if (v.action) out.push(`  → ${v.action}`);
    out.push("");
  }

  return out.join("\n");
}
