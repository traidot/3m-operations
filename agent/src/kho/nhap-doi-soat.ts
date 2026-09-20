import { statSync } from "node:fs";
import { basename } from "node:path";
import ExcelJS from "exceljs";
import { pool, q } from "../db.js";

/**
 * Nhập file đối chiếu kho làm tay ở ngoài vào kho dữ liệu.
 *
 *   npm run kho:nhap -- ~/Downloads/Doi_soat_TONG_va_CHI_TIET_theo_muc.xlsx
 *
 * File có hai phía cần lấy: sheet "(1) Tổng nhập" là toàn bộ mã nhập về theo
 * file nhà cung cấp, và sheet "SỔ QUẢN LÝ - từng dòng" là sổ Google Sheets.
 * Các sheet (2)…(18) đều là tập con của (1), phân loại đã nằm ở cột "KẾT LUẬN
 * CUỐI" nên không cần đọc lại.
 */
const SHEET_NHAP = "(1) Tổng nhập";
const SHEET_SO = "SỔ QUẢN LÝ - từng dòng";

/** Dòng tiêu đề nằm ở dòng 3 của sheet (1), dữ liệu bắt đầu từ dòng 4. */
const DONG_DAU_NHAP = 4;
const DONG_DAU_SO = 2;

/** Mã máy là IMEI 15 số hoặc số SIM 10–11 số; bỏ mọi thứ khác. */
const LA_MA = /^[0-9]{8,20}$/;

type O = ExcelJS.CellValue;

function chu(v: O): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    // Ô công thức trả về { formula, result }, ô định dạng trả về richText.
    const o = v as unknown as Record<string, unknown>;
    if ("result" in o) return chu(o.result as O);
    if ("text" in o) return String(o.text);
    if ("richText" in o) {
      return (o.richText as { text: string }[]).map((r) => r.text).join("");
    }
    return "";
  }
  return String(v).trim();
}

const rong = (s: string) => (s === "" ? null : s);

/** Bỏ số 0 đầu. Kho phần mềm có mã SIM để 0 đầu, file thì không. */
const chuanHoa = (ma: string) => ma.replace(/^0+/, "");

function ngay(v: O): string | null {
  const s = chu(v);
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[0]! : null;
}

function so(v: O): number | null {
  const s = chu(v).replace(/[^\d.-]/g, "");
  return s === "" ? null : Number(s);
}

const LO = 500;

/** Ghi theo lô; 6.855 dòng mà mỗi dòng một lệnh thì đợi mỏi mắt. */
async function ghiLo(sql: (tuples: string) => string, rows: unknown[][]) {
  for (let i = 0; i < rows.length; i += LO) {
    const lo = rows.slice(i, i + LO);
    const params: unknown[] = [];
    const tuples = lo
      .map((r) => `(${r.map((v) => `$${params.push(v)}`).join(", ")})`)
      .join(", ");
    await q(sql(tuples), params);
  }
}

async function main() {
  const file = process.argv[process.argv.length - 1];
  if (!file || file.startsWith("--") || !file.endsWith(".xlsx")) {
    console.error("Dùng: npm run kho:nhap -- <duong-dan.xlsx>");
    process.exit(1);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);

  const wsNhap = wb.getWorksheet(SHEET_NHAP);
  const wsSo = wb.getWorksheet(SHEET_SO);
  if (!wsNhap) throw new Error(`File thiếu sheet "${SHEET_NHAP}"`);
  if (!wsSo) throw new Error(`File thiếu sheet "${SHEET_SO}"`);

  // ── Phía 1: mã nhập về ────────────────────────────────────────────────
  const thay = new Map<string, unknown[]>();
  const trung: string[] = [];
  for (let i = DONG_DAU_NHAP; i <= wsNhap.rowCount; i++) {
    const c = wsNhap.getRow(i).values as O[];
    const ma = chu(c[3]);
    if (!LA_MA.test(ma)) continue;
    if (thay.has(ma)) {
      trung.push(ma);
      continue;
    }
    thay.set(ma, [
      ma, chuanHoa(ma), rong(chu(c[2])), rong(chu(c[4])), rong(chu(c[5])),
      rong(chu(c[6])), rong(chu(c[7])), rong(chu(c[8])), rong(chu(c[9])),
      rong(chu(c[10])), rong(chu(c[11])), ngay(c[12]), so(c[13]),
      rong(chu(c[14])), rong(chu(c[15])),
    ]);
  }

  // ── Phía 2: sổ quản lý ────────────────────────────────────────────────
  const so_: unknown[][] = [];
  for (let i = DONG_DAU_SO; i <= wsSo.rowCount; i++) {
    const c = wsSo.getRow(i).values as O[];
    const ma = chu(c[3]);
    if (!LA_MA.test(ma)) continue;
    so_.push([
      rong(chu(c[1])), so(c[2]), ma, chuanHoa(ma), rong(chu(c[4])),
      rong(chu(c[5])), rong(chu(c[6])), rong(chu(c[8])),
    ]);
  }

  // Ngày sửa file gần với ngày chốt số hơn là ngày bấm nhập — bản đối chiếu kho
  // chỉ đúng tại thời điểm chốt nên phải ghi lại, không thì nhìn số trên màn
  // hình không biết là kiểm kho hôm nào.
  const suaLuc = statSync(file).mtime;

  // Nhập lại là thay hẳn bản cũ: file đối chiếu ra bản mới thì bản cũ hết dùng,
  // giữ lại chỉ làm lẫn hai lần kiểm kho khác ngày. Riêng thông tin LẦN NHẬP thì
  // giữ hết để còn biết lần trước nhập hôm nào.
  await q("update stock_audit_import set dang_dung = false where dang_dung");
  const [lan] = await q<{ id: string }>(
    `insert into stock_audit_import (ten_file, sua_luc, so_ma, so_dong_so, so_ma_trung)
     values ($1, $2, $3, $4, $5) returning id`,
    [basename(file), suaLuc, thay.size, so_.length, trung.length],
  );
  const importId = lan!.id;

  await q("truncate stock_audit_row");
  await q("truncate stock_audit_book restart identity");

  await ghiLo(
    (t) => `insert into stock_audit_row
      (ma, ma_chuan, nhom_hang, ghi_chu_nhap, ket_luan, vi_tri_so, ds_chua,
       khach_theo_so, vi_tri_kiem_kho, nguoi_giu, trang_thai_sim,
       ngay_thue_gan_nhat, coc, tt_thu_hoi, tt_hoan_coc, import_id)
      values ${t}`,
    [...thay.values()].map((r) => [...r, importId]),
  );
  await ghiLo(
    (t) => `insert into stock_audit_book
      (danh_sach, dong_goc, ma, ma_chuan, san_pham, khach, trang_thai, nhom_cot, import_id)
      values ${t}`,
    so_.map((r) => [...r, importId]),
  );

  console.log(`file: ${basename(file)} (sửa lúc ${suaLuc.toLocaleString("vi-VN")})`);
  console.log(`mã nhập về: ${thay.size}`);
  console.log(`dòng sổ quản lý: ${so_.length}`);
  if (trung.length > 0) {
    console.log(`bỏ qua ${trung.length} mã trùng: ${trung.slice(0, 5).join(", ")}`);
  }
}

main()
  .catch((e) => {
    console.error("Lỗi:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
