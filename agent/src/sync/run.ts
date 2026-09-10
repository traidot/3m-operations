import { pool, q, withLock } from "../db.js";
import { connectReadOnly } from "./mysql.js";
import { QUERIES } from "./fixed-wifi.js";

/**
 * Kéo dữ liệu từ hệ thống wifi cố định về kho số liệu.
 * Chỉ đọc bên nguồn, ghi đè theo (source, source_id) nên chạy lại tuỳ ý.
 *
 * Cần SRC_FIXED_URL, ví dụ:
 *   mysql://monitor_ro:...@117.4.242.105:33308/wifi-api
 */

const SOURCE = "FIXED";

const INSERTS: Record<keyof typeof QUERIES, { table: string; cols: string[] }> = {
  subscription: {
    table: "subscription_snapshot",
    cols: ["source_id", "source_customer_id", "service_type", "plan_name", "status",
           "monthly_price", "monthly_cost", "activated_on", "terminated_on", "anchor_day",
           "fee_start_on", "fee_end_on",
           "device_ref", "sim_ref", "created_at_src", "updated_at_src", "created_by_src"],
  },
  fee_period: {
    table: "fee_period_snapshot",
    cols: ["source_id", "subscription_source_id", "period", "amount", "is_free",
           "status", "paid_at", "channel", "created_at_src", "created_by_src"],
  },
  install_order: {
    table: "install_order_snapshot",
    cols: ["source_id", "source_customer_id", "address", "status", "signed_on",
           "scheduled_at", "completed_on", "technician_ref",
           "created_at_src", "updated_at_src", "created_by_src"],
  },
  payment: {
    table: "payment_snapshot",
    cols: ["source_id", "subscription_source_id", "amount", "channel", "reference",
           "paid_at", "created_at_src", "created_by_src"],
  },
  device: {
    table: "device_snapshot",
    cols: ["source_id", "imei", "model", "status", "subscription_source_id",
           "location", "updated_at_src"],
  },
  staff: {
    table: "staff_snapshot",
    cols: ["source_id", "display_name", "role", "status", "team_ref"],
  },
};

async function syncEntity(
  src: Awaited<ReturnType<typeof connectReadOnly>>,
  entity: keyof typeof QUERIES,
  triggeredBy: string,
): Promise<number> {
  const [run] = await q<{ id: string }>(
    "insert into sync_run (source, table_name, triggered_by) values ($1, $2, $3) returning id",
    [SOURCE, entity, triggeredBy],
  );

  try {
    const rows = await src.rows<Record<string, unknown>>(QUERIES[entity]);
    const { table, cols } = INSERTS[entity];

    const updates = cols
      .filter((c) => c !== "source_id")
      .map((c) => `${c} = excluded.${c}`)
      .join(", ");

    // Ghi theo lô. Mỗi dòng một câu lệnh thì 6.603 hợp đồng là 6.603 lượt đi về,
    // đủ lâu để người bấm nút tưởng hỏng.
    const LO = 500;
    for (let i = 0; i < rows.length; i += LO) {
      const lo = rows.slice(i, i + LO);
      const params: unknown[] = [SOURCE];
      const tuples = lo.map((row) => {
        const cho = cols.map((c) => {
          params.push(row[c] ?? null);
          return `$${params.length}`;
        });
        return `($1, ${cho.join(", ")}, now())`;
      });

      await q(
        `insert into ${table} (source, ${cols.join(", ")}, synced_at)
         values ${tuples.join(", ")}
         on conflict (source, source_id) do update set ${updates}, synced_at = now()`,
        params,
      );
    }

    await q(
      "update sync_run set finished_at = now(), status = 'OK', rows_read = $2, rows_written = $2 where id = $1",
      [run!.id, rows.length],
    );
    return rows.length;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await q(
      "update sync_run set finished_at = now(), status = 'FAILED', error = $2 where id = $1",
      [run!.id, msg],
    );
    throw err;
  }
}

async function main() {
  const url = process.env.SRC_FIXED_URL;
  if (!url) throw new Error("Thiếu SRC_FIXED_URL — xem .env.example");

  const triggeredBy = process.argv.includes("--manual") ? "manual" : "schedule";

  // Khoá dùng chung với bản tin, nên bấm nút lúc job đêm đang chạy sẽ bị từ
  // chối chứ không chạy song song.
  const ok = await withLock(async () => {
    const src = await connectReadOnly(url);
    try {
      // Nhân sự trước để báo cáo có tên, rồi hợp đồng, rồi thứ trỏ về hợp đồng.
      for (const entity of ["staff", "subscription", "fee_period", "install_order", "payment", "device"] as const) {
        const n = await syncEntity(src, entity, triggeredBy);
        console.log(`${entity}: ${n} dòng`);
      }
    } finally {
      await src.close();
    }
    return true;
  });

  if (ok === null) {
    console.error("Một lượt đồng bộ khác đang chạy. Thử lại sau.");
    process.exit(2);
  }

  const [cover] = await q<Record<string, string>>("select * from v_fixed_billing_coverage");
  console.log(
    `\nHợp đồng đang chạy: ${cover!.hop_dong_dang_chay}, ` +
      `tính được cước: ${cover!.tinh_duoc} (${cover!.ty_le_tinh_duoc}%). ` +
      `Thiếu giá: ${cover!.thieu_gia_cuoc}, thiếu ngày bắt đầu: ${cover!.thieu_ngay_bat_dau}.`,
  );
}

main()
  .catch((err) => {
    console.error("Lỗi:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => pool.end());
