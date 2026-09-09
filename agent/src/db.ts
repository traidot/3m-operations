import pg from "pg";

const url = process.env.WAREHOUSE_URL;
if (!url) throw new Error("Thiếu WAREHOUSE_URL — xem .env.example");

export const pool = new pg.Pool({ connectionString: url });

export async function q<T extends pg.QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await pool.query<T>(sql, params);
  return res.rows;
}

/**
 * Khoá chống chạy chồng. Chạy tay và chạy theo lịch dùng chung một khoá,
 * nên bấm chạy tay lúc job đêm đang chạy sẽ bị từ chối thay vì chạy song song.
 */
const LOCK_KEY = 3_000_001;

export async function withLock<T>(fn: () => Promise<T>): Promise<T | null> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ locked: boolean }>(
      "select pg_try_advisory_lock($1) as locked",
      [LOCK_KEY],
    );
    if (!rows[0]?.locked) return null;
    try {
      return await fn();
    } finally {
      await client.query("select pg_advisory_unlock($1)", [LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}
