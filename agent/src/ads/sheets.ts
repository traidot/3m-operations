import { createSign } from "node:crypto";

/**
 * Đọc Google Sheets bằng tài khoản dịch vụ. Không dùng thư viện googleapis —
 * chỉ cần ký một JWT rồi gọi REST, vài chục dòng và không thêm phụ thuộc.
 *
 * Cần đặt:
 *   GOOGLE_SA_EMAIL       email của tài khoản dịch vụ
 *   GOOGLE_SA_PRIVATE_KEY khoá riêng, xuống dòng viết là \n
 *
 * Và phải chia sẻ cả hai sheet cho email đó với quyền xem.
 */

const SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

const b64url = (s: string | Buffer) =>
  Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

let cached: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const email = process.env.GOOGLE_SA_EMAIL;
  const rawKey = process.env.GOOGLE_SA_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new Error(
      "Thiếu GOOGLE_SA_EMAIL hoặc GOOGLE_SA_PRIVATE_KEY. Xem hướng dẫn ở README.",
    );
  }
  const key = rawKey.replace(/\\n/g, "\n");

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({ iss: email, scope: SCOPE, aud: TOKEN_URL, exp: now + 3600, iat: now }),
  );
  const signature = b64url(createSign("RSA-SHA256").update(`${header}.${claim}`).sign(key));

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claim}.${signature}`,
    }),
  });

  if (!res.ok) {
    throw new Error(`Không lấy được token Google (${res.status}): ${await res.text()}`);
  }

  const body = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return cached.token;
}

async function api<T>(path: string): Promise<T> {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${path}`, {
    headers: { authorization: `Bearer ${await accessToken()}` },
  });
  if (!res.ok) {
    throw new Error(`Google Sheets trả lỗi ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

/** Tên các tab. Hai file đặt tên khác nhau nên phải đọc chứ đừng đoán. */
export async function listTabs(spreadsheetId: string): Promise<string[]> {
  const data = await api<{ sheets: { properties: { title: string } }[] }>(
    `${spreadsheetId}?fields=sheets.properties.title`,
  );
  return data.sheets.map((s) => s.properties.title);
}

/** Lưới ô của một tab. Ô trống ở cuối hàng bị Google cắt, parser tự xử. */
export async function readTab(spreadsheetId: string, tab: string): Promise<string[][]> {
  const range = encodeURIComponent(`'${tab.replace(/'/g, "''")}'`);
  const data = await api<{ values?: string[][] }>(
    `${spreadsheetId}/values/${range}?valueRenderOption=FORMATTED_VALUE`,
  );
  return data.values ?? [];
}

/**
 * Đoán năm cho một tab báo cáo tháng. Tên tab chỉ có số tháng, không có năm.
 * Quy ước: tháng nào đã qua hoặc đang chạy thì là năm nay, tháng còn ở phía
 * trước thì là năm ngoái. Đọc báo cáo tháng 12 vào tháng 1 vẫn ra đúng.
 */
export function guessYear(month: number, today = new Date()): number {
  const y = today.getFullYear();
  return month > today.getMonth() + 1 ? y - 1 : y;
}

/** Lấy số tháng từ tên tab. Trả null nếu tab không phải báo cáo tháng. */
export function monthFromTab(tab: string): number | null {
  const m = tab.toLowerCase().match(/th[aá]ng\s*(\d{1,2})/);
  if (!m) return null;
  const month = Number(m[1]);
  return month >= 1 && month <= 12 ? month : null;
}
