import { createSign } from "node:crypto";

/**
 * Đọc Google Sheets. Không dùng thư viện googleapis — chỉ cần gọi REST.
 *
 * Hai cách xác thực, chọn cái nào có biến môi trường thì dùng cái đó:
 *
 * 1. Tài khoản người dùng (đơn giản hơn nếu sheet đã share cho anh):
 *      GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
 *    Lấy refresh token một lần bằng `npm run google:auth`.
 *    Lưu ý: quyền này đọc được mọi sheet tài khoản đó thấy, không riêng hai file.
 *
 * 2. Tài khoản dịch vụ (bền hơn, không gắn với ai):
 *      GOOGLE_SA_EMAIL, GOOGLE_SA_PRIVATE_KEY
 *    Phải nhờ chủ sheet chia sẻ cho email của tài khoản dịch vụ.
 */

export const SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
export const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

const b64url = (s: string | Buffer) =>
  Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

let cached: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const body = process.env.GOOGLE_REFRESH_TOKEN ? refreshTokenGrant() : jwtGrant();

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    throw new Error(`Không lấy được token Google (${res.status}): ${await res.text()}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cached.token;
}

/** Cách 1: tài khoản người dùng, đổi refresh token lấy access token. */
function refreshTokenGrant(): URLSearchParams {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  const refresh = process.env.GOOGLE_REFRESH_TOKEN;
  if (!id || !secret || !refresh) {
    throw new Error(
      "Có GOOGLE_REFRESH_TOKEN nhưng thiếu GOOGLE_CLIENT_ID hoặc GOOGLE_CLIENT_SECRET.",
    );
  }
  return new URLSearchParams({
    grant_type: "refresh_token",
    client_id: id,
    client_secret: secret,
    refresh_token: refresh,
  });
}

/** Cách 2: tài khoản dịch vụ, tự ký JWT rồi đổi lấy access token. */
function jwtGrant(): URLSearchParams {
  const email = process.env.GOOGLE_SA_EMAIL;
  const rawKey = process.env.GOOGLE_SA_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new Error(
      "Chưa cấu hình Google. Cần GOOGLE_REFRESH_TOKEN (tài khoản người dùng) " +
        "hoặc GOOGLE_SA_EMAIL và GOOGLE_SA_PRIVATE_KEY (tài khoản dịch vụ).",
    );
  }
  const key = rawKey.replace(/\\n/g, "\n");

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({ iss: email, scope: SCOPE, aud: TOKEN_URL, exp: now + 3600, iat: now }),
  );
  const signature = b64url(createSign("RSA-SHA256").update(`${header}.${claim}`).sign(key));

  return new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: `${header}.${claim}.${signature}`,
  });
}

async function api<T>(path: string, lanThu = 0): Promise<T> {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${path}`, {
    headers: { authorization: `Bearer ${await accessToken()}` },
  });

  // 429 là vượt hạn mức 60 lượt/phút, chờ rồi thử lại chứ đừng bỏ luôn tab đó.
  if (res.status === 429 && lanThu < 4) {
    await nghi(2000 * 2 ** lanThu);
    return api<T>(path, lanThu + 1);
  }

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

/**
 * Lấy số tháng từ tên tab tổng hợp. Trả null nếu không phải tab tổng hợp.
 *
 * Hai sheet có ba kiểu đặt tên cho tab tổng: "Báo cao tổng tháng 8",
 * "Báo cáo tổng tháng 9", "BC_Tổng Tháng 11". Điểm chung duy nhất là chữ
 * "tổng" đứng ngay trước "tháng" và số, rồi hết tên.
 *
 * Phải loại được tab riêng từng người ("BC_Tháng 9_Việt Hoàng"), tab theo tuần
 * ("Bc_Tuần_Tháng 8") và biến thể ("BC_Tháng 7 Quads") — gộp chúng vào là
 * đếm trùng với tab tổng.
 */
export function monthFromTab(tab: string): number | null {
  const chuan = tab
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  const m = chuan.match(/tong\s*thang\s*(\d{1,2})$/);
  if (!m) return null;
  const month = Number(m[1]);
  return month >= 1 && month <= 12 ? month : null;
}

/** Nghỉ giữa các lượt gọi. Google cho 60 lượt đọc mỗi phút cho mỗi tài khoản. */
export const nghi = (ms: number) => new Promise((r) => setTimeout(r, ms));
