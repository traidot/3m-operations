import { statSync } from "node:fs";
import { basename } from "node:path";
import ExcelJS from "exceljs";
import { pool, q } from "../db.js";

/**
 * Nhập sao kê ngân hàng wifi cố định vào kho.
 *
 *   npm run sao-ke:nhap -- "data/bill/Sao kê cố định.xlsx"
 *
 * Ba trang là ba tài khoản, và mỗi trang một lược đồ khác nhau: tiêu đề nằm ở
 * dòng khác nhau, cột tiền và cột mã hợp đồng ở vị trí khác nhau, ngày thì trang
 * Yucho Arai ghi dạng 20260519 còn hai trang kia ghi ngày thật. Nên không dò
 * tiêu đề tự động mà chỉ rõ từng trang ở đây — sai một cột là lệch cả triệu.
 */
type Trang = {
  ten: string;
  /** Tên tài khoản bên CMS, để nối thẳng với v_fixed_dot_thu. */
  tai_khoan: string;
  dong_dau: number;
  c_ngay: number;
  c_tien: number;
  c_ma_hd: number;
  c_ten: number;
  /** Trang không có cột loại giao dịch thì coi như tiền vào qua combini. */
  c_loai?: number;
};

const TRANG: Trang[] = [
  { ten: "Yucho Thương", tai_khoan: "youcho thuong", dong_dau: 11, c_ngay: 2, c_tien: 5, c_ma_hd: 9, c_ten: 8, c_loai: 4 },
  { ten: "Yucho Arai cố định", tai_khoan: "Youcho Arai", dong_dau: 9, c_ngay: 1, c_tien: 3, c_ma_hd: 9, c_ten: 6, c_loai: 5 },
  { ten: "GMO", tai_khoan: "Combini 3M", dong_dau: 2, c_ngay: 1, c_tien: 3, c_ma_hd: 6, c_ten: 5 },
];

/**
 * Chuyển khoản nội bộ: trang Yucho Arai có giao dịch 振込 từ ｶ)ｼ-ｷﾔｽﾄ mang mã
 * "3M" — tiền công ty tự chuyển giữa các tài khoản, không phải khách trả. Riêng
 * tháng 6/2026 là 2.668.000 trên tổng 2.813.000.
 */
const NOI_BO = (loai: string, ten: string) =>
  loai === "振込" && /ｼ-?ｷﾔｽﾄ|ｷﾔｽﾄ/.test(ten);

type O = ExcelJS.CellValue;

function chu(v: O): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as unknown as Record<string, unknown>;
    if ("result" in o) return chu(o.result as O);
    if ("text" in o) return String(o.text);
    if ("richText" in o) return (o.richText as { text: string }[]).map((r) => r.text).join("");
    return "";
  }
  return String(v).trim();
}

const so = (v: O) => {
  const s = chu(v).replace(/[^\d.-]/g, "");
  return s === "" ? 0 : Number(s);
};

