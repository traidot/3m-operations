import ExcelJS from "exceljs";
import { pool, q } from "../db.js";
import { MAU, TIEN, dauTrang, gio } from "../excel.js";
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

const { xam: XAM, xanh: XANH, vang: VANG, tim: TIM, do: DO } = MAU;

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

  const [nguon] = await q<{ ten_file: string; sua_luc: string; nhap_luc: string; dong_bo: string }>(`
    select i.ten_file, i.sua_luc::text, i.nhap_luc::text,
           (select max(finished_at)::text from sync_run
             where source = 'FIXED' and status = 'OK') as dong_bo
      from bank_import i where i.dang_dung`);

  const thang = await q<Thang>(`
    select thang, tai_khoan, so_gd::text, tien_tho::text, noi_bo::text,
           tien_khach::text, so_dot_pm::text, tien_pm::text, chenh::text
      from v_sao_ke_thang order by thang, tai_khoan`);

  const wb = new ExcelJS.Workbook();

  // ── Trang 1: theo tháng và tài khoản ──────────────────────────────────────
  const ws1 = wb.addWorksheet("Theo tháng và tài khoản");
  ws1.columns = [
    { header: "Tháng", key: "thang", width: 10 },
    { header: "Tài khoản", key: "tai_khoan", width: 20 },
    { header: "SAO KÊ NH · số GD", key: "so_gd", width: 16 },
    { header: "SAO KÊ NH · tiền vào thô", key: "tien_tho", width: 21, style: { numFmt: TIEN } },
    { header: "SAO KÊ NH · chuyển khoản nội bộ", key: "noi_bo", width: 27, style: { numFmt: TIEN } },
    { header: "SAO KÊ NH · tiền khách", key: "tien_khach", width: 20, style: { numFmt: TIEN } },
    { header: "PHẦN MỀM · số đợt", key: "so_dot_pm", width: 17 },
    { header: "PHẦN MỀM · tiền", key: "tien_pm", width: 16, style: { numFmt: TIEN } },
    { header: "Chênh = tiền khách − phần mềm", key: "chenh", width: 26, style: { numFmt: TIEN } },
  ];
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


  // ── Trang 2: từng giao dịch sao kê ────────────────────────────────────────
  const ws2 = wb.addWorksheet("Từng giao dịch");
  ws2.columns = [
    { header: "SAO KÊ NH · ngày", key: "ngay", width: 15 },
    { header: "SAO KÊ NH · tài khoản", key: "tai_khoan", width: 20 },
    { header: "SAO KÊ NH · số tiền", key: "tien_vao", width: 18, style: { numFmt: TIEN } },
    { header: "SAO KÊ NH · loại GD", key: "loai_gd", width: 18 },
    { header: "SAO KÊ NH · người chuyển", key: "ten_gd", width: 26 },
    { header: "SAO KÊ NH · mã HĐ kế toán dò", key: "ma_hd_sk", width: 25 },
    { header: "SAO KÊ NH · trang gốc", key: "trang", width: 20 },
    { header: "SAO KÊ NH · dòng gốc", key: "dong", width: 19 },
    { header: "Kết quả đối soát", key: "ket_qua", width: 62 },
    { header: "PHẦN MỀM · mã HĐ", key: "ma_hd_pm", width: 17 },
    { header: "PHẦN MỀM · kỳ cước", key: "ky", width: 24 },
    { header: "PHẦN MỀM · số kỳ gộp", key: "so_ky", width: 19 },
    { header: "PHẦN MỀM · ngày thu", key: "ngay_thu", width: 19 },
    { header: "Lệch ngày", key: "lech_ngay", width: 11 },
    { header: "PHẦN MỀM · tài khoản", key: "tk_pm", width: 20 },
    { header: "PHẦN MỀM · trạng thái đợt", key: "trang_thai_dot", width: 23 },
    { header: "PHẦN MỀM · trạng thái phiếu cha", key: "trang_thai_phieu", width: 28 },
    { header: "PHẦN MỀM · ID đợt", key: "source_id", width: 38 },
  ];
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


  // ── Trang 3: đợt phần mềm không có giao dịch sao kê ───────────────────────
  const ws3 = wb.addWorksheet("Đợt phần mềm chưa ghép");
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
  const leTheoTien = [...kq.dot_le].sort((a, b) => b.so_tien - a.so_tien);
  for (const d of leTheoTien) {
    const r = dotTheoId.get(d.source_id)!;
    ws3.addRow({
      ...r,
      tai_khoan: r.tai_khoan === "CHUA_GHI" ? "(chưa ghi tài khoản)" : r.tai_khoan,
    });
  }


  const moc =
    `Nguồn 1 — SAO KÊ NGÂN HÀNG: ${nguon?.ten_file ?? "?"} (file sửa ${gio(nguon?.sua_luc ?? null)}, nhập vào kho ${gio(nguon?.nhap_luc ?? null)}). ` +
    `Nguồn 2 — PHẦN MỀM wifi cố định: kho 3m_warehouse, đồng bộ từ CMS lúc ${gio(nguon?.dong_bo ?? null)}. ` +
    `File chốt lúc ${new Date().toLocaleString("vi-VN")}.`;
  dauTrang(ws1, "Sao kê ngân hàng đặt cạnh phần mềm — theo tháng và tài khoản", moc, 9);
  dauTrang(ws2, "Từng giao dịch sao kê, ghép với khoản thu bên phần mềm", moc, 18);
  dauTrang(ws3, "Đợt thu bên phần mềm không tìm được giao dịch nào trên sao kê", moc, 9);

  // ── Trang 4: ghi chú ──────────────────────────────────────────────────────
  const ws4 = wb.addWorksheet("Ghi chú");
  ws4.columns = [{ width: 34 }, { width: 110 }];
  const capGop = kq.cap.filter((c) => c.khoan.dot.length > 1);
  const tienCap = kq.cap.reduce((t, c) => t + c.gd.tien_vao, 0);
  const tienGdLe = kq.gd_le.reduce((t, g) => t + g.tien_vao, 0);
  const tienDotLe = kq.dot_le.reduce((t, d) => t + d.so_tien, 0);
  const t = (n: number) => n.toLocaleString("vi-VN");
  for (const [a, b] of [
    ["Mục", "Nội dung"],
    ["Nguồn 1 · sao kê ngân hàng",
     `${nguon?.ten_file ?? "?"} — 3 trang: Yucho Thương, Yucho Arai cố định, GMO. File sửa ${gio(nguon?.sua_luc ?? null)}, nhập vào kho ${gio(nguon?.nhap_luc ?? null)}.`],
    ["Nguồn 2 · phần mềm wifi cố định",
     `v_fixed_dot_thu trong kho 3m_warehouse — đợt thu toàn bộ lịch sử, đồng bộ từ CMS (MySQL wifi-api) lúc ${gio(nguon?.dong_bo ?? null)}.`],
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
