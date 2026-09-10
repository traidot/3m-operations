import { readFileSync } from "node:fs";
import { pool, q } from "../db.js";
import { parseAdsTab } from "./parse.js";

/**
 * Nhập một tab báo cáo quảng cáo đã xuất ra CSV.
 *
 *   npm run ads -- --owner dinh_viet --year 2026 --tab "Tháng 1" duong-dan.csv
 *
 * Hai sheet đang là file riêng tư nên chưa đọc tự động được. Muốn tự động thì
 * cần tài khoản dịch vụ của Google Sheets API — lúc đó chỉ phải thay chỗ đọc
 * file này, phần bóc tách giữ nguyên.
 */
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const owner = arg("owner");
  const year = Number(arg("year"));
  const tab = arg("tab") ?? "khong-ro";
  const file = process.argv[process.argv.length - 1];

  if (!owner || !Number.isInteger(year) || !file || file.startsWith("--")) {
    console.error(
      'Dùng: npm run ads -- --owner <ten> --year <nam> --tab "<ten tab>" <duong-dan.csv>',
    );
    process.exit(1);
  }

  const [run] = await q<{ id: string }>(
    "insert into ads_import_run (sheet_owner, tab_name) values ($1, $2) returning id",
    [owner, tab],
  );

  try {
    const rows = parseAdsTab(readFileSync(file, "utf8"), year);

    if (rows.length === 0) {
      throw new Error(
        "Không tìm thấy hàng tiêu đề có cột ngày. Kiểm tra lại tab đã xuất đúng chưa.",
      );
    }

    for (const r of rows) {
      await q(
        `insert into ads_daily (sheet_owner, metric_date, product,
                                spend, reach, clicks, messages, orders, imported_at)
         values ($1, $2::date, $3, $4, $5, $6, $7, $8, now())
         on conflict (sheet_owner, metric_date, product) do update set
           spend = excluded.spend, reach = excluded.reach, clicks = excluded.clicks,
           messages = excluded.messages, orders = excluded.orders,
           imported_at = now()`,
        [owner, r.metric_date, r.product, r.spend, r.reach, r.clicks, r.messages, r.orders],
      );
    }

    await q("update ads_import_run set status = 'OK', rows_written = $2 where id = $1", [
      run!.id,
      rows.length,
    ]);

    const ngay = [...new Set(rows.map((r) => r.metric_date))];
    console.log(
      `Đã nhập ${rows.length} dòng, ${ngay.length} ngày (${ngay[0]} đến ${ngay[ngay.length - 1]}).`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await q("update ads_import_run set status = 'FAILED', error = $2 where id = $1", [
      run!.id,
      msg,
    ]);
    throw err;
  }
}

main()
  .catch((err) => {
    console.error("Lỗi:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => pool.end());