/** Trang Yucho Arai ghi ngày dạng 20260519, hai trang kia ghi ngày thật. */
function ngay(v: O): string | null {
  let s = chu(v).trim();
  if (/^\d{8}$/.test(s)) s = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}`;
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}

const maHd = (v: O) => {
  const m = chu(v).toUpperCase().match(/\b(?:HD|HH)\d{6}\b/);
  return m ? m[0] : null;
};

const rong = (s: string) => (s === "" ? null : s);

type Dong = {
  tai_khoan: string; trang: string; dong: number; ngay: string | null;
  thang: string | null; tien_vao: number; ma_hd: string | null;
  ten_gd: string | null; loai_gd: string | null; noi_bo: boolean;
};

function doc(wb: ExcelJS.Workbook): Dong[] {
  const ra: Dong[] = [];
  for (const t of TRANG) {
    const ws = wb.getWorksheet(t.ten);
    if (!ws) throw new Error(`Không thấy trang "${t.ten}" trong file`);
    for (let i = t.dong_dau; i <= ws.rowCount; i++) {
      const r = ws.getRow(i);
      const tien = so(r.getCell(t.c_tien).value);
      if (tien <= 0) continue;               // dòng tiền ra và dòng tổng
      const d = ngay(r.getCell(t.c_ngay).value);
      const loai = t.c_loai ? chu(r.getCell(t.c_loai).value) : "combini";
      const ten = chu(r.getCell(t.c_ten).value);
      ra.push({
        tai_khoan: t.tai_khoan, trang: t.ten, dong: i, ngay: d,
        thang: d ? d.slice(0, 7) : null, tien_vao: tien,
        ma_hd: maHd(r.getCell(t.c_ma_hd).value),
        ten_gd: rong(ten), loai_gd: rong(loai), noi_bo: NOI_BO(loai, ten),
      });
    }
  }
  return ra;
}

async function main() {
  const duong = process.argv[2];
  if (!duong) {
    console.error('Thiếu đường dẫn file. Ví dụ: npm run sao-ke:nhap -- "data/bill/Sao kê cố định.xlsx"');
    process.exit(1);
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(duong);
  const dong = doc(wb);
  if (dong.length === 0) throw new Error("Không đọc được dòng nào — kiểm lại tên trang và số cột");

  const [lan] = await q<{ id: string }>(
    `insert into bank_import (ten_file, sua_luc, so_dong) values ($1, $2, $3) returning id::text`,
    [basename(duong), statSync(duong).mtime, dong.length],
  );
  const importId = Number(lan!.id);

  // Chèn theo lô để không dựng một câu lệnh khổng lồ.
  const LO = 500;
  for (let i = 0; i < dong.length; i += LO) {
    const lo = dong.slice(i, i + LO);
    const gt: unknown[] = [];
    const cho = lo.map((d, k) => {
      const n = k * 11;
      gt.push(importId, d.tai_khoan, d.trang, d.dong, d.ngay, d.thang,
              d.tien_vao, d.ma_hd, d.ten_gd, d.loai_gd, d.noi_bo);
      return `($${n + 1},$${n + 2},$${n + 3},$${n + 4},$${n + 5},$${n + 6},$${n + 7},$${n + 8},$${n + 9},$${n + 10},$${n + 11})`;
    });
    await q(
      `insert into bank_row (import_id, tai_khoan, trang, dong, ngay, thang,
                             tien_vao, ma_hd, ten_gd, loai_gd, noi_bo)
       values ${cho.join(",")}`,
      gt,
    );
  }

  // Chỉ một lần nhập được dùng; lần cũ giữ lại để truy ngược chứ không xoá.
  await q(`update bank_import set dang_dung = false where id <> $1`, [importId]);

  const tom = await q<{ tai_khoan: string; so: string; tho: string; nb: string; khach: string }>(
    `select tai_khoan, count(*)::text as so, sum(tien_vao)::text as tho,
            coalesce(sum(tien_vao) filter (where noi_bo), 0)::text as nb,
            coalesce(sum(tien_vao) filter (where not noi_bo), 0)::text as khach
       from bank_row where import_id = $1 group by 1 order by 5 desc`,
    [importId],
  );
  const tien = (s: string) => Number(s).toLocaleString("vi-VN");
  console.log(`Đã nhập ${dong.length} giao dịch từ ${basename(duong)} (lần nhập #${importId})`);
  for (const r of tom)
    console.log(`  ${r.tai_khoan.padEnd(16)} ${r.so.padStart(5)} gd · thô ${tien(r.tho).padStart(12)}` +
                ` · nội bộ ${tien(r.nb).padStart(10)} · khách ${tien(r.khach).padStart(11)}`);
  const [t] = await q<{ n: string }>(
    `select count(*)::text as n from bank_row where import_id = $1 and ngay is null`, [importId]);
  if (Number(t!.n) > 0) console.log(`  ${t!.n} dòng không đọc được ngày — không vào được bảng theo tháng`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
