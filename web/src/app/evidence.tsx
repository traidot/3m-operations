/**
 * Chứng cứ của một phán quyết. Dữ liệu là jsonb tự do nên hiển thị theo bảng
 * nhãn đã biết, khoá lạ thì vẫn hiện chứ không nuốt mất.
 */

const NHAN: Record<string, string> = {
  so_ky: "tổng kỳ",
  so_ky_no: "kỳ nợ",
  so_ky_mien_phi: "kỳ miễn phí",
  con_no: "còn nợ",
  tong_da_thu: "đã thu",
  ky_da_thu_gan_nhat: "thu tới kỳ",
  ky_cho_duyet: "kỳ chờ duyệt",
  ky_ghi_chu: "kỳ ghi chú",
  ngay_qua_han: "quá hạn",
  so_ngay_cham: "chậm",
  ngay_moi_nhat: "số mới nhất",
  so_ban_ghi: "bản ghi",
  tong_tien: "tổng tiền",
  gio_ke_tu_lan_cuoi: "giờ kể từ lần cuối",
  imei: "IMEI",
  due_on: "hạn",
  issued_on: "ngày giao",
};

/** Đã có trong tiêu đề rồi, lặp lại chỉ tổ rối. */
const BO_QUA = new Set(["contract_code", "trang_thai_hop_dong", "trang_thai_lap_dat"]);

const TIEN = new Set(["con_no", "tong_da_thu", "tong_tien", "tong_no", "monthly_price"]);

function hienThi(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") {
    return TIEN.has(key) ? value.toLocaleString("vi-VN") : String(value);
  }
  if (typeof value === "boolean") return value ? "có" : "không";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function Evidence({ data }: { data: Record<string, unknown> }) {
  const muc = Object.entries(data).filter(([k, v]) => {
    if (BO_QUA.has(k)) return false;
    // Đếm bằng 0 là bình thường, không cần chiếm chỗ.
    if (v === 0 && (k.startsWith("so_") || k.startsWith("ky_"))) return false;
    return v !== null && v !== undefined && v !== "";
  });

  if (muc.length === 0) return null;

  return (
    <dl className="chung-cu">
      {muc.map(([k, v]) => (
        <div key={k}>
          <dt>{NHAN[k] ?? k.replace(/_/g, " ")}</dt>
          <dd>{hienThi(k, v)}</dd>
        </div>
      ))}
    </dl>
  );
}
