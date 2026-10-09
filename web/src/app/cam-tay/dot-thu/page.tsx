import { redirect } from "next/navigation";

/**
 * Màn này đã gộp vào tab của bộ bảy màn mới. Giữ đường cũ để bookmark và link
 * trong tài liệu vẫn tới đúng chỗ — nội dung không mất, chỉ đổi nhà.
 */
export default function Page() {
  redirect("/tien/cam-tay");
}
