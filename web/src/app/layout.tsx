import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Giám sát 3M",
  description: "Bản tin vận hành, duyệt trùng khách, máy cho mượn",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <div className="wrap">
          <nav>
            <a href="/">Bản tin</a>
            <a href="/duyet-trung">Duyệt trùng khách</a>
            <a href="/may-muon">Máy cho mượn</a>
          </nav>
          {children}
        </div>
      </body>
    </html>
  );
}
