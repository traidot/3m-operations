import ExcelJS from "exceljs";
import { pool, q } from "../db.js";
import { banKeTiep } from "../ten-file.js";
import { ghep, type Dot, type GiaoDich } from "./ghep.js";

/**
 * Đối soát sao kê ngân hàng với phần mềm ở mức TỪNG GIAO DỊCH.
 *
 *   npm run sao-ke:doi-soat
 *
 * Bảng theo tháng chỉ nói tháng nào lệch bao nhiêu, không nói lệch ở giao dịch
 * nào. Trang "Từng giao dịch" đặt mỗi dòng sao kê cạnh đợt thu đã ghép được,
 * nên soi được đến từng khoản.
 *
 * Sao kê nhiều tiền hơn phần mềm rất nhiều (12,1 triệu so với 4,5 triệu) vì ba
 * tài khoản này còn nhận cả tiền ngoài cước wifi cố định. Giao dịch không ghép
 * được là chuyện bình thường, không mặc nhiên là lỗi.
 */

const TIEN = "#,##0";
const XAM = "FFEFEFEF";
const XANH = "FFE8F5E9";   // ghép chắc
const VANG = "FFFFF3CD";   // ghép được nhưng lệch tài khoản hoặc lệch ngày nhiều
const TIM = "FFEDE7F6";    // ghép chỉ dựa số tiền và ngày
const DO = "FFFCE4E4";     // không ghép được

type BanGhi = {
  mau: string; ten: string;
};

/** Nhãn cho từng bậc ghép, nói rõ dựa vào cái gì nên tin được đến đâu. */
const BAC_TEN: Record<number, BanGhi> = {
  1: { mau: XANH, ten: "Khớp mã hợp đồng, số tiền, tài khoản, ngày lệch ≤ 5" },
  2: { mau: VANG, ten: "Khớp mã hợp đồng và số tiền, nhưng khác tài khoản hoặc lệch ngày ≤ 15" },
  3: { mau: VANG, ten: "Khớp mã hợp đồng và số tiền, ngày cách xa" },
  4: { mau: TIM, ten: "Chỉ khớp số tiền, tài khoản và ngày — sao kê không ghi mã hợp đồng" },
};

type GdRow = GiaoDich & {
  trang: string; dong: number; ten_gd: string | null;
  loai_gd: string | null; noi_bo: boolean;
};

type DotRow = Dot & {
  ky: string; dia_chi: string | null;
  trang_thai_dot: string | null; trang_thai_phieu: string | null;
};

type Thang = {
  thang: string; tai_khoan: string; so_gd: string; tien_tho: string;
  noi_bo: string; tien_khach: string; so_dot_pm: string; tien_pm: string;
  chenh: string;
};

const num = (v: unknown) => Number(v);

