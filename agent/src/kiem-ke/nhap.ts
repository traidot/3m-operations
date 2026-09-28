import { statSync } from "node:fs";
import { basename } from "node:path";
import ExcelJS from "exceljs";
import { pool, q } from "../db.js";

/**
 * Nhập biên bản kiểm kê SIM/cục wifi của bên telecom vào kho.
 *
 *   npm run kiem-ke:nhap -- "../data/kiem-ke-telecom.xlsx"
 *
 * Lấy TOÀN BỘ 15 trang chi tiết, không chỉ khối "đang dùng": so kiểm kê với
 * phần mềm mà chỉ nạp năm trang đang dùng thì máy nằm trong kho sẽ bị kể là
 * "kiểm kê không có", ra kết luận sai.
 *
 * Mỗi trang một lược đồ khác nhau — trang chờ cố định có người phụ trách và
 * đại lý nội bộ, trang cần thu hồi có nhóm khách hàng mà không có mã đơn,
 * trang kho có vị trí kho và trạng thái thiết bị. Chỉ rõ từng trang ở đây chứ
 * không dò tiêu đề tự động.
 */

type Trang = {
  ten: string;
  /** Nhãn gọn, trùng với cột trên trang Tổng hợp. */
  trang_thai: string;
  /** Cột trong trang Tổng hợp, để đối chiếu số đếm được với số ghi tay. */
  cot_tong_hop: number;
  c_nhom: number;
  c_san_pham: number;
  c_ma: number;
  c_ma_kh?: number;
  c_khach?: number;
  c_ma_dvkh?: number;
  c_ma_don?: number;
  c_nhom_khach?: number;
  c_phu_trach?: number;
  c_dai_ly?: number;
  c_kho?: number;
  c_tinh_trang?: number;
  c_ghi_chu?: number;
  /** Trang không nằm trong khối "đang dùng" thì không có ô nào bên Tổng hợp. */
  khoi: "dang_dung" | "kho" | "khac" | "nhap_hang" | "tra_luna";
};

const TRANG: Trang[] = [
  {
    ten: "04_Khach_le_CTV", trang_thai: "khach_le_ctv", cot_tong_hop: 5, khoi: "dang_dung",
    c_nhom: 1, c_san_pham: 2, c_ma: 3, c_khach: 5, c_ma_kh: 6, c_ma_dvkh: 7, c_ma_don: 8,
  },
  {
    ten: "05_Dai_ly", trang_thai: "dai_ly", cot_tong_hop: 6, khoi: "dang_dung",
    c_nhom: 1, c_san_pham: 2, c_ma: 3, c_khach: 5, c_ma_kh: 6, c_ma_dvkh: 7, c_ma_don: 8,
  },
  {
    ten: "06_Cho_co_dinh", trang_thai: "cho_co_dinh", cot_tong_hop: 7, khoi: "dang_dung",
    c_nhom: 1, c_san_pham: 2, c_ma: 3, c_ma_dvkh: 4, c_khach: 5,
    c_phu_trach: 6, c_dai_ly: 7, c_ma_don: 8,
  },
  {
    ten: "07_Cho_kich_hoat", trang_thai: "cho_kich_hoat", cot_tong_hop: 8, khoi: "dang_dung",
    c_nhom: 1, c_san_pham: 2, c_ma: 3, c_khach: 5, c_ma_kh: 6, c_ma_dvkh: 7, c_ma_don: 8,
  },
  {
    ten: "08_Can_thu_hoi", trang_thai: "can_thu_hoi", cot_tong_hop: 9, khoi: "dang_dung",
    c_nhom: 1, c_san_pham: 2, c_ma: 3, c_ma_kh: 4, c_khach: 5, c_nhom_khach: 6,
  },
  // Hai trang gốc: toàn bộ mã nhập về và phần trả lại Luna. Không phải trạng
  // thái hiện tại nên để khối riêng — đối soát trạng thái phải loại chúng ra,
  // không thì một mã bị đếm hai lần.
  {
    ten: "01_Nhap_hang", trang_thai: "nhap_hang", cot_tong_hop: 2, khoi: "nhap_hang",
    c_nhom: 1, c_ma: 2, c_san_pham: 3, c_ghi_chu: 4,
  },
  {
    ten: "02_Tra_Luna", trang_thai: "tra_luna", cot_tong_hop: 3, khoi: "tra_luna",
    c_nhom: 1, c_ma: 2, c_san_pham: 0,
  },
  {
    ten: "09_Kho_Viet_Nam", trang_thai: "kho_viet_nam", cot_tong_hop: 12, khoi: "kho",
    c_nhom: 1, c_san_pham: 2, c_ma: 3, c_kho: 4, c_tinh_trang: 5, c_ghi_chu: 6,
  },
  {
    ten: "10_Kho_Takanoba", trang_thai: "kho_takanoba", cot_tong_hop: 13, khoi: "kho",
    c_nhom: 1, c_ma: 2, c_san_pham: 0, c_ghi_chu: 6,
  },
  {
    ten: "11_Kho_Ibaraki", trang_thai: "kho_ibaraki", cot_tong_hop: 14, khoi: "kho",
    c_nhom: 1, c_san_pham: 2, c_ma: 3, c_kho: 4, c_tinh_trang: 5, c_ghi_chu: 6,
  },
  {
    ten: "12_Ibaraki_da_ban", trang_thai: "ibaraki_da_ban", cot_tong_hop: 15, khoi: "kho",
    c_nhom: 1, c_ma: 2, c_san_pham: 0,
  },
  {
    ten: "13_Sim_tra_nha_mang", trang_thai: "sim_tra_nha_mang", cot_tong_hop: 18, khoi: "khac",
    c_nhom: 1, c_ma: 2, c_san_pham: 3,
  },
  {
    ten: "14_Sim_da_huy", trang_thai: "sim_da_huy", cot_tong_hop: 19, khoi: "khac",
    c_nhom: 1, c_ma: 2, c_san_pham: 0, c_khach: 3, c_ma_dvkh: 4,
  },
  {
    ten: "15_Doi_tac_de_lai", trang_thai: "doi_tac_de_lai", cot_tong_hop: 20, khoi: "khac",
    c_nhom: 1, c_ma: 2, c_san_pham: 0, c_ghi_chu: 3,
  },
  {
    ten: "16_Xuat_dai_ly", trang_thai: "xuat_dai_ly", cot_tong_hop: 21, khoi: "khac",
    c_nhom: 1, c_san_pham: 2, c_ma: 3, c_khach: 4, c_ma_dvkh: 5, c_tinh_trang: 6,
  },
  {
    ten: "17_Khong_thay_nhap_kho", trang_thai: "khong_thay_nhap_kho", cot_tong_hop: 22, khoi: "khac",
    c_nhom: 1, c_ma: 2, c_san_pham: 0, c_ghi_chu: 3,
  },
  {
    ten: "18_Hong_tra_NCC", trang_thai: "hong_tra_ncc", cot_tong_hop: 23, khoi: "khac",
    c_nhom: 1, c_ma: 2, c_san_pham: 0, c_ghi_chu: 3,
  },
];

