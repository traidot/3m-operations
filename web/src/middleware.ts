import { NextResponse, type NextRequest } from "next/server";

/**
 * Basic auth, một tài khoản dùng chung. Đủ để chặn người lạ mở trang trong
 * mạng nội bộ, KHÔNG đủ để đưa ra internet — không có phiên, không có ghi
 * nhật ký ai làm gì, không khoá sau nhiều lần sai.
 * Đưa ra ngoài thì phải thay bằng đăng nhập thật.
 */
export function middleware(req: NextRequest) {
  const user = process.env.MONITOR_USER;
  const pass = process.env.MONITOR_PASSWORD;

  if (!user || !pass) {
    return new NextResponse(
      "Chưa đặt MONITOR_USER và MONITOR_PASSWORD. Thêm hai biến này vào web/.env.local rồi khởi động lại dev server.",
      { status: 500 },
    );
  }

  const header = req.headers.get("authorization");
  const credentials = header?.startsWith("Basic ") ? decodeBasic(header.slice(6)) : null;

  if (credentials && safeEqual(credentials.user, user) && safeEqual(credentials.pass, pass)) {
    return NextResponse.next();
  }

  return new NextResponse("Sai tài khoản hoặc mật khẩu", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="3m", charset="UTF-8"' },
  });
}

/**
 * atob trả về chuỗi byte, không phải văn bản — mật khẩu có dấu tiếng Việt sẽ
 * bị hỏng nếu đọc thẳng. Và mật khẩu được phép chứa dấu hai chấm, nên chỉ
 * tách ở dấu đầu tiên.
 */
function decodeBasic(b64: string): { user: string; pass: string } | null {
  try {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    const sep = decoded.indexOf(":");
    if (sep < 0) return null;
    return { user: decoded.slice(0, sep), pass: decoded.slice(sep + 1) };
  } catch {
    // Header hỏng thì coi như chưa đăng nhập, đừng để lỗi 500 lộ ra ngoài.
    return null;
  }
}

/** So sánh không phụ thuộc độ dài khớp tới đâu, tránh dò mật khẩu qua thời gian đáp ứng. */
function safeEqual(a: string, b: string): boolean {
  const ba = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  let diff = ba.length ^ bb.length;
  for (let i = 0; i < Math.max(ba.length, bb.length); i++) {
    diff |= (ba[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
