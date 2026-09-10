"use server";

import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { revalidatePath } from "next/cache";

const run = promisify(execFile);

/**
 * Chạy lượt đồng bộ. Gọi thẳng script bên `agent` để chỉ có một chỗ giữ
 * logic đồng bộ — web không tự viết lại.
 *
 * Script tự giữ khoá trong Postgres nên bấm nút lúc job đêm đang chạy sẽ bị
 * từ chối chứ không chạy song song. Mã thoát 2 nghĩa là đang bận.
 */
export async function runSync(): Promise<{ ok: boolean; message: string }> {
  const agentDir = path.resolve(process.cwd(), "..", "agent");

  try {
    const { stdout } = await run("npx", ["tsx", "src/sync/run.ts", "--manual"], {
      cwd: agentDir,
      timeout: 180_000,
      env: process.env,
    });
    revalidatePath("/dong-bo");
    revalidatePath("/cuoc");
    revalidatePath("/");
    return { ok: true, message: stdout.trim() };
  } catch (err) {
    const e = err as { code?: number; stderr?: string; message?: string };
    if (e.code === 2) {
      return { ok: false, message: "Một lượt đồng bộ khác đang chạy. Thử lại sau." };
    }
    return { ok: false, message: (e.stderr || e.message || "Không rõ lỗi").trim() };
  }
}
