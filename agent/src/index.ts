import { pool, q, withLock } from "./db.js";
import { collect } from "./collect.js";
import { collectWeekly, renderWeekly } from "./weekly.js";
import { judge } from "./judge.js";
import { render } from "./render.js";

const args = process.argv.slice(2);
const manual = args.includes("--manual");
const skipJudge = args.includes("--numbers-only");
const weekly = args.includes("--weekly");
const week = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));

async function runDaily() {
  const today = new Date().toISOString().slice(0, 10);

  // Thứ tự quan trọng: chụp số trước, sinh phán quyết sau, rồi mới đọc ra.
  // Ngược lại thì bản tin luôn thiếu một ngày.
  await q("select snapshot_daily($1::date)", [today]);
  const rules = await q<{ rule_key: string; so_phat_hien: number; so_da_dong: number }>(
    "select * from run_rules($1::date)",
    [today],
  );

  const digest = await collect(today);
  if (skipJudge) return { text: JSON.stringify(digest, null, 2), rules };

  return { text: render(digest, await judge(digest)), rules };
}

async function runWeekly() {
  const digest = await collectWeekly(week);
  if (skipJudge) return { text: JSON.stringify(digest, null, 2), rules: [] };

  return { text: renderWeekly(digest, await judge(digest, "hang_tuan")), rules: [] };
}

async function main() {
  const result = await withLock(weekly ? runWeekly : runDaily);

  if (result === null) {
    console.error("Một lượt chạy khác đang giữ khoá. Thử lại sau.");
    process.exit(2);
  }

  console.log(result.text);

  const nhan = `${weekly ? "tuần" : "ngày"} · ${manual ? "chạy tay" : "theo lịch"}`;
  const chiTiet = result.rules
    .map((r) => `${r.rule_key}: ${r.so_phat_hien} phát hiện, ${r.so_da_dong} đã đóng`)
    .join(" | ");
  console.error(`\n[${nhan}] ${chiTiet}`);
}

main()
  .catch((err) => {
    console.error("Lỗi:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => pool.end());
