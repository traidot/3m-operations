import { pool, q } from "../db.js";
import { parseAdsRows } from "./parse.js";
import { guessYear, listTabs, monthFromTab, nghi, readTab } from "./sheets.js";

/**
 * Kéo toàn bộ tab báo cáo tháng của cả hai sheet, mỗi ngày một lượt.
 * Ghi đè theo (người chạy, ngày, sản phẩm) nên chạy lại bao nhiêu lần cũng được.
 *
 * Cấu hình sheet trong ADS_SHEETS, dạng JSON:
 *   [{"owner":"dinh_viet","id":"1Nx5..."},{"owner":"viet_hoang","id":"1qo4..."}]
 */

type SheetConfig = { owner: string; id: string };

function config(): SheetConfig[] {
  const raw = process.env.ADS_SHEETS;
  if (!raw) throw new Error("Thiếu ADS_SHEETS — xem .env.example");

  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("ADS_SHEETS phải là một mảng JSON");

  return parsed.map((item, i) => {
    const s = item as Partial<SheetConfig>;
    if (!s.owner || !s.id) throw new Error(`ADS_SHEETS phần tử ${i} thiếu owner hoặc id`);
    return { owner: s.owner, id: s.id };
  });
}

async function syncTab(sheet: SheetConfig, tab: string): Promise<number> {
  const [run] = await q<{ id: string }>(
    "insert into ads_import_run (sheet_owner, tab_name) values ($1, $2) returning id",
    [sheet.owner, tab],
  );

  try {
    const rows = parseAdsRows(await readTab(sheet.id, tab), guessYear);

    for (const r of rows) {
      await q(
        `insert into ads_daily (sheet_owner, metric_date, product,
                                spend, reach, clicks, messages, orders, imported_at)
         values ($1, $2::date, $3, $4, $5, $6, $7, $8, now())
         on conflict (sheet_owner, metric_date, product) do update set
           spend = excluded.spend, reach = excluded.reach, clicks = excluded.clicks,
           messages = excluded.messages, orders = excluded.orders, imported_at = now()`,
        [sheet.owner, r.metric_date, r.product, r.spend, r.reach, r.clicks, r.messages, r.orders],
      );
    }

    await q("update ads_import_run set status = 'OK', rows_written = $2 where id = $1", [
      run!.id,
      rows.length,
    ]);
    return rows.length;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await q("update ads_import_run set status = 'FAILED', error = $2 where id = $1", [run!.id, msg]);
    throw err;
  }
}

async function main() {
  let tong = 0;
  let hong = 0;

  for (const sheet of config()) {
    const tabs = await listTabs(sheet.id);

    for (const tab of tabs) {
      // Chỉ tab tổng hợp. Tab riêng từng người gộp vào là đếm trùng.
      if (monthFromTab(tab) === null) continue;

      try {
        await nghi(600); // giữ dưới 60 lượt đọc mỗi phút
        const n = await syncTab(sheet, tab);
        tong += n;
        console.log(`${sheet.owner} · ${tab}: ${n} dòng`);
      } catch (err) {
        // Một tab hỏng không được làm chết cả lượt — các tab khác vẫn phải vào.
        hong++;
        console.error(`${sheet.owner} · ${tab}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  console.log(`\nTổng ${tong} dòng${hong > 0 ? `, ${hong} tab lỗi` : ""}.`);
  if (hong > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error("Lỗi:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => pool.end());
