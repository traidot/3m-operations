"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type MucMenu = { ten: string; href: string };
export type NhomMenu = { nhom: string; muc: MucMenu[] };

/**
 * Mục đang mở phải nhìn ra được. Dùng usePathname nên nav phải chạy ở client,
 * còn nội dung trang vẫn do server dựng như cũ.
 *
 * Khớp theo tiền tố để trang con vẫn sáng mục cha, nhưng chỉ sáng MỘT mục —
 * mục khớp dài nhất. Không chốt điều đó thì /cam-tay/khach sáng cả "Tổng quan"
 * (/cam-tay) lẫn "Khách và dịch vụ".
 */
function khop(duongDan: string, href: string): boolean {
  if (href === "/") return duongDan === "/";
  return duongDan === href || duongDan.startsWith(`${href}/`);
}

export function Nav({ menu }: { menu: NhomMenu[] }) {
  const duongDan = usePathname();

  const moNhat = ["/", ...menu.flatMap((g) => g.muc.map((m) => m.href))]
    .filter((href) => khop(duongDan, href))
    .sort((a, b) => b.length - a.length)[0];

  const dangMo = (href: string) => href === moNhat;

  return (
    <nav>
      {menu.map((g) => (
        <div key={g.nhom} className="nav-nhom">
          <span className="nav-ten-nhom">{g.nhom}</span>
          <span className="nav-muc">
            {g.muc.map((m) => {
              const mo = dangMo(m.href);
              return (
                <Link
                  key={m.href}
                  href={m.href}
                  className={mo ? "dang-mo" : undefined}
                  aria-current={mo ? "page" : undefined}
                >
                  {m.ten}
                </Link>
              );
            })}
          </span>
        </div>
      ))}
      {/* Bản tin đứng riêng ở góc phải: nó là nơi quay về, không thuộc mảng nào. */}
      <Link
        className={`nav-chinh${dangMo("/") ? " dang-mo" : ""}`}
        href="/"
        aria-current={dangMo("/") ? "page" : undefined}
      >
        Bản tin
      </Link>
    </nav>
  );
}
