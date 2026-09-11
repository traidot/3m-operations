"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Vỏ ngăn kéo. Nội dung bên trong do server dựng, nhưng phần đóng mở phải
 * nằm ở client: lúc đóng cần chạy hết hiệu ứng trượt ra rồi mới đổi URL,
 * chứ đổi URL trước thì React gỡ luôn thẻ, không kịp thấy gì.
 */
const THOI_GIAN_DONG = 180;

export function NganKeo({
  dongLai,
  children,
}: {
  dongLai: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [dangDong, setDangDong] = useState(false);

  const dong = () => {
    if (dangDong) return;
    setDangDong(true);
    setTimeout(() => router.push(dongLai, { scroll: false }), THOI_GIAN_DONG);
  };

  useEffect(() => {
    const nghe = (e: KeyboardEvent) => {
      if (e.key === "Escape") dong();
    };
    window.addEventListener("keydown", nghe);
    return () => window.removeEventListener("keydown", nghe);
  });

  const lop = dangDong ? " dang-dong" : "";

  return (
    <>
      <div className={`man-che${lop}`} onClick={dong} aria-hidden />
      <aside className={`ngan-keo${lop}`} role="dialog" aria-label="Chi tiết hợp đồng">
        <button type="button" className="nut-dong" onClick={dong}>
          Đóng ✕
        </button>
        {children}
      </aside>
    </>
  );
}
