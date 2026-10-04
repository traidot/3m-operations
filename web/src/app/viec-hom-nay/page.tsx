import { redirect } from "next/navigation";

/**
 * Màn này đã tách làm hai theo mảng. Giữ lại một chỗ chuyển hướng cho link cũ
 * — hai màn con đều có liên kết sang nhau ngay ở đoạn đầu nên vào bên nào
 * trước cũng được.
 */
export default function Page() {
  redirect("/viec-hom-nay/co-dinh");
}
