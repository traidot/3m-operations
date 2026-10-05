import { redirect } from "next/navigation";

/** Màn đã đổi tên thành /tien khi gộp. Giữ chỗ này cho link cũ. */
export default function Page() {
  redirect("/tien");
}
