import type { Digest } from "./collect.js";
import type { Judgement } from "./judge.js";

/**
 * Bản tin có hai phần tách bạch:
 *  - phần số do SQL sinh, chạy hai lần trên cùng dữ liệu phải ra y hệt
 *  - phần nhận định do agent viết
 */

const num = (v: string | null) =>
  v === null ? "—" : Number(v).toLocaleString("vi-VN");

export function render(digest: Digest, j: Judgement): string {
  const out: string[] = [];

  out.push(`BẢN TIN 3M — ${digest.ngay}`);
  out.push("");

  out.push("Mốc dữ liệu");
  for (const f of digest.freshness) {
    const gio = f.gio_ke_tu_lan_cuoi;
    const cu = f.lan_dong_bo_cuoi === null || Number(gio) > Number(f.nguong_gio);
    out.push(
      `  ${cu ? "!" : " "} ${f.source}/${f.table_name}: ` +
        (f.lan_dong_bo_cuoi
          ? `${f.lan_dong_bo_cuoi.toISOString()} (${gio} giờ trước)`
          : "chưa từng đồng bộ được"),
    );
  }
  out.push("");

  out.push("Số liệu");
  for (const m of digest.metrics) {
    const ten = m.dimension ? `${m.metric_key} · ${m.dimension}` : m.metric_key;
    out.push(
      `  ${ten.padEnd(38)} ${num(m.hom_nay).padStart(14)}` +
        `   tuần trước ${num(m.tuan_truoc)}` +
        `   tb 4 tuần ${num(m.trung_binh_4_tuan)}`,
    );
  }
  out.push("");

  if (digest.ty_le_thu.length > 0) {
    out.push("Tỉ lệ thu theo tuần");
    for (const t of digest.ty_le_thu) {
      out.push(
        `  ${t.tuan}  phải thu ${num(t.phai_thu).padStart(14)}` +
          `  thực thu ${num(t.thuc_thu).padStart(14)}` +
          `  ${t.ty_le_thu ?? "—"}%`,
      );
    }
    out.push("");
  }

  out.push("─".repeat(60));
  out.push(j.mo_dau);
  out.push("");

  if (j.phan_quyet.length === 0) {
    out.push("Không có việc nào cần xử lý hôm nay.");
    return out.join("\n");
  }

  for (const v of j.phan_quyet) {
    out.push(`[${v.severity}] ${v.title}`);
    out.push(`  ${v.evidence}`);
    if (v.so_sanh) out.push(`  ${v.so_sanh}`);
    if (v.action) out.push(`  → ${v.action}`);
    if (v.metabase_url) out.push(`  ${v.metabase_url}`);
    out.push("");
  }

  return out.join("\n");
}
