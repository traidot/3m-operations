import { statSync } from "node:fs";
import { basename } from "node:path";
import ExcelJS from "exceljs";
import { pool, q } from "../db.js";

/**
 * Nhập file đối chiếu kho làm tay ở ngoài vào kho dữ liệu.
 *
 *   npm run kho:nhap -- ~/Downloads/Doi_soat_TONG_va_CHI_TIET_theo_muc.xlsx
 *
 * Nhận hai dạng file, tự nhận qua tên sheet:
 *
 *   DẠNG TỔNG HỢP (cũ) — sheet "(1) Tổng nhập" là toàn bộ mã nhập về, sheet
 *   "SỔ QUẢN LÝ - từng dòng" là sổ Google Sheets. Các sheet (2)…(18) là tập
 *   con của (1), phân loại đã nằm ở cột "KẾT LUẬN CUỐI".
 *
 *   DẠNG BIÊN BẢN KÝ (mới) — "01_Nhap_hang" là toàn bộ mã nhập về, và mỗi
 *   trang 04…18 là một danh sách trạng thái đã ký. Ở dạng này phân loại nằm ở
 *   chỗ mã xuất hiện chứ không ở một cột, nên kết luận suy từ tên trang, còn
 *   các trang trạng thái đóng vai sổ.
 */
const SHEET_NHAP = "(1) Tổng nhập";
const SHEET_SO = "SỔ QUẢN LÝ - từng dòng";

/** Dạng biên bản ký: trang mã nhập về, và các trang trạng thái theo thứ tự ưu
 *  tiên khi một mã xuất hiện ở nhiều trang. */
const KY_NHAP = "01_Nhap_hang";
const KY_TRANG: { ten: string; nhan: string; c_ma: number; c_san_pham: number;
                  c_khach?: number; c_kho?: number; c_tinh_trang?: number;
                  c_nguoi_giu?: number }[] = [
  { ten: "02_Tra_Luna", nhan: "Trả lại Luna", c_ma: 2, c_san_pham: 0 },
  { ten: "04_Khach_le_CTV", nhan: "Khách lẻ + CTV đang dùng", c_ma: 3, c_san_pham: 2, c_khach: 5 },
  { ten: "05_Dai_ly", nhan: "Đại lý đang dùng", c_ma: 3, c_san_pham: 2, c_khach: 5 },
  { ten: "06_Cho_co_dinh", nhan: "Dùng chờ wifi cố định", c_ma: 3, c_san_pham: 2, c_khach: 5, c_nguoi_giu: 6 },
  { ten: "07_Cho_kich_hoat", nhan: "Chờ kích hoạt / chờ huỷ", c_ma: 3, c_san_pham: 2, c_khach: 5 },
  { ten: "08_Can_thu_hoi", nhan: "Cần thu hồi", c_ma: 3, c_san_pham: 2, c_khach: 5 },
  { ten: "09_Kho_Viet_Nam", nhan: "Tồn kho Việt Nam", c_ma: 3, c_san_pham: 2, c_kho: 4, c_tinh_trang: 5 },
  { ten: "10_Kho_Takanoba", nhan: "Kiểm kho Takanoba", c_ma: 2, c_san_pham: 0 },
  { ten: "11_Kho_Ibaraki", nhan: "Tồn kho Ibaraki", c_ma: 3, c_san_pham: 2, c_kho: 4, c_tinh_trang: 5 },
  { ten: "12_Ibaraki_da_ban", nhan: "Ibaraki đã bán chưa nhập PM", c_ma: 2, c_san_pham: 0 },
  { ten: "13_Sim_tra_nha_mang", nhan: "Sim trả lại nhà mạng", c_ma: 2, c_san_pham: 3 },
  { ten: "14_Sim_da_huy", nhan: "Sim đã huỷ", c_ma: 2, c_san_pham: 0, c_khach: 3 },
  { ten: "15_Doi_tac_de_lai", nhan: "Đối tác đang dùng", c_ma: 2, c_san_pham: 0, c_nguoi_giu: 3 },
  { ten: "16_Xuat_dai_ly", nhan: "Xuất đại lý, chờ kích hoạt", c_ma: 3, c_san_pham: 2, c_khach: 4, c_tinh_trang: 6 },
  { ten: "17_Khong_thay_nhap_kho", nhan: "Không thấy lúc nhập kho", c_ma: 2, c_san_pham: 0, c_nguoi_giu: 3 },
  { ten: "18_Hong_tra_NCC", nhan: "Hỏng / trả nhà cung cấp", c_ma: 2, c_san_pham: 0, c_nguoi_giu: 3 },
];

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

