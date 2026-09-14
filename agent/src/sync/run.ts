import { pool, q, withLock } from "../db.js";
import { connectReadOnly, type ReadOnlyDb } from "./mysql.js";
import { connectReadOnlyPg } from "./postgres.js";
import { QUERIES as FIXED_QUERIES } from "./fixed-wifi.js";
import { QUERIES as TELECOM_QUERIES } from "./telecom.js";

/**
 * Kéo dữ liệu từ hai hệ thống nguồn về kho số liệu.
 *
 *   FIXED    wifi cố định, MySQL — SRC_FIXED_URL
 *   TELECOM  wifi cầm tay, PostgreSQL — SRC_TELECOM_URL
 *
 * Chỉ đọc bên nguồn, ghi đè theo (source, source_id) nên chạy lại tuỳ ý.
 * Thiếu biến môi trường của nguồn nào thì bỏ qua nguồn đó, không coi là lỗi.
 */

type Bang = { table: string; cols: string[] };

type Nguon = {
  key: string;
  ten: string;
  bien: string;
  ket_noi: (url: string) => Promise<ReadOnlyDb>;
  queries: Record<string, string>;
  bang: Record<string, Bang>;
  thu_tu: string[];
};

const SUBSCRIPTION_COLS = [
  "source_id", "source_customer_id", "service_type", "plan_name", "status",
  "monthly_price", "monthly_cost", "activated_on", "terminated_on", "anchor_day",
  "fee_start_on", "fee_end_on",
  "order_ref", "device_ref", "sim_ref", "is_renewal", "cancel_timing", "cancel_reason",
  "is_difficult_debt",
  "created_at_src", "updated_at_src", "created_by_src",
];

const DEVICE_COLS = [
  "source_id", "imei", "model", "status", "subscription_source_id",
  "location", "updated_at_src",
];

const STAFF_COLS = ["source_id", "display_name", "role", "status", "team_ref"];

const NGUON: Nguon[] = [
  {
    key: "FIXED",
    ten: "wifi cố định",
    bien: "SRC_FIXED_URL",
    ket_noi: connectReadOnly,
    queries: FIXED_QUERIES,
    bang: {
      subscription: { table: "subscription_snapshot", cols: SUBSCRIPTION_COLS },
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
      device: { table: "device_snapshot", cols: DEVICE_COLS },
      deposit_allocation: {
        table: "deposit_allocation_snapshot",
        cols: ["source_id", "subscription_source_id", "contract_code", "amount",
               "allocations", "status", "channel", "collection_account", "paid_at",
               "approved_at", "note", "created_at_src", "created_by_src"],
      },
      staff: { table: "staff_snapshot", cols: STAFF_COLS },
    },
    // Nhân sự trước để báo cáo có tên, rồi hợp đồng, rồi thứ trỏ về hợp đồng.
    thu_tu: ["staff", "subscription", "fee_period", "install_order", "payment",
             "device", "deposit_allocation"],
  },
  {
    key: "TELECOM",
    ten: "wifi cầm tay",
    bien: "SRC_TELECOM_URL",
    ket_noi: connectReadOnlyPg,
    queries: TELECOM_QUERIES,
    bang: {
      // customer đi đường riêng qua link_customer, không có bảng đích ở đây.
      subscription: { table: "subscription_snapshot", cols: SUBSCRIPTION_COLS },
      invoice: {
        table: "invoice_snapshot",
        cols: ["source_id", "source_customer_id", "subscription_source_id", "number",
               "invoice_type", "order_id", "issued_on", "due_on", "period_start", "period_end",
               "total_amount", "paid_amount", "status", "created_at_src",
               "created_by_src"],
      },
      payment: {
        table: "payment_snapshot",
        cols: ["source_id", "source_customer_id", "subscription_source_id",
               "invoice_source_id", "amount", "channel", "reference", "paid_at",
               "created_at_src", "created_by_src"],
      },
      device: {
        table: "device_snapshot",
        cols: [...DEVICE_COLS, "deposit", "deposit_status", "rented_on", "returned_on"],
      },
      subscription_device: {
        table: "subscription_device_snapshot",
        cols: ["source_id", "subscription_source_id", "imei", "started_on", "ended_on",
               "created_at_src"],
      },
      fee_line: {
        table: "fee_line_snapshot",
        cols: ["source_id", "kind", "invoice_source_id", "subscription_source_id",
               "nam", "thang", "amount", "start_on", "end_on"],
      },
      staff: { table: "staff_snapshot", cols: STAFF_COLS },
    },
    thu_tu: ["staff", "customer", "subscription", "invoice", "payment", "device",
             "subscription_device", "fee_line"],
  },
];

const LO = 500;

