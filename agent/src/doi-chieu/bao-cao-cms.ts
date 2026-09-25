import ExcelJS from "exceljs";
import { pool, q } from "../db.js";
import { MAU, NEN_NHOM, TIEN, datFont, dauTrang, gio } from "../excel.js";
import { banKeTiep } from "../ten-file.js";

/**
 * Dựng lại hai báo cáo của CMS từ kho, theo đúng bố cục màn hình, để đặt cạnh
 * nhau mà soi xem tiền lệch ở đâu.
 *
 *   npm run bao-cao:cms -- --nam=2026
 *
 *   (2) report/fee-payment        — Báo cáo thống kê cước phí
 *   (3) report/collection-account — Báo cáo tài khoản thu
 *
 * Phần dựng được và đã đối chiếu khớp từng đồng với màn hình: cột tiền theo
 * tài khoản của (3), và cột "Tổng đã thu" của (2).
 *
 * Phần KHÔNG dựng: "Tổng phải thu", "Tổng chưa thu", "Không thu được" của (2).
 * Hai cách thử đều lệch xa (tháng 1: kho ra 111.300 trong khi màn hình 65.700)
 * vì bên đó còn chia theo ngày trong tháng và loại hợp đồng theo nhiều mốc
 * khác. Thà để trống còn hơn đưa số sai vào bảng đối chiếu.
 */

const TAI_KHOAN = [
  "SBI", "youcho thuong", "Youcho Arai", "Arai cầm tay",
  "Combini 3M", "cần trừ cọc", "Khác", "CHUA_GHI",
] as const;

const NHAN: Record<string, string> = { CHUA_GHI: "Chưa gán tài khoản" };

const co = (ten: string) =>
  process.argv.find((a) => a.startsWith(`--${ten}=`))?.split("=")[1];

const n = (v: unknown) => Number(v ?? 0);

