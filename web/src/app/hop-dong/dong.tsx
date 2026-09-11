"use client";

import { useRouter } from "next/navigation";

/**
 * Bấm chỗ nào trên dòng cũng mở ngăn kéo, trừ khi đang bôi đen chữ để copy
 * địa chỉ, hoặc bấm vào đúng cái link mã hợp đồng (link tự đi).
 */
export function Dong({
  href,
  dangMo,
  lop,
  children,
}: {
  href: string;
  dangMo: boolean;
  /** Lớp thêm, dùng cho dòng dịch vụ nằm dưới dòng khách. */
  lop?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <tr
      className={[lop, dangMo ? "dang-mo" : ""].filter(Boolean).join(" ") || undefined}
      onClick={(e) => {
        if (e.target instanceof Element && e.target.closest("a")) return;
        if (window.getSelection()?.toString()) return;
        router.push(href, { scroll: false });
      }}
    >
      {children}
    </tr>
  );
}
