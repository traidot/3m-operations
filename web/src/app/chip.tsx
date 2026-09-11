import { MAU_TRANG_THAI } from "@/lib/nhan";

/** Chip trạng thái. `nhan` là bảng tra mã sang chữ tiếng Việt. */
export function Chip({ ma, nhan }: { ma: string | null; nhan: Record<string, string> }) {
  if (!ma) return <span className="muted">—</span>;
  return <span className={`chip ${MAU_TRANG_THAI[ma] ?? "tat"}`}>{nhan[ma] ?? ma}</span>;
}