async function main() {
  const gdAll = await q<GdRow & { tien_vao: string; id: string }>(`
    select r.id::text, r.tai_khoan, r.ngay::text as ngay, r.tien_vao::text,
           r.ma_hd, r.trang, r.dong, r.ten_gd, r.loai_gd, r.noi_bo
      from bank_row r
      join bank_import i on i.id = r.import_id and i.dang_dung
     order by r.ngay, r.id`);

  const dotAll = await q<DotRow & { so_tien: string }>(`
    select source_id, tai_khoan, ngay_thu::text as ngay_thu, so_tien::text,
           ma_hd, ky, dia_chi, trang_thai_dot, trang_thai_phieu
      from v_fixed_dot_thu
     order by ngay_thu, source_id`);

  const gds: GdRow[] = gdAll.map((r) => ({
    ...r, id: Number(r.id), tien_vao: num(r.tien_vao),
  }));
  const dots: DotRow[] = dotAll.map((r) => ({ ...r, so_tien: num(r.so_tien) }));

  // Chuyển khoản nội bộ là tiền công ty tự chuyển, không phải khách trả — để
  // ngoài phép ghép, nhưng vẫn liệt kê cho đủ dòng của sao kê.
  const gdKhach = gds.filter((g) => !g.noi_bo);
  const kq = ghep(gdKhach, dots);

  const capTheoGd = new Map(kq.cap.map((c) => [c.gd.id, c]));
  const dotTheoId = new Map(dots.map((d) => [d.source_id, d]));

  const thang = await q<Thang>(`
    select thang, tai_khoan, so_gd::text, tien_tho::text, noi_bo::text,
           tien_khach::text, so_dot_pm::text, tien_pm::text, chenh::text
      from v_sao_ke_thang order by thang, tai_khoan`);

  const wb = new ExcelJS.Workbook();

  // ── Trang 1: theo tháng và tài khoản ──────────────────────────────────────
  const ws1 = wb.addWorksheet("Theo tháng và tài khoản", { views: [{ state: "frozen", ySplit: 1 }] });
  ws1.columns = [
    { header: "Tháng", key: "thang", width: 10 },
    { header: "Tài khoản", key: "tai_khoan", width: 20 },
    { header: "Số GD", key: "so_gd", width: 8 },
    { header: "Sao kê · thô", key: "tien_tho", width: 14, style: { numFmt: TIEN } },
    { header: "Chuyển khoản nội bộ", key: "noi_bo", width: 19, style: { numFmt: TIEN } },
    { header: "Sao kê · tiền khách", key: "tien_khach", width: 18, style: { numFmt: TIEN } },
    { header: "Phần mềm · số đợt", key: "so_dot_pm", width: 17 },
    { header: "Phần mềm · tiền", key: "tien_pm", width: 16, style: { numFmt: TIEN } },
    { header: "Chênh", key: "chenh", width: 14, style: { numFmt: TIEN } },
  ];
  ws1.getRow(1).font = { bold: true };
  for (const r of thang) {
    const h = ws1.addRow({
      thang: r.thang,
      tai_khoan: r.tai_khoan === "CHUA_GHI" ? "(chưa ghi tài khoản)" : r.tai_khoan,
      so_gd: num(r.so_gd), tien_tho: num(r.tien_tho), noi_bo: num(r.noi_bo),
      tien_khach: num(r.tien_khach), so_dot_pm: num(r.so_dot_pm),
      tien_pm: num(r.tien_pm), chenh: num(r.chenh),
    });
    if (num(r.chenh) !== 0) {
      h.getCell("chenh").font = { bold: true, color: { argb: "FFC00000" } };
      h.getCell("chenh").fill = { type: "pattern", pattern: "solid", fgColor: { argb: DO } };
    }
  }
  ws1.autoFilter = { from: "A1", to: { row: 1, column: 9 } };

  // ── Trang 2: từng giao dịch sao kê ────────────────────────────────────────
  const ws2 = wb.addWorksheet("Từng giao dịch", { views: [{ state: "frozen", ySplit: 1 }] });
  ws2.columns = [
    { header: "Ngày", key: "ngay", width: 12 },
    { header: "Tài khoản", key: "tai_khoan", width: 17 },
    { header: "Số tiền", key: "tien_vao", width: 12, style: { numFmt: TIEN } },
    { header: "Loại GD", key: "loai_gd", width: 10 },
    { header: "Người chuyển", key: "ten_gd", width: 26 },
    { header: "Mã HĐ trên sao kê", key: "ma_hd_sk", width: 17 },
    { header: "Trang", key: "trang", width: 18 },
    { header: "Dòng", key: "dong", width: 7 },
    { header: "Kết quả đối soát", key: "ket_qua", width: 62 },
    { header: "Mã HĐ phần mềm", key: "ma_hd_pm", width: 17 },
    { header: "Kỳ cước", key: "ky", width: 22 },
    { header: "Số kỳ gộp", key: "so_ky", width: 10 },
    { header: "Ngày thu phần mềm", key: "ngay_thu", width: 18 },
    { header: "Lệch ngày", key: "lech_ngay", width: 11 },
    { header: "Tài khoản phần mềm", key: "tk_pm", width: 19 },
    { header: "Trạng thái đợt", key: "trang_thai_dot", width: 18 },
    { header: "Trạng thái phiếu cha", key: "trang_thai_phieu", width: 20 },
    { header: "ID đợt", key: "source_id", width: 38 },
  ];
  ws2.getRow(1).font = { bold: true };

  for (const g of gds) {
    const c = capTheoGd.get(g.id);
    // Một lần nộp có thể gồm nhiều kỳ; lấy đợt đầu làm đại diện cho các cột
    // chung và gộp danh sách kỳ vào một ô.
    const ds = c ? c.khoan.dot.map((x) => dotTheoId.get(x.source_id)!) : [];
    const d = ds[0];
    const mau = g.noi_bo ? XAM : c ? BAC_TEN[c.bac]!.mau : DO;
    const ketQua = g.noi_bo
      ? "Chuyển khoản nội bộ — tiền công ty tự chuyển, không phải khách trả"
      : c
        ? BAC_TEN[c.bac]!.ten
        : "Không tìm được đợt thu nào bên phần mềm";
    const h = ws2.addRow({
      ngay: g.ngay, tai_khoan: g.tai_khoan, tien_vao: g.tien_vao,
      loai_gd: g.loai_gd, ten_gd: g.ten_gd, ma_hd_sk: g.ma_hd,
      trang: g.trang, dong: g.dong, ket_qua: ketQua,
      ma_hd_pm: d?.ma_hd ?? null,
      ky: ds.map((x) => x.ky).join(", ") || null,
      so_ky: ds.length || null,
      ngay_thu: d?.ngay_thu ?? null,
      lech_ngay: c && Number.isFinite(c.lech_ngay) ? c.lech_ngay : null,
      tk_pm: d?.tai_khoan === "CHUA_GHI" ? "(chưa ghi tài khoản)" : d?.tai_khoan ?? null,
      trang_thai_dot: d?.trang_thai_dot ?? null,
      trang_thai_phieu: d?.trang_thai_phieu ?? null,
      source_id: ds.map((x) => x.source_id).join(", ") || null,
    });
    for (let i = 1; i <= 18; i++)
      h.getCell(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: mau } };
    // Ghép được mà tài khoản hai bên khác nhau thì phải nhìn kỹ.
    if (d && d.tai_khoan !== g.tai_khoan)
      h.getCell("tk_pm").font = { bold: true, color: { argb: "FFC00000" } };
  }
  ws2.autoFilter = { from: "A1", to: { row: 1, column: 18 } };

  // ── Trang 3: đợt phần mềm không có giao dịch sao kê ───────────────────────
  const ws3 = wb.addWorksheet("Đợt phần mềm chưa ghép", { views: [{ state: "frozen", ySplit: 1 }] });
  ws3.columns = [
    { header: "Mã hợp đồng", key: "ma_hd", width: 15 },
    { header: "Địa chỉ lắp", key: "dia_chi", width: 46 },
    { header: "Kỳ cước", key: "ky", width: 10 },
    { header: "Ngày thu", key: "ngay_thu", width: 12 },
    { header: "Số tiền", key: "so_tien", width: 11, style: { numFmt: TIEN } },
    { header: "Tài khoản", key: "tai_khoan", width: 22 },
    { header: "Trạng thái đợt", key: "trang_thai_dot", width: 18 },
    { header: "Trạng thái phiếu cha", key: "trang_thai_phieu", width: 20 },
    { header: "ID đợt", key: "source_id", width: 38 },
  ];
  ws3.getRow(1).font = { bold: true };
  const leTheoTien = [...kq.dot_le].sort((a, b) => b.so_tien - a.so_tien);
  for (const d of leTheoTien) {
    const r = dotTheoId.get(d.source_id)!;
    ws3.addRow({
      ...r,
      tai_khoan: r.tai_khoan === "CHUA_GHI" ? "(chưa ghi tài khoản)" : r.tai_khoan,
    });
  }
  ws3.autoFilter = { from: "A1", to: { row: 1, column: 9 } };

  // ── Trang 4: ghi chú ──────────────────────────────────────────────────────
  const ws4 = wb.addWorksheet("Ghi chú");
  ws4.columns = [{ width: 30 }, { width: 100 }];
  ws4.getRow(1).font = { bold: true };
  const capGop = kq.cap.filter((c) => c.khoan.dot.length > 1);
  const tienCap = kq.cap.reduce((t, c) => t + c.gd.tien_vao, 0);
  const tienGdLe = kq.gd_le.reduce((t, g) => t + g.tien_vao, 0);
  const tienDotLe = kq.dot_le.reduce((t, d) => t + d.so_tien, 0);
  const t = (n: number) => n.toLocaleString("vi-VN");
  for (const [a, b] of [
    ["Mục", "Nội dung"],
    ["Nguồn sao kê", "data/bill/Sao kê cố định.xlsx — 3 trang: Yucho Thương, Yucho Arai cố định, GMO"],
    ["Nguồn phần mềm", "v_fixed_dot_thu — đợt thu wifi cố định, toàn bộ lịch sử"],
    ["Chốt lúc", new Date().toLocaleString("vi-VN")],
    ["", ""],
    ["Giao dịch sao kê", `${gds.length} dòng · ${t(gds.reduce((s, g) => s + g.tien_vao, 0))}`],
    ["  trong đó nội bộ", `${gds.length - gdKhach.length} dòng · ${t(gds.reduce((s, g) => s + (g.noi_bo ? g.tien_vao : 0), 0))}`],
    ["Ghép được", `${kq.cap.length} cặp · ${t(tienCap)}`],
    ["  trong đó khách nộp gộp",
     `${capGop.length} giao dịch gom ${capGop.reduce((s2, c) => s2 + c.khoan.dot.length, 0)} kỳ · ${t(capGop.reduce((s2, c) => s2 + c.gd.tien_vao, 0))}`],
    ["GD sao kê chưa ghép", `${kq.gd_le.length} dòng · ${t(tienGdLe)}`],
    ["Đợt phần mềm chưa ghép", `${kq.dot_le.length} đợt · ${t(tienDotLe)}`],
    ["", ""],
    ["Vì sao sao kê nhiều tiền hơn",
     "Ba tài khoản này còn nhận cả tiền ngoài cước wifi cố định, nên giao dịch không ghép được là bình thường, không mặc nhiên là lỗi."],
    ["Quy tắc ghép",
     "Đơn vị bên phần mềm là LẦN THU (các đợt cùng hợp đồng, cùng ngày thu), vì khách hay đóng gộp mấy kỳ một lần. Một giao dịch ghép đúng một lần thu, một đợt chỉ nằm trong một cặp. Ghép theo bậc: mã HĐ + tiền + tài khoản + ngày ≤ 5, rồi nới dần."],
    ["Màu", "Xanh: khớp chắc · Vàng: khớp mã HĐ nhưng lệch tài khoản hoặc ngày · Tím: chỉ khớp tiền và ngày · Đỏ: không ghép được · Xám: nội bộ"],
  ]) ws4.addRow([a, b]);
  ws4.getRow(1).font = { bold: true };
  ws4.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: XAM } };

  const ra = process.argv[2] ?? banKeTiep("../data", "doi-soat-sao-ke-tung-giao-dich");
  await wb.xlsx.writeFile(ra);

  console.log(`Đã ghi ${ra}`);
  console.log(`  giao dịch sao kê   ${String(gds.length).padStart(5)} dòng · ${t(gds.reduce((s, g) => s + g.tien_vao, 0)).padStart(11)}`);
  console.log(`  ghép được          ${String(kq.cap.length).padStart(5)} cặp  · ${t(tienCap).padStart(11)}`);
  console.log(`    khách nộp gộp    ${String(capGop.length).padStart(5)} GD gom ${capGop.reduce((s2, c) => s2 + c.khoan.dot.length, 0)} kỳ · ${t(capGop.reduce((s2, c) => s2 + c.gd.tien_vao, 0))}`);
  for (const b of [1, 2, 3, 4]) {
    const c = kq.cap.filter((x) => x.bac === b);
    if (c.length === 0) continue;
    console.log(`    bậc ${b}            ${String(c.length).padStart(5)} cặp  · ${t(c.reduce((s, x) => s + x.gd.tien_vao, 0)).padStart(11)}  ${BAC_TEN[b]!.ten}`);
  }
  console.log(`  GD sao kê chưa ghép${String(kq.gd_le.length).padStart(5)} dòng · ${t(tienGdLe).padStart(11)}`);
  console.log(`  đợt PM chưa ghép   ${String(kq.dot_le.length).padStart(5)} đợt  · ${t(tienDotLe).padStart(11)}`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
