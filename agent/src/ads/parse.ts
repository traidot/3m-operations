/**
 * Đọc một tab báo cáo quảng cáo của bên marketing.
 *
 * Cấu trúc lưới ô:
 *
 *   cột 0  tên sản phẩm, chỉ có ở dòng đầu mỗi khối (ô gộp)
 *   cột 1  tên chỉ số, luôn có
 *   cột 2  cột TỔNG của cả tháng
 *   cột 3+ từng ngày
 *
 *   ["", "Tổng FA", "TỔNG",  "1/7", "2/7", ...]
 *   ["", "Chi phí", "62.627.722", "3.435.283", ...]
 *   ["U20", "Chi phí", "19.895.602", "791.466", ...]
 *   ["", "Tiếp cận", "54.788", "546", ...]
 *
 * Chỉ lấy năm số gốc. Các hàng tỉ lệ trong sheet dùng dấu phẩy thập phân nên
 * khi xuất ra bị tách thành nhiều cột — bỏ qua hẳn, tính lại bằng SQL.
 */

export type AdsRow = {
  metric_date: string;
  product: string;
  spend: number | null;
  reach: number | null;
  clicks: number | null;
  messages: number | null;
  /** Đơn marketing báo là đã chốt thành công. */
  orders: number | null;
  /** Đơn huỷ. Không có nó thì "đơn hàng" là số gộp, không phải số thật. */
  orders_cancelled: number | null;
  install_booked: number | null;
  install_done: number | null;
  cancel_customer: number | null;
  cancel_carrier: number | null;
  cancel_duplicate: number | null;
};

const PRODUCT: Record<string, string> = {
  "tong fa": "TONG",
  "u20": "POCKET_WIFI",
  "wifi cam tay": "POCKET_WIFI",
  "wifi": "POCKET_WIFI",
  "wimax": "WIMAX",
  "wifi wimax": "WIMAX",
  "esim": "ESIM",
  // Khối thống kê lắp đặt để riêng, không trộn vào khối chi phí quảng cáo.
  "thong ke wifi co dinh": "FIXED_INSTALL",
  "co dinh": "FIXED_INTERNET",
  "wifi co dinh": "FIXED_INTERNET",
  "sim datacall": "DATA_SIM",
};

const METRIC: Record<string, keyof Omit<AdsRow, "metric_date" | "product">> = {
  "chi phi": "spend",
  "tiep can": "reach",
  "click": "clicks",
  "mess": "messages",
  "don hang": "orders",
  "so don huy": "orders_cancelled",
  "so lich lap dat": "install_booked",
  "so lich lap thanh cong": "install_done",
  "huy do khach hang": "cancel_customer",
  "huy do nha mang": "cancel_carrier",
  "huy do trung lich": "cancel_duplicate",
};

/** Bỏ dấu, hạ chữ thường, gộp khoảng trắng — chỉ để tra bảng ở trên. */
function key(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * "5.159.377" -> 5159377. Dấu chấm là phân cách nghìn, không phải thập phân.
 * Ô rỗng trả null: không có số khác với số 0.
 */
export function parseNumber(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const cleaned = raw.replace(/[.\s]/g, "").replace(/[^\d-]/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * "1/7" -> 2026-07-01. Năm không có trong ô nên phải suy ra từ tháng.
 * Suy từ chính tháng trong ô chứ không từ tên tab: có tab đặt tên "tháng 8"
 * nhưng bên trong là số liệu tháng 7.
 */
function parseDate(raw: string, namTheoThang: (month: number) => number): string | null {
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  const year = namTheoThang(month);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

/** Bọc quanh parseAdsRows cho trường hợp xuất CSV tay. */
export function parseAdsTab(csv: string, year: number): AdsRow[] {
  const rows = csv
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
    .map(splitCsvLine);
  return parseAdsRows(rows, () => year);
}

/**
 * Nhận thẳng lưới ô — Google Sheets API trả về dạng này, và hàng ngắn hơn
 * hàng tiêu đề là bình thường vì ô cuối trống bị cắt.
 */
export function parseAdsRows(
  grid: string[][],
  namTheoThang: (month: number) => number,
): AdsRow[] {

  // Hàng tiêu đề là hàng đầu tiên có từ hai ô ngày trở lên.
  let dates: (string | null)[] = [];
  let dateOffset = -1;
  let headerIndex = -1;

  for (let i = 0; i < grid.length; i++) {
    const parsed = (grid[i] ?? []).map((c) => parseDate(c, namTheoThang));
    if (parsed.filter(Boolean).length >= 2) {
      dates = parsed;
      dateOffset = parsed.findIndex(Boolean);
      headerIndex = i;
      break;
    }
  }
  if (headerIndex < 0) return [];

  // Gom theo (ngày, sản phẩm) rồi mới dựng dòng, vì mỗi chỉ số là một hàng riêng.
  const acc = new Map<string, AdsRow>();
  let product = "TONG";

  for (let i = headerIndex + 1; i < grid.length; i++) {
    const cells = grid[i] ?? [];

    // Ô gộp: tên sản phẩm chỉ xuất hiện ở dòng đầu khối, các dòng sau để trống
    // và vẫn thuộc khối đó.
    const ten = PRODUCT[key(cells[0] ?? "")];
    if (ten) product = ten;

    const field = METRIC[key(cells[1] ?? "")];
    if (!field) continue;

    for (let c = dateOffset; c < dates.length; c++) {
      const date = dates[c];
      if (!date) continue;
      const value = parseNumber(cells[c]);
      if (value === null) continue;

      const k = `${date}|${product}`;
      const row =
        acc.get(k) ??
        {
          metric_date: date, product,
          spend: null, reach: null, clicks: null, messages: null, orders: null,
          orders_cancelled: null, install_booked: null, install_done: null,
          cancel_customer: null, cancel_carrier: null, cancel_duplicate: null,
        };
      row[field] = value;
      acc.set(k, row);
    }
  }

  return [...acc.values()].sort((a, b) =>
    a.metric_date === b.metric_date
      ? a.product.localeCompare(b.product)
      : a.metric_date.localeCompare(b.metric_date),
  );
}
