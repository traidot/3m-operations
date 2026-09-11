import { readFileSync } from "node:fs";
import pg from "pg";
import type { ReadOnlyDb } from "./mysql.js";

/**
 * Kết nối chỉ đọc tới một hệ thống nguồn PostgreSQL.
 *
 * Cùng ba lớp chặn như bản MySQL:
 *  1. Phiên đặt default_transaction_read_only — server từ chối mọi lệnh ghi
 *  2. Một câu một lệnh, tham số truyền rời nên không nối chuỗi
 *  3. Hàm rows chỉ nhận câu bắt đầu bằng select, show, hoặc with … select
 *
 * Vẫn nên dùng tài khoản chỉ đọc phía database. Ba lớp trên là phòng thân.
 */

const CHO_PHEP = /^\s*(select|show|with)\s/i;

export async function connectReadOnlyPg(url: string): Promise<ReadOnlyDb> {
  // sslmode trong chuỗi kết nối sẽ đè mất tuỳ chọn ssl bên dưới, nên bỏ nó ra.
  const u = new URL(url);
  u.searchParams.delete("sslmode");

  const client = new pg.Client({
    connectionString: u.toString(),
    // Vẫn mã hoá đường truyền, nhưng không kiểm chứng chỉ: RDS ký bằng CA của
    // Amazon, không có sẵn trong kho gốc của Node. Muốn kiểm thì đặt
    // SRC_TELECOM_CA trỏ tới file PEM của Amazon.
    ssl: process.env.SRC_TELECOM_CA
      ? { ca: readFileSync(process.env.SRC_TELECOM_CA, "utf8") }
      : { rejectUnauthorized: false },
    connectionTimeoutMillis: 15_000,
  });
  await client.connect();
  await client.query("set default_transaction_read_only = on");

  return {
    async rows<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      if (!CHO_PHEP.test(sql)) {
        throw new Error(`Chỉ cho phép câu đọc, đã chặn: ${sql.slice(0, 60)}`);
      }
      const res = await client.query(sql, params as never[]);
      return res.rows as T[];
    },
    close: () => client.end(),
  };
}
