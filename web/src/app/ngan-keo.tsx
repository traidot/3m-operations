"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Vỏ ngăn kéo. Nội dung bên trong do server dựng, nhưng phần đóng mở phải
 * nằm ở client: lúc đóng cần chạy hết hiệu ứng trượt ra rồi mới đổi URL,
 * chứ đổi URL trước thì React gỡ luôn thẻ, không kịp thấy gì.
 */
const THOI_GIAN_DONG = 180;

/**
 * Điều hướng không xong trong ngần này thì coi như hỏng và mở ngăn kéo trở lại.
 * Thà người dùng thấy nó bật lên rồi bấm đóng lần nữa, còn hơn kẹt ở trạng thái
 * vô hình mà URL vẫn giữ tham số — lúc đó bấm lại đúng dòng cũ là cùng một URL,
 * router không làm gì, và chỉ F5 mới thoát ra được.
 */
const HET_KIEN_NHAN = 4000;

export function NganKeo({
  dongLai,
  children,
}: {
  dongLai: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [dangDong, setDangDong] = useState(false);
  const hen = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dong = () => {
    if (dangDong) return;
    setDangDong(true);
    hen.current = setTimeout(() => router.push(dongLai, { scroll: false }), THOI_GIAN_DONG);
  };

  // Hẹn giờ phải huỷ khi thẻ bị gỡ. Không huỷ thì cú push vẫn nổ sau khi người
  // dùng đã bấm sang dòng khác, đè URL vừa mở về lại URL đóng — nhìn ra thành
  // "bấm mà không mở được".
  useEffect(() => () => {
    if (hen.current) clearTimeout(hen.current);
  }, []);

  // Ngăn kéo đổi sang bản ghi khác mà thẻ không bị gỡ (bấm dòng khác lúc ngăn
  // kéo đang mở, hoặc đi từ ngăn kéo này sang ngăn kéo kia): trạng thái đóng
  // còn dính lại thì ngăn kéo mới hiện ra trong tư thế đang trượt đi.
  useEffect(() => {
    setDangDong(false);
    if (hen.current) clearTimeout(hen.current);
  }, [dongLai]);

  // Khoá cuộn trang nền khi ngăn kéo đang mở: không khoá thì lăn chuột trong
  // ngăn kéo sẽ đẩy danh sách phía sau chạy theo. Bù đúng bề rộng thanh cuộn
  // để trang không giật ngang lúc khoá.
  useEffect(() => {
    // Thẻ cuộn của trang là html chứ không phải body, đặt overflow lên body
    // không ăn thua.
    const goc = document.documentElement;
    const { body } = document;
    const cuonCu = goc.style.overflow;
    const demCu = body.style.paddingRight;
    const beRong = window.innerWidth - goc.clientWidth;

    goc.style.overflow = "hidden";
    if (beRong > 0) body.style.paddingRight = `${beRong}px`;

    return () => {
      goc.style.overflow = cuonCu;
      body.style.paddingRight = demCu;
    };
  }, []);

  // Điều hướng treo quá lâu thì mở lại, đừng để ngăn kéo nằm vô hình vĩnh viễn.
  useEffect(() => {
    if (!dangDong) return;
    const h = setTimeout(() => setDangDong(false), HET_KIEN_NHAN);
    return () => clearTimeout(h);
  }, [dangDong]);

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
