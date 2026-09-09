import pg from "pg";

const url = process.env.WAREHOUSE_URL;
if (!url) throw new Error("Thiếu WAREHOUSE_URL — xem .env.example");

// Next.js hot reload tạo module mới mỗi lần sửa file, giữ pool trên globalThis
// để không mở thêm kết nối mỗi lần.
const globalForPg = globalThis as unknown as { pgPool?: pg.Pool };

export const pool =
  globalForPg.pgPool ?? new pg.Pool({ connectionString: url, max: 5 });

if (process.env.NODE_ENV !== "production") globalForPg.pgPool = pool;

export async function query<T extends pg.QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await pool.query<T>(sql, params);
  return res.rows;
}
