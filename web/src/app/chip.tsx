import { LOAI_KHACH, MAU_LOAI_KHACH, MAU_TRANG_THAI } from "@/lib/nhan";

/** Chip trạng thái. `nhan` là bảng tra mã sang chữ tiếng Việt. */
export function Chip({ ma, nhan }: { ma: string | null; nhan: Record<string, string> }) {
  if (!ma) return <span className="muted">—</span>;
  return <span className={`chip ${MAU_TRANG_THAI[ma] ?? "tat"}`}>{nhan[ma] ?? ma}</span>;
}

/**
 * Vai trò khách. Màu để phân loại chứ không xếp hạng: khách lẻ là mức nền,
 * cộng tác viên lam, đại lý tím — hai vai trò giữ nhiều thuê bao nên phải
 * bắt mắt ngay giữa hàng nghìn dòng khách lẻ.
 */
export function ChipLoaiKhach({ ma }: { ma: string | null }) {
  if (!ma) return <span className="chip tat">chưa phân loại</span>;
  return (
    <span className={`chip ${MAU_LOAI_KHACH[ma] ?? "tat"}`}>
      {LOAI_KHACH[ma] ?? ma}
    </span>
  );
}
