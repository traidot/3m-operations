import { pool, q, withLock } from "./db.js";
import { collect } from "./collect.js";
import { judge } from "./judge.js";
import { render } from "./render.js";

const manual = process.argv.includes("--manual");
const skipJudge = process.argv.includes("--numbers-only");

async function main() {
  const today = new Date().toISOString().slice(0, 10);

  const result = await withLock(async () => {
    // Thứ tự quan trọng: chụp số trước, sinh phán quyết sau, rồi mới đọc ra.
    // Ngược lại thì bản tin luôn thiếu một ngày.
    await q("select snapshot_daily($1::date)", [today]);
    const rules = await q<{ rule_key: string; so_phat_hien: number; so_da_dong: number }>(
      "select * from run_rules($1::date)",
      [today],
    );

    const digest = await collect(today);

    if (skipJudge) {
      return { text: JSON.stringify(digest, null, 2), rules };
    }

    const j = await judge(digest);
    return { text: render(digest, j), rules };
  });

  if (result === null) {
    console.error("Một lượt chạy khác đang giữ khoá. Thử lại sau.");
    process.exit(2);
  }

  console.log(result.text);
  console.error(
    `\n[${manual ? "chạy tay" : "theo lịch"}] ` +
      result.rules.map((r) => `${r.rule_key}: ${r.so_phat_hien} phát hiện, ${r.so_da_dong} đã đóng`).join(" | "),
  );
}

main()
  .catch((err) => {
    console.error("Lỗi:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => pool.end());
