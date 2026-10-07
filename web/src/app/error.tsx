"use client";

import Link from "next/link";

/**
 * Màn hình khi một trang ném lỗi.
 *
 * Mọi màn ở đây đọc thẳng từ kho số liệu, nên lỗi hay gặp nhất là kho chưa
 * chạy hoặc một view vừa đổi mà chưa chạy migration. Vì vậy trang này nói
 * luôn hai chỗ cần kiểm thay vì chỉ "đã có lỗi xảy ra".
 *
 * KHÔNG in `error.message` ra màn: thông báo của Postgres hay kèm tên bảng,
 * tên cột và cả mảnh câu lệnh. Chi tiết nằm ở log máy chủ, nơi chỉ người vận
 * hành đọc được.
 */
export default function Loi({ reset }: { error: Error; reset: () => void }) {
  return (
    <main>
      <h1>Trang này đang lỗi</h1>
      <p className="muted">
        Không dựng được số liệu cho trang vừa mở. Hai nguyên nhân thường gặp:
        kho số liệu không chạy, hoặc có migration mới chưa chạy nên một bảng
        còn thiếu. Chi tiết nằm trong log máy chủ.
      </p>
      <p className="actions">
        <button type="button" className="primary" onClick={reset}>
          Thử lại
        </button>
        <Link href="/dong-bo">
          <button type="button">Xem tình trạng đồng bộ →</button>
        </Link>
      </p>
    </main>
  );
}
