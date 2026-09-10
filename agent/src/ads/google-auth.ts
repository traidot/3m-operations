import { createServer } from "node:http";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { SCOPE, TOKEN_ENDPOINT } from "./sheets.js";

/**
 * Lấy refresh token một lần cho tài khoản Google của chính anh.
 *
 *   npm run google:auth
 *
 * Cần GOOGLE_CLIENT_ID và GOOGLE_CLIENT_SECRET của một OAuth client loại
 * Desktop app. Loại đó tự cho phép mọi cổng localhost nên không phải khai
 * redirect URI ở Console. Google đã bỏ luồng dán mã bằng tay từ 2022 nên
 * script mở một cổng tạm trên máy để nhận mã trả về.
 *
 * Script ghi thẳng refresh token vào .env.local ở thư mục gốc, không in ra
 * màn hình — token không lọt vào log hay lịch sử terminal.
 */

const PORT = 8757;
const REDIRECT = `http://localhost:${PORT}`;

async function main() {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) {
    console.error(
      "Thiếu GOOGLE_CLIENT_ID hoặc GOOGLE_CLIENT_SECRET.\n" +
        "Tạo ở Google Cloud Console: APIs & Services > Credentials >\n" +
        "Create credentials > OAuth client ID > Application type: Desktop app.\n" +
        "Loại này không có ô redirect URI để điền, cứ tạo rồi lấy id và secret.",
    );
    process.exit(1);
  }

  const state = randomBytes(16).toString("hex");
  const authUrl =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: id,
      redirect_uri: REDIRECT,
      response_type: "code",
      scope: SCOPE,
      access_type: "offline",
      prompt: "consent", // bắt Google trả refresh token, kể cả lần cấp quyền thứ hai
      state,
    });

  console.log("Mở đường dẫn này trong trình duyệt rồi đăng nhập:\n");
  console.log(authUrl);
  console.log("\nĐang chờ Google trả mã về...");

  const code = await waitForCode(state);

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: id,
      client_secret: secret,
      redirect_uri: REDIRECT,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    throw new Error(`Đổi mã lấy token thất bại (${res.status}): ${await res.text()}`);
  }

  const json = (await res.json()) as { refresh_token?: string };
  if (!json.refresh_token) {
    throw new Error(
      "Google không trả refresh token. Vào https://myaccount.google.com/permissions\n" +
        "gỡ quyền của ứng dụng này rồi chạy lại.",
    );
  }

  const file = path.resolve(process.cwd(), "..", ".env.local");
  ghiEnv(file, "GOOGLE_REFRESH_TOKEN", json.refresh_token);
  console.log(`\nĐã ghi GOOGLE_REFRESH_TOKEN vào ${file}. Giờ chạy được npm run ads:sync.`);
}

/** Thay giá trị nếu khoá đã có, thêm dòng mới nếu chưa. */
function ghiEnv(file: string, key: string, value: string) {
  if (!existsSync(file)) {
    appendFileSync(file, `${key}=${value}\n`, "utf8");
    return;
  }
  const cu = readFileSync(file, "utf8");
  const dong = new RegExp(`^${key}=.*$`, "m");
  const moi = dong.test(cu)
    ? cu.replace(dong, `${key}=${value}`)
    : `${cu.replace(/\n*$/, "\n")}${key}=${value}\n`;
  writeFileSync(file, moi, "utf8");
}

function waitForCode(expectedState: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", REDIRECT);
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      const done = (message: string) => {
        res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
        res.end(message);
        server.close();
      };

      if (error) {
        done("Đã huỷ. Quay lại terminal.");
        reject(new Error(`Google trả lỗi: ${error}`));
      } else if (state !== expectedState) {
        done("State không khớp. Quay lại terminal.");
        reject(new Error("State không khớp — có thể là yêu cầu giả mạo."));
      } else if (code) {
        done("Xong. Quay lại terminal để lấy refresh token.");
        resolve(code);
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    server.listen(PORT);
    server.on("error", reject);
    setTimeout(() => {
      server.close();
      reject(new Error("Hết 5 phút chờ."));
    }, 300_000).unref();
  });
}

main().catch((err) => {
  console.error("Lỗi:", err instanceof Error ? err.message : err);
  process.exit(1);
});