/** "BẢNG TỔNG HỢP KIỂM KÊ … - CẬP NHẬT 24/09/2026" → Date của ngày đó. */
function ngayChotTrongFile(wb: ExcelJS.Workbook): Date | null {
  const t = chu(wb.getWorksheet("Tổng hợp")?.getCell(1, 1).value ?? "");
  const m = t.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00`) : null;
}

async function main() {
  const file = process.argv[process.argv.length - 1];
  if (!file || file.startsWith("--") || !file.endsWith(".xlsx")) {
    console.error("Dùng: npm run kho:nhap -- <duong-dan.xlsx>");
    process.exit(1);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);

  const laKy = wb.getWorksheet(KY_NHAP) !== undefined;
  const thay = new Map<string, unknown[]>();
  const trung: string[] = [];
  const so_: unknown[][] = [];

  if (laKy) {
    // ── Dạng biên bản ký ────────────────────────────────────────────────
    // Đọc các trang trạng thái trước để biết mỗi mã được xếp vào đâu; một mã
    // chỉ nhận kết luận của trang ĐẦU TIÊN gặp, theo thứ tự KY_TRANG.
    type Xep = { nhan: string; khach: string | null; kho: string | null;
                 tinh_trang: string | null; nguoi_giu: string | null };
    const xep = new Map<string, Xep>();
    for (const t of KY_TRANG) {
      const ws = wb.getWorksheet(t.ten);
      if (!ws) continue;
      for (let i = 2; i <= ws.rowCount; i++) {
        const c = ws.getRow(i).values as O[];
        const ma = chu(c[t.c_ma]);
        if (!LA_MA.test(ma)) continue;
        so_.push([
          t.nhan, i, ma, chuanHoa(ma),
          t.c_san_pham ? rong(chu(c[t.c_san_pham])) : null,
          t.c_khach ? rong(chu(c[t.c_khach])) : null,
          t.c_tinh_trang ? rong(chu(c[t.c_tinh_trang])) : null,
          rong(chu(c[1])),
        ]);
        if (xep.has(chuanHoa(ma))) continue;
        xep.set(chuanHoa(ma), {
          nhan: t.nhan,
          khach: t.c_khach ? rong(chu(c[t.c_khach])) : null,
          kho: t.c_kho ? rong(chu(c[t.c_kho])) : null,
          tinh_trang: t.c_tinh_trang ? rong(chu(c[t.c_tinh_trang])) : null,
          nguoi_giu: t.c_nguoi_giu ? rong(chu(c[t.c_nguoi_giu])) : null,
        });
      }
    }

    const wsNhapKy = wb.getWorksheet(KY_NHAP)!;
    for (let i = 2; i <= wsNhapKy.rowCount; i++) {
      const c = wsNhapKy.getRow(i).values as O[];
      const ma = chu(c[2]);
      if (!LA_MA.test(ma)) continue;
      if (thay.has(ma)) { trung.push(ma); continue; }
      const x = xep.get(chuanHoa(ma));
      thay.set(ma, [
        ma, chuanHoa(ma), rong(chu(c[1])), rong(chu(c[4])),
        x?.nhan ?? "Chưa xếp vào trang nào", null, null,
        x?.khach ?? null, x?.kho ?? null, x?.nguoi_giu ?? null,
        x?.tinh_trang ?? null, null, null, null, null,
      ]);
    }
  } else {
    // ── Dạng tổng hợp ───────────────────────────────────────────────────
    const wsNhap = wb.getWorksheet(SHEET_NHAP);
    const wsSo = wb.getWorksheet(SHEET_SO);
    if (!wsNhap) throw new Error(`File thiếu sheet "${SHEET_NHAP}" lẫn "${KY_NHAP}"`);
    if (!wsSo) throw new Error(`File thiếu sheet "${SHEET_SO}"`);

    for (let i = DONG_DAU_NHAP; i <= wsNhap.rowCount; i++) {
      const c = wsNhap.getRow(i).values as O[];
      const ma = chu(c[3]);
      if (!LA_MA.test(ma)) continue;
      if (thay.has(ma)) { trung.push(ma); continue; }
      thay.set(ma, [
        ma, chuanHoa(ma), rong(chu(c[2])), rong(chu(c[4])), rong(chu(c[5])),
        rong(chu(c[6])), rong(chu(c[7])), rong(chu(c[8])), rong(chu(c[9])),
        rong(chu(c[10])), rong(chu(c[11])), ngay(c[12]), so(c[13]),
        rong(chu(c[14])), rong(chu(c[15])),
      ]);
    }

    for (let i = DONG_DAU_SO; i <= wsSo.rowCount; i++) {
      const c = wsSo.getRow(i).values as O[];
      const ma = chu(c[3]);
      if (!LA_MA.test(ma)) continue;
      so_.push([
        rong(chu(c[1])), so(c[2]), ma, chuanHoa(ma), rong(chu(c[4])),
        rong(chu(c[5])), rong(chu(c[6])), rong(chu(c[8])),
      ]);
    }
  }

  // Bản đối chiếu kho chỉ đúng tại thời điểm chốt nên phải ghi lại, không thì
  // nhìn số trên màn hình không biết là kiểm kho hôm nào. Biên bản ký có ngày
  // chốt viết thẳng trong tiêu đề — tin nó hơn giờ sửa file, vì file còn bị
  // mở ra xem rồi lưu lại nhiều lần sau khi đã chốt.
  const suaLuc = ngayChotTrongFile(wb) ?? statSync(file).mtime;

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

  console.log(`file: ${basename(file)} — dạng ${laKy ? "biên bản ký" : "tổng hợp"} (sửa lúc ${suaLuc.toLocaleString("vi-VN")})`);
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