async function main() {
  const nam = co("nam") ?? String(new Date().getFullYear());
  const thang = Array.from({ length: 12 }, (_, i) => `${nam}-${String(i + 1).padStart(2, "0")}`);

  const [dongBo] = await q<{ luc: string }>(
    `select max(finished_at)::text as luc from sync_run where source = 'FIXED' and status = 'OK'`);

  // (3) Báo cáo tài khoản thu: gom theo THÁNG TIỀN VỀ và tài khoản.
  const tk = await q<{ thang: string; tai_khoan: string; tien: string; so_dot: string }>(`
    select thang_tien_ve as thang, tai_khoan,
           sum(so_tien)::text as tien, count(*)::text as so_dot
      from v_fixed_dot_thu
     where vao_bao_cao_tai_khoan and thang_tien_ve like $1
     group by 1, 2`, [`${nam}-%`]);
  const oTk = new Map(tk.map((r) => [`${r.thang}|${r.tai_khoan}`, r]));

  // (2) Báo cáo cước phí: cột "Tổng đã thu", gom theo KỲ CƯỚC.
  const cuoc = await q<{ ky: string; so_hd: string; da_thu: string }>(`
    select ky, count(distinct contract_id)::text as so_hd, sum(da_thu)::text as da_thu
      from v_fixed_da_thu_cuoc where ky like $1 group by 1`, [`${nam}-%`]);
  const oCuoc = new Map(cuoc.map((r) => [r.ky, r]));

  const wb = new ExcelJS.Workbook();
  const moc =
    `Dựng từ kho 3m_warehouse, đồng bộ từ CMS lúc ${gio(dongBo?.luc ?? null)}. ` +
    `Năm ${nam}. File xuất lúc ${new Date().toLocaleString("vi-VN")}.`;

  // ── Trang 1: báo cáo tài khoản thu ────────────────────────────────────────
  const ws1 = wb.addWorksheet("(3) Tài khoản thu");
  ws1.columns = [
    { header: "Tháng", key: "thang", width: 12 },
    ...TAI_KHOAN.map((t) => ({
      header: NHAN[t] ?? t, key: t, width: 18, style: { numFmt: TIEN },
    })),
    { header: "TỔNG", key: "tong", width: 18, style: { numFmt: TIEN } },
  ];
  const congTk = (t: string) =>
    thang.reduce((s, th) => s + n(oTk.get(`${th}|${t}`)?.tien), 0);
  const hTongTk = ws1.addRow({
    thang: "TỔNG",
    ...Object.fromEntries(TAI_KHOAN.map((t) => [t, congTk(t)])),
    tong: TAI_KHOAN.reduce((s, t) => s + congTk(t), 0),
  });
  hTongTk.font = { bold: true };
  for (const th of thang) {
    const d = Object.fromEntries(TAI_KHOAN.map((t) => [t, n(oTk.get(`${th}|${t}`)?.tien)]));
    ws1.addRow({
      thang: th,
      ...d,
      tong: TAI_KHOAN.reduce((s, t) => s + n(d[t]), 0),
    });
  }
  dauTrang(ws1, `Báo cáo tài khoản thu — năm ${nam} (report/collection-account)`, moc, 10, [
    { ten: "", tu: 1, den: 1, mau: "FFFFFFFF" },
    { ten: "TIỀN THU THEO TỪNG TÀI KHOẢN", tu: 2, den: 9, mau: NEN_NHOM.phanMem },
    { ten: "", tu: 10, den: 10, mau: NEN_NHOM.chenh },
  ]);
  for (let c = 1; c <= 10; c++)
    ws1.getCell(4, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: MAU.xam } };

  // ── Trang 2: báo cáo cước phí ─────────────────────────────────────────────
  const ws2 = wb.addWorksheet("(2) Cước phí");
  ws2.columns = [
    { header: "Kỳ cước", key: "ky", width: 12 },
    { header: "Số hợp đồng đã thu", key: "so_hd", width: 20 },
    { header: "Tổng đã thu", key: "da_thu", width: 18, style: { numFmt: TIEN } },
    { header: "Tổng phải thu", key: "phai_thu", width: 18 },
    { header: "Tổng chưa thu", key: "chua_thu", width: 18 },
  ];
  const hTongC = ws2.addRow({
    ky: "TỔNG",
    so_hd: null,
    da_thu: cuoc.reduce((s, r) => s + n(r.da_thu), 0),
    phai_thu: "chưa dựng",
    chua_thu: "chưa dựng",
  });
  hTongC.font = { bold: true };
  for (const k of thang) {
    const r = oCuoc.get(k);
    ws2.addRow({
      ky: k, so_hd: n(r?.so_hd), da_thu: n(r?.da_thu),
      phai_thu: "chưa dựng", chua_thu: "chưa dựng",
    });
  }
  ws2.getColumn("phai_thu").font = { color: { argb: "FF999999" }, italic: true };
  ws2.getColumn("chua_thu").font = { color: { argb: "FF999999" }, italic: true };
  dauTrang(ws2, `Báo cáo thống kê cước phí — năm ${nam} (report/fee-payment)`, moc, 5, [
    { ten: "", tu: 1, den: 1, mau: "FFFFFFFF" },
    { ten: "DỰNG ĐƯỢC, ĐÃ ĐỐI CHIẾU KHỚP", tu: 2, den: 3, mau: NEN_NHOM.phanMem },
    { ten: "CHƯA DỰNG ĐƯỢC", tu: 4, den: 5, mau: NEN_NHOM.chenh },
  ]);
  for (let c = 1; c <= 5; c++)
    ws2.getCell(4, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: MAU.xam } };

  // ── Trang 3: chi tiết từng đợt ────────────────────────────────────────────
  const ct = await q<Record<string, string | null>>(`
    select ma_hd, dia_chi, ky, thang_tien_ve, ngay_thu::text as ngay_thu,
           so_tien::text, tai_khoan, trang_thai_dot, trang_thai_phieu,
           vao_bao_cao_cuoc::text, vao_bao_cao_tai_khoan::text,
           tu_phieu_cha::text, source_id
      from v_fixed_dot_thu
     where thang_tien_ve like $1 or ky like $1
     order by thang_tien_ve, ngay_thu, ma_hd`, [`${nam}-%`]);
  const ws3 = wb.addWorksheet("Chi tiết từng đợt");
  ws3.columns = [
    { header: "Mã hợp đồng", key: "ma_hd", width: 15 },
    { header: "Địa chỉ lắp", key: "dia_chi", width: 40 },
    { header: "Kỳ cước", key: "ky", width: 10 },
    { header: "Tháng tiền về", key: "thang_tien_ve", width: 14 },
    { header: "Ngày thu", key: "ngay_thu", width: 12 },
    { header: "Số tiền", key: "so_tien", width: 11, style: { numFmt: TIEN } },
    { header: "Tài khoản", key: "tai_khoan", width: 20 },
    { header: "Trạng thái đợt", key: "trang_thai_dot", width: 18 },
    { header: "Trạng thái phiếu cha", key: "trang_thai_phieu", width: 20 },
    { header: "Vào báo cáo cước phí", key: "vao_bao_cao_cuoc", width: 20 },
    { header: "Vào báo cáo khoản thu", key: "vao_bao_cao_tai_khoan", width: 21 },
    { header: "Từ phiếu cha (không có đợt)", key: "tu_phieu_cha", width: 26 },
    { header: "ID", key: "source_id", width: 38 },
  ];
  for (const r of ct)
    ws3.addRow({
      ...r,
      so_tien: n(r.so_tien),
      tai_khoan: NHAN[r.tai_khoan ?? ""] ?? r.tai_khoan,
      vao_bao_cao_cuoc: r.vao_bao_cao_cuoc === "true" ? "có" : "không",
      vao_bao_cao_tai_khoan: r.vao_bao_cao_tai_khoan === "true" ? "có" : "không",
      tu_phieu_cha: r.tu_phieu_cha === "true" ? "có" : "",
    });
  dauTrang(ws3, `Chi tiết từng đợt — năm ${nam}`, moc, 13);

  // ── Trang 4: ghi chú ──────────────────────────────────────────────────────
  const ws4 = wb.addWorksheet("Ghi chú");
  ws4.columns = [{ width: 34 }, { width: 110 }];
  for (const [a, b] of [
    ["Mục", "Nội dung"],
    ["Nguồn", `Kho 3m_warehouse, đồng bộ từ CMS (MySQL wifi-api) lúc ${gio(dongBo?.luc ?? null)}`],
    ["", ""],
    ["(3) Tài khoản thu",
     "Bộ lọc: không miễn phí, ĐỢT đã duyệt (hoặc phiếu cha tuỳ chỉnh số tiền), tiền > 0. Gom theo THÁNG TIỀN VỀ. Đợt chưa gán tài khoản vẫn tính, đổ vào cột Chưa gán tài khoản — bản CMS mới đã bỏ điều kiện loại chúng. Có cộng cả phiếu tất toán tay không sinh đợt nào."],
    ["(2) Cước phí · Tổng đã thu",
     "Σ theo (hợp đồng, kỳ) của min(tiền đợt đã duyệt, cước tháng). Cap theo cước tháng, trừ khi phiếu là tuỳ chỉnh số tiền hoặc hợp đồng không có cước. Gom theo KỲ CƯỚC."],
    ["(2) Cước phí · phải thu / chưa thu",
     "CHƯA DỰNG. Thử hai cách đều lệch xa màn hình (tháng 1: kho 111.300 so với màn hình 65.700), vì bên đó còn chia theo ngày trong tháng và loại hợp đồng theo nhiều mốc khác. Để trống thay vì đưa số sai."],
    ["", ""],
    ["Vì sao hai báo cáo không bằng nhau",
     "Khác TRỤC (kỳ cước so với ngày tiền về), khác CẤP XÉT DUYỆT (phiếu cha so với đợt con), và khác ĐƠN VỊ ĐO ((2) cap theo cước tháng nên không đo tiền thực nhận, (3) đo tiền thật về tài khoản)."],
  ]) ws4.addRow([a, b]);
  ws4.getRow(1).font = { bold: true };
  ws4.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: MAU.xam } };

  datFont(wb, "Consolas");
  const ra = co("ra") ?? banKeTiep("../data", `bao-cao-cms-${nam}`);
  await wb.xlsx.writeFile(ra);

  const t = (x: number) => x.toLocaleString("vi-VN");
  console.log(`Đã ghi ${ra}`);
  console.log(`  (3) tài khoản thu · năm ${nam}: ${t(TAI_KHOAN.reduce((s, x) => s + congTk(x), 0))}`);
  for (const x of TAI_KHOAN) {
    const v = congTk(x);
    if (v !== 0) console.log(`      ${(NHAN[x] ?? x).padEnd(22)} ${t(v).padStart(11)}`);
  }
  console.log(`  (2) cước phí · đã thu năm ${nam}: ${t(cuoc.reduce((s, r) => s + n(r.da_thu), 0))}`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
