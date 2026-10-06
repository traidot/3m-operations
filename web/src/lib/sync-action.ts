"use server";

import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { revalidatePath } from "next/cache";
import { NGUON_DONG_BO } from "./nhan";

const run = promisify(execFile);

/**
 * Chạy lượt đồng bộ một nguồn. Gọi thẳng script bên `agent` để chỉ có một chỗ
 * giữ logic đồng bộ — web không tự viết lại.
 *
 * Nạp .env.local ở gốc kho giống hệt lúc chạy bằng tay: web có .env.local
 * riêng nhưng chỉ chứa những gì web cần, không giữ chuỗi kết nối hệ nguồn.
 * Thiếu bước này thì nút bấm chỉ đồng bộ được nguồn nào tình cờ có mặt trong
 * môi trường của web — đúng là lỗi đã xảy ra với nguồn telecom.
 *
 * Script tự giữ khoá trong Postgres nên bấm nút lúc job đêm đang chạy sẽ bị
 * từ chối chứ không chạy song song. Mã thoát 2 nghĩa là đang bận.
 */
export async function runSync(nguon: string): Promise<{ ok: boolean; message: string }> {
  // Tham số đến từ trình duyệt nên phải soi lại, đừng tin nhãn nút.
  if (!Object.hasOwn(NGUON_DONG_BO, nguon)) {
    return { ok: false, message: `Không có nguồn nào tên ${nguon}` };
  }
  const agentDir = path.resolve(process.cwd(), "..", "agent");

  try {
    const { stdout } = await run(
      "npx",
      [
        "tsx",
        "--env-file-if-exists=../.env.local",
        "--env-file-if-exists=.env",
        "src/sync/run.ts",
        "--manual",
        `--nguon=${nguon}`,
      ],
      {
        cwd: agentDir,
        // Mỗi nguồn mất khoảng hai phút, để rộng tay cho lúc nguồn chậm.
        timeout: 600_000,
        maxBuffer: 4 * 1024 * 1024,
        env: process.env,
      },
    );
    for (const p of ["/dong-bo", "/cuoc", "/hop-dong", "/thang", "/lap-dat", "/cam-tay",
                     "/tra-cuu/cam-tay", "/cam-tay/coc", "/"]) {
      revalidatePath(p);
    }
    return { ok: true, message: stdout.trim() };
  } catch (err) {
    const e = err as { code?: number; stderr?: string; message?: string };
    if (e.code === 2) {
      return { ok: false, message: "Một lượt đồng bộ khác đang chạy. Thử lại sau." };
    }
    return { ok: false, message: (e.stderr || e.message || "Không rõ lỗi").trim() };
  }
}
