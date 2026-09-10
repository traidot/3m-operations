import mysql from "mysql2/promise";

/**
 * Kết nối chỉ đọc tới một hệ thống nguồn.
 *
 * Ba lớp chặn, không dựa vào tự giác:
 *  1. Phiên đặt transaction_read_only — server từ chối mọi lệnh ghi
 *  2. multipleStatements tắt — không nối thêm câu lệnh sau dấu chấm phẩy
 *  3. Hàm query chỉ nhận câu bắt đầu bằng select hoặc show
 *
 * Vẫn nên dùng tài khoản chỉ đọc ở phía database. Ba lớp trên là phòng thân,
 * không thay được phân quyền.
 */

const CHO_PHEP = /^\s*(select|show|describe|desc)\s/i;

export type ReadOnlyDb = {
  rows: <T>(sql: string, params?: unknown[]) => Promise<T[]>;
  close: () => Promise<void>;
};

export async function connectReadOnly(url: string): Promise<ReadOnlyDb> {
  const conn = await mysql.createConnection({
    uri: url,
    multipleStatements: false,
    connectTimeout: 15_000,
    dateStrings: true,
  });

  await conn.query("set session transaction_read_only = on");

  return {
    async rows<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      if (!CHO_PHEP.test(sql)) {
        throw new Error(`Chỉ cho phép câu đọc, đã chặn: ${sql.slice(0, 60)}`);
      }
      const [result] = await conn.query(sql, params);
      return result as T[];
    },
    close: () => conn.end(),
  };
}
