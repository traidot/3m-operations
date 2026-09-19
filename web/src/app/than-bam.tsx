"use client";

import { useRouter } from "next/navigation";

/**
 * Thân bảng bấm được, dùng cho bảng dài.
 *
 * `Dong` bọc từng dòng nên mỗi dòng là một client component; bảng 3.048 dòng
 * thì RSC payload phải gói lại từng ấy lần và trang phình lên 6,7 MB, mất gần
 * tám giây. Ở đây chỉ một thẻ bọc bắt click cho cả bảng, còn các `<tr>` là
 * HTML thuần do server dựng — cùng thao tác, nhẹ hơn nhiều lần.
 *
 * Dòng nào bấm được thì đặt `data-href`; dòng không có thuộc tính đó thì bỏ qua.
 */
export function ThanBam({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <tbody
      onClick={(e) => {
        if (!(e.target instanceof Element)) return;
        // Bấm đúng link thì để link tự đi, và đang bôi đen chữ thì đừng nhảy trang.
        if (e.target.closest("a")) return;
        if (window.getSelection()?.toString()) return;
        const dong = e.target.closest("tr[data-href]");
        const href = dong?.getAttribute("data-href");
        if (href) router.push(href, { scroll: false });
      }}
    >
      {children}
    </tbody>
  );
}