/** Nối khách bên nguồn vào party, gộp trùng theo điện thoại và email. */
async function syncCustomer(src: ReadOnlyDb, nguon: Nguon): Promise<number> {
  const rows = await src.rows<Record<string, unknown>>(nguon.queries.customer!);

  for (let i = 0; i < rows.length; i += LO) {
    const lo = rows.slice(i, i + LO);
    const params: unknown[] = [nguon.key];
    const tuples = lo.map((r) => {
      const cho = ["source_customer_id", "name", "phone", "email", "id_document"].map((c) => {
        params.push(r[c] ?? null);
        return `$${params.length}`;
      });
      return `(${cho.join(", ")})`;
    });

    await q(
      `select link_customer($1::source_system, v.cid, v.ten, v.dt, v.mail, v.giay)
         from (values ${tuples.join(", ")}) as v(cid, ten, dt, mail, giay)`,
      params,
    );
  }

  // Mã khách, vai trò và nhóm là thuộc tính theo nguồn nên ghi vào party_source,
  // sau khi link_customer đã tạo xong dòng nối.
  const coThuocTinh = rows.some(
    (r) => r.customer_type ?? r.customer_group ?? r.customer_code,
  );
  if (coThuocTinh) {
    for (let i = 0; i < rows.length; i += LO) {
      const lo = rows.slice(i, i + LO);
      const params: unknown[] = [nguon.key];
      const tuples = lo.map((r) => {
        const cho = ["source_customer_id", "customer_type", "customer_group",
                     "customer_code"].map((c) => {
          params.push(r[c] ?? null);
          return `$${params.length}`;
        });
        return `(${cho.join(", ")})`;
      });
      await q(
        `update party_source ps
            set customer_type = v.loai, customer_group = v.nhom,
                customer_code = v.ma
           from (values ${tuples.join(", ")}) as v(cid, loai, nhom, ma)
          where ps.source = $1 and ps.source_customer_id = v.cid`,
        params,
      );
    }
  }

  return rows.length;
}

async function syncEntity(src: ReadOnlyDb, nguon: Nguon, entity: string): Promise<number> {
  const rows = await src.rows<Record<string, unknown>>(nguon.queries[entity]!);
  const { table, cols } = nguon.bang[entity]!;

  const updates = cols
    .filter((c) => c !== "source_id")
    .map((c) => `${c} = excluded.${c}`)
    .join(", ");

  // Ghi theo lô. Mỗi dòng một câu lệnh thì 6.603 hợp đồng là 6.603 lượt đi về,
  // đủ lâu để người bấm nút tưởng hỏng.
  for (let i = 0; i < rows.length; i += LO) {
    const lo = rows.slice(i, i + LO);
    const params: unknown[] = [nguon.key];
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

  // Bảng nào giữ mã khách bên nguồn thì nối luôn về party.
  if (cols.includes("source_customer_id")) {
    await q(
      `update ${table} t set party_id = ps.party_id
         from party_source ps
        where t.source = $1 and ps.source = $1
          and ps.source_customer_id = t.source_customer_id
          and ps.status <> 'REJECTED'
          and t.party_id is distinct from ps.party_id`,
      [nguon.key],
    );
  }

  return rows.length;
}

async function ghiNhat(nguon: Nguon, entity: string, triggeredBy: string,
                      chay: () => Promise<number>): Promise<number> {
  const [run] = await q<{ id: string }>(
    "insert into sync_run (source, table_name, triggered_by) values ($1, $2, $3) returning id",
    [nguon.key, entity, triggeredBy],
  );
  try {
    const n = await chay();
    await q(
      "update sync_run set finished_at = now(), status = 'OK', rows_read = $2, rows_written = $2 where id = $1",
      [run!.id, n],
    );
    return n;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await q(
      "update sync_run set finished_at = now(), status = 'FAILED', error = $2 where id = $1",
      [run!.id, msg],
    );
    throw err;
  }
}

async function syncNguon(nguon: Nguon, triggeredBy: string): Promise<void> {
  const url = process.env[nguon.bien];
  if (!url) {
    console.log(`${nguon.ten}: bỏ qua, chưa đặt ${nguon.bien}`);
    return;
  }

  console.log(`\n── ${nguon.ten} (${nguon.key})`);
  const src = await nguon.ket_noi(url);
  try {
    for (const entity of nguon.thu_tu) {
      const n = await ghiNhat(nguon, entity, triggeredBy, () =>
        entity === "customer" ? syncCustomer(src, nguon) : syncEntity(src, nguon, entity),
      );
      console.log(`${entity}: ${n} dòng`);
    }
  } finally {
    await src.close();
  }
}

async function main() {
  const triggeredBy = process.argv.includes("--manual") ? "manual" : "schedule";
  const chon = process.argv.find((a) => a.startsWith("--nguon="))?.split("=")[1];
  const danh_sach = chon ? NGUON.filter((n) => n.key === chon.toUpperCase()) : NGUON;

  if (danh_sach.length === 0) throw new Error(`Không có nguồn nào tên ${chon}`);
  if (!danh_sach.some((n) => process.env[n.bien])) {
    throw new Error(`Chưa đặt biến môi trường cho nguồn nào — xem .env.example`);
  }

  // Khoá dùng chung với bản tin, nên bấm nút lúc job đêm đang chạy sẽ bị từ
  // chối chứ không chạy song song.
  const ok = await withLock(async () => {
    for (const nguon of danh_sach) await syncNguon(nguon, triggeredBy);
    return true;
  });

  if (ok === null) {
    console.error("Một lượt đồng bộ khác đang chạy. Thử lại sau.");
    process.exit(2);
  }

  const [cover] = await q<Record<string, string>>("select * from v_fixed_billing_coverage");
  console.log(
    `\nWifi cố định — hợp đồng đang chạy: ${cover!.hop_dong_dang_chay}, ` +
      `tính được cước: ${cover!.tinh_duoc} (${cover!.ty_le_tinh_duoc}%).`,
  );
}

main()
  .catch((err) => {
    console.error("Lỗi:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => pool.end());