/** Cột J của trang Tổng hợp — tổng của năm cột "đang dùng". */
const COT_TONG = 10;

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

const rong = (s: string) => (s === "" ? null : s);
const so = (v: O) => {
  const s = chu(v).replace(/[^\d-]/g, "");
  return s === "" ? 0 : Number(s);
};

/** Ngày chốt nằm trong tiêu đề: "… - CẬP NHẬT 24/09/2026". */
function ngayChot(wb: ExcelJS.Workbook): string | null {
  const t = chu(wb.getWorksheet("Tổng hợp")?.getCell(1, 1).value ?? "");
  const m = t.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

type Dong = {
  trang: string; dong: number; trang_thai: string; nhom: string | null;
  san_pham: string | null; ma: string; ma_kh: string | null; khach: string | null;
  ma_dvkh: string | null; ma_don: string | null; nhom_khach: string | null;
  phu_trach: string | null; dai_ly: string | null;
  kho: string | null; tinh_trang: string | null; ghi_chu: string | null;
  khoi: string;
};

function doc(wb: ExcelJS.Workbook): Dong[] {
  const ra: Dong[] = [];
  for (const t of TRANG) {
    const ws = wb.getWorksheet(t.ten);
    if (!ws) throw new Error(`Không thấy trang "${t.ten}" trong file`);
    const lay = (r: ExcelJS.Row, c?: number) => (c ? rong(chu(r.getCell(c).value)) : null);
    for (let i = 2; i <= ws.rowCount; i++) {
      const r = ws.getRow(i);
      const ma = chu(r.getCell(t.c_ma).value);
      if (!ma) continue;
      ra.push({
        trang: t.ten, dong: i, trang_thai: t.trang_thai,
        nhom: lay(r, t.c_nhom), san_pham: lay(r, t.c_san_pham), ma,
        ma_kh: lay(r, t.c_ma_kh), khach: lay(r, t.c_khach),
        ma_dvkh: lay(r, t.c_ma_dvkh), ma_don: lay(r, t.c_ma_don),
        nhom_khach: lay(r, t.c_nhom_khach), phu_trach: lay(r, t.c_phu_trach),
        dai_ly: lay(r, t.c_dai_ly), kho: lay(r, t.c_kho),
        tinh_trang: lay(r, t.c_tinh_trang), ghi_chu: lay(r, t.c_ghi_chu),
        khoi: t.khoi,
      });
    }
  }
  return ra;
}

/** Cột E..J của trang Tổng hợp, giữ nguyên số người ta gõ. */
function docTongHop(wb: ExcelJS.Workbook): { nhom: string; cot: string; so_luong: number }[] {
  const ws = wb.getWorksheet("Tổng hợp");
  if (!ws) throw new Error("Không thấy trang Tổng hợp");
  const ra: { nhom: string; cot: string; so_luong: number }[] = [];
  for (let r = 6; r <= ws.rowCount; r++) {
    const nhom = chu(ws.getCell(r, 1).value);
    // Dưới bảng số là mục lục "CÁC SHEET MÃ CHI TIẾT" — cũng có tên ở cột 1 và
    // số ở cột 2, quét tiếp là đọc số dòng của sheet thành số lượng của nhóm.
    if (nhom.startsWith("CÁC SHEET")) break;
    if (!nhom || nhom.toUpperCase() === "TỔNG") continue;
    for (const t of TRANG)
      ra.push({ nhom, cot: t.trang_thai, so_luong: so(ws.getCell(r, t.cot_tong_hop).value) });
    ra.push({ nhom, cot: "tong", so_luong: so(ws.getCell(r, COT_TONG).value) });
  }
  return ra;
}

async function main() {
  const duong = process.argv[2];
  if (!duong) {
    console.error('Thiếu đường dẫn file. Ví dụ: npm run kiem-ke:nhap -- "../data/kiem-ke-telecom.xlsx"');
    process.exit(1);
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(duong);
  const dong = doc(wb);
  if (dong.length === 0) throw new Error("Không đọc được dòng nào — kiểm lại tên trang và số cột");
  const tongHop = docTongHop(wb);

  const [lan] = await q<{ id: string }>(
    `insert into kiem_ke_import (ten_file, chot_ngay, sua_luc, so_dong)
     values ($1, $2, $3, $4) returning id::text`,
    [basename(duong), ngayChot(wb), statSync(duong).mtime, dong.length],
  );
  const importId = Number(lan!.id);

  const LO = 500;
  for (let i = 0; i < dong.length; i += LO) {
    const lo = dong.slice(i, i + LO);
    const gt: unknown[] = [];
    const cho = lo.map((d, k) => {
      const n = k * 18;
      gt.push(importId, d.trang, d.dong, d.trang_thai, d.nhom, d.san_pham, d.ma,
              d.ma_kh, d.khach, d.ma_dvkh, d.ma_don, d.nhom_khach, d.phu_trach, d.dai_ly,
              d.kho, d.tinh_trang, d.ghi_chu, d.khoi);
      return `(${Array.from({ length: 18 }, (_, x) => `$${n + x + 1}`).join(",")})`;
    });
    await q(
      `insert into kiem_ke_may (import_id, trang, dong, trang_thai, nhom, san_pham, ma,
                                ma_kh, khach, ma_dvkh, ma_don, nhom_khach, phu_trach, dai_ly,
                                kho, tinh_trang, ghi_chu, khoi)
       values ${cho.join(",")}`,
      gt,
    );
  }

  for (const t of tongHop)
    await q(
      `insert into kiem_ke_tong_hop (import_id, nhom, cot, so_luong) values ($1,$2,$3,$4)`,
      [importId, t.nhom, t.cot, t.so_luong],
    );

  await q(`update kiem_ke_import set dang_dung = false where id <> $1`, [importId]);

  const tom = await q<{ trang_thai: string; so: string }>(
    `select trang_thai, count(*)::text as so from kiem_ke_may
      where import_id = $1 group by 1 order by 2 desc`, [importId]);
  console.log(`Đã nhập ${dong.length} máy từ ${basename(duong)} (lần kiểm kê #${importId}, chốt ${ngayChot(wb) ?? "?"})`);
  for (const r of tom) console.log(`  ${r.trang_thai.padEnd(16)} ${r.so.padStart(5)} máy`);

  const lech = await q<{ cot: string; nhom: string; thuc_te: string; ghi_o_tong_hop: string; lech: string }>(
    `select cot, nhom, thuc_te::text, ghi_o_tong_hop::text, lech::text
       from v_kiem_ke_lech where lech <> 0 order by abs(lech) desc`);
  if (lech.length === 0) console.log("  trang chi tiết khớp trang Tổng hợp ở mọi nhóm");
  else {
    console.log(`\n  ${lech.length} chỗ trang chi tiết lệch trang Tổng hợp:`);
    for (const r of lech)
      console.log(`    ${r.cot.padEnd(16)} ${r.nhom.padEnd(24)} chi tiết ${r.thuc_te.padStart(5)} · tổng hợp ${r.ghi_o_tong_hop.padStart(5)} · lệch ${r.lech}`);
  }
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
