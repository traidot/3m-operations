"use client";

import { useRouter } from "next/navigation";

/**
 * Bấm chỗ nào trên dòng cũng mở ngăn kéo, trừ khi đang bôi đen chữ để copy
 * địa chỉ, hoặc bấm vào đúng cái link mã hợp đồng (link tự đi).
 */
export function Dong({
  href,
  dangMo,
  children,
}: {
  href: string;
  dangMo: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <tr
      className={dangMo ? "dang-mo" : undefined}
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
