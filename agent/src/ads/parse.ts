/**
 * Đọc một tab báo cáo quảng cáo của bên marketing.
 *
 * Cấu trúc sheet: mỗi khối là một sản phẩm, trong khối là các hàng chỉ số,
 * cột đầu là TỔNG rồi tới từng ngày trong tháng.
 *
 *   Tổng FA,TỔNG,1/1,2/1,...,31/1
 *   Chi phí,5.159.377,0,0,...
 *   U20,Chi phí,971.008,0,...
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
  orders: number | null;
};

const PRODUCT: Record<string, string> = {
  "tong fa": "TONG",
  "u20": "POCKET_WIFI",
  "wifi cam tay": "POCKET_WIFI",
  "wifi": "POCKET_WIFI",
  "wimax": "WIMAX",
  "wifi wimax": "WIMAX",
  "esim": "ESIM",
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

/** "1/1" -> 2026-01-01. Năm không có trong sheet nên phải truyền vào. */
function parseDate(raw: string, year: number): string | null {
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
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

export function parseAdsTab(csv: string, year: number): AdsRow[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== "");

  // Hàng tiêu đề là hàng đầu tiên có từ hai ô ngày trở lên.
  let dates: (string | null)[] = [];
  let dateOffset = -1;
  let headerIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]!);
    const parsed = cells.map((c) => parseDate(c, year));
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

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]!);
    const first = key(cells[0] ?? "");

    let metricCell: string;
    let valueStart: number;

    if (PRODUCT[first] !== undefined) {
      // Hàng mở đầu một khối sản phẩm: cột 0 là tên sản phẩm, cột 1 là chỉ số.
      product = PRODUCT[first]!;
      metricCell = key(cells[1] ?? "");
      valueStart = 2;
    } else {
      metricCell = first;
      valueStart = 1;
    }

    const field = METRIC[metricCell];
    if (!field) continue;

    // Hàng mở đầu khối có thêm một cột tên sản phẩm ở đầu, nên mọi giá trị
    // lệch sang phải một ô so với hàng tiêu đề.
    const lech = valueStart - 1;

    for (let c = dateOffset; c < dates.length; c++) {
      const date = dates[c];
      if (!date) continue;
      const value = parseNumber(cells[c + lech]);
      if (value === null) continue;

      const k = `${date}|${product}`;
      const row =
        acc.get(k) ??
        { metric_date: date, product, spend: null, reach: null, clicks: null, messages: null, orders: null };
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
