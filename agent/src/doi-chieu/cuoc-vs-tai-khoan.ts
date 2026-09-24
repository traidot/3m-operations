import ExcelJS from "exceljs";
import { pool, q } from "../db.js";
import { MAU, TIEN, datFont, dauTrang, gio } from "../excel.js";
import { banKeTiep } from "../ten-file.js";

/**
 * Đối chiếu hai báo cáo của CMS trên TOÀN BỘ lịch sử, không cắt mốc tháng:
 *
 *   (2) Báo cáo thống kê cước phí  /report/fee-payment
 *   (3) Báo cáo tài khoản thu      /report/collection-account
 *
 *   npm run doi-chieu:cuoc-tk
 *
 * Hai báo cáo cùng đọc một bảng đợt thu nhưng lọc khác nhau, nên lệch mà không
 * ai sai:
 *   - (2) tính cả đợt chưa ghi tài khoản, (3) loại thẳng.
 *   - (3) tính cả đợt mà phiếu cha còn chờ duyệt, (2) loại.
 * Đúng hai nguyên nhân đó, không có nguyên nhân thứ ba — kiểm bằng bảng chéo
 * `vao_bao_cao_cuoc` × `vao_bao_cao_tai_khoan` trong v_fixed_dot_thu.
 */

const { xam: XAM, do: DO, vang: VANG, tim: TIM } = MAU;

type Nhom = {
  ma: string;
  /** Nhãn ngắn để lọc trong Excel — đúng chữ người vận hành dùng. */
  trang_thai: string;
  ten: string;
  bao_cao: string;
  mau: string;
  viec: string;
  loc: string;   // mệnh đề where
};

/**
 * Ba nhóm rời nhau, cộng lại đúng bằng số đợt không nằm trong phần chung của
 * hai báo cáo.
 */
const NHOM: Nhom[] = [
  {
    ma: "chua-ghi-tk", mau: DO,
    trang_thai: "CHƯA GHI KHOẢN THU",
    ten: "Đợt đã duyệt nhưng chưa chọn tài khoản nhận tiền",
    bao_cao: "Chỉ (2) cước phí tính · (3) tài khoản thu loại",
    viec: "Mở đợt trên CMS, chọn tài khoản đã thực nhận tiền",
    loc: "vao_bao_cao_cuoc and not vao_bao_cao_tai_khoan",
  },
  {
    ma: "phieu-cha-cho-duyet", mau: VANG,
    trang_thai: "CHƯA APPROVE · phiếu cha",
    ten: "Đợt đã duyệt nhưng phiếu cha còn chờ duyệt",
    bao_cao: "Chỉ (3) tài khoản thu tính · (2) cước phí loại",
    viec: "Duyệt phiếu cha; soát số tiền lẻ trước khi duyệt",
    loc: "vao_bao_cao_tai_khoan and not vao_bao_cao_cuoc",
  },
  {
    ma: "dot-chua-duyet", mau: TIM,
    trang_thai: "CHƯA APPROVE · cả đợt lẫn phiếu cha",
    ten: "Cả đợt lẫn phiếu cha đều còn chờ duyệt",
    bao_cao: "Không báo cáo nào tính",
    viec: "Duyệt cả đợt lẫn phiếu cha, hoặc xoá nếu thu nhầm",
    loc: "not vao_bao_cao_cuoc and not vao_bao_cao_tai_khoan",
  },
];

type Dong = {
  nhom: string; ma_hd: string | null; dia_chi: string | null; ky: string;
  thang_tien_ve: string; ngay_thu: string | null; so_tien: string;
  tai_khoan: string; trang_thai_dot: string | null;
  trang_thai_phieu: string | null; source_id: string;
};

type TheoTk = {
  tai_khoan: string;
  duyet_dot: string; duyet_tien: string;
  cho_dot: string; cho_tien: string;
  cuoc: string; tk: string;
};

const n = (v: string | null) => (v === null ? null : Number(v));

async function main() {
  const [dongBo] = await q<{ luc: string }>(
    `select max(finished_at)::text as luc from sync_run where source = 'FIXED' and status = 'OK'`);

  const [tong] = await q<{
    cuoc_dot: string; cuoc: string; tk_dot: string; tk: string;
    duyet_dot: string; duyet: string; cho_dot: string; cho: string;
    moi_dot: string; moi: string;
  }>(`
    select count(*) filter (where vao_bao_cao_cuoc)::text            as cuoc_dot,
           coalesce(sum(so_tien) filter (where vao_bao_cao_cuoc),0)::text as cuoc,
           count(*) filter (where vao_bao_cao_tai_khoan)::text       as tk_dot,
           coalesce(sum(so_tien) filter (where vao_bao_cao_tai_khoan),0)::text as tk,
           count(*) filter (where not cho_duyet)::text               as duyet_dot,
           coalesce(sum(so_tien) filter (where not cho_duyet),0)::text as duyet,
           count(*) filter (where cho_duyet)::text                   as cho_dot,
           coalesce(sum(so_tien) filter (where cho_duyet),0)::text   as cho,
           count(*)::text as moi_dot, coalesce(sum(so_tien),0)::text as moi
      from v_fixed_dot_thu`);

  const theoNhom = await q<{ ma: string; so: string; tien: string }>(
    NHOM.map((g) => `select '${g.ma}' as ma, count(*)::text as so,
                            coalesce(sum(so_tien),0)::text as tien
                       from v_fixed_dot_thu where ${g.loc}`).join(" union all "));

  const theoTk = await q<TheoTk>(`
    select tai_khoan,
           count(*) filter (where not cho_duyet)::text as duyet_dot,
           coalesce(sum(so_tien) filter (where not cho_duyet),0)::text as duyet_tien,
           count(*) filter (where cho_duyet)::text as cho_dot,
           coalesce(sum(so_tien) filter (where cho_duyet),0)::text as cho_tien,
           coalesce(sum(so_tien) filter (where vao_bao_cao_cuoc),0)::text as cuoc,
           coalesce(sum(so_tien) filter (where vao_bao_cao_tai_khoan),0)::text as tk
      from v_fixed_dot_thu group by 1 order by 6 desc`);

  const chiTiet = await q<Dong>(`
    select nhom, ma_hd, dia_chi, ky, thang_tien_ve, ngay_thu::text as ngay_thu,
           so_tien::text, tai_khoan, trang_thai_dot, trang_thai_phieu, source_id
      from (${NHOM.map((g) => `
        select '${g.ma}' as nhom, ${NHOM.indexOf(g)} as thu_tu, *
          from v_fixed_dot_thu where ${g.loc}`).join(" union all ")}) x
     order by thu_tu, so_tien desc`);

  const wb = new ExcelJS.Workbook();

  // ── Trang 1: so sánh ──────────────────────────────────────────────────────
  const ws = wb.addWorksheet("So sánh");
  ws.columns = [{ width: 52 }, { width: 12 }, { width: 16 }, { width: 16 }, { width: 58 }];
  let d = 0;
  const dong = (
    v: (string | number | null)[],
    dang?: "tieu-de" | "muc" | "dam" | "phu",
    mau?: string,
  ) => {
    const h = ws.getRow(++d);
    v.forEach((x, i) => { if (x !== null) h.getCell(i + 1).value = x; });
    for (let i = 3; i <= 4; i++) h.getCell(i).numFmt = TIEN;
    if (dang === "tieu-de") h.font = { bold: true, size: 14 };
    if (dang === "muc") {
      h.font = { bold: true, size: 11 };
      h.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: XAM } };
    }
    if (dang === "dam") h.font = { bold: true };
    if (dang === "phu") h.font = { color: { argb: "FF888888" }, italic: true };
    if (mau)
      for (let i = 1; i <= 5; i++)
        h.getCell(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: mau } };
    return h;
  };

  const chenh = Number(tong!.cuoc) - Number(tong!.tk);
  dong(["Đối chiếu báo cáo cước phí và báo cáo tài khoản thu"], "tieu-de");
  dong([
    "Wifi cố định · toàn bộ lịch sử, không cắt mốc tháng · nguồn: kho 3m_warehouse " +
    `(v_fixed_dot_thu), đồng bộ từ CMS lúc ${gio(dongBo?.luc ?? null)} · chốt lúc ${new Date().toLocaleString("vi-VN")}`,
  ], "phu");
  d++;

  dong(["1 · Hai con số theo phê duyệt"], "muc");
  dong(["Nhóm", "Số đợt", "Số tiền", null, "Ghi chú"], "dam");
  dong(["Đã phê duyệt", Number(tong!.duyet_dot), Number(tong!.duyet), null,
        "Đợt duyệt và phiếu cha duyệt — đúng bằng báo cáo cước phí"]);
  dong(["Chưa phê duyệt", Number(tong!.cho_dot), Number(tong!.cho), null,
        "Đợt hoặc phiếu cha còn chờ duyệt"], undefined, VANG);
  dong(["Tổng mọi đợt trong kho", Number(tong!.moi_dot), Number(tong!.moi)], "dam");
  d++;

  dong(["2 · Hai báo cáo của CMS"], "muc");
  dong(["Báo cáo", "Số đợt", "Số tiền", null, "Lọc gì"], "dam");
  dong(["(2) Báo cáo thống kê cước phí", Number(tong!.cuoc_dot), Number(tong!.cuoc), null,
        "Bỏ đợt/phiếu chưa duyệt · GIỮ đợt chưa ghi tài khoản"]);
  dong(["(3) Báo cáo tài khoản thu", Number(tong!.tk_dot), Number(tong!.tk), null,
        "Bỏ đợt chưa ghi tài khoản · GIỮ đợt phiếu cha chưa duyệt"]);
  const hc = dong(["Chênh (2) − (3)", null, chenh, null,
                   "Không phải sai số — hai báo cáo lọc khác nhau"], "dam");
  hc.getCell(3).font = { bold: true, color: { argb: "FFC00000" } };
  hc.getCell(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: DO } };
  d++;

  dong(["3 · Chênh do đâu"], "muc");
  dong(["Trạng thái", "Số đợt", "Số tiền", "Dấu vào chênh", "Việc cần làm"], "dam");
  for (const g of NHOM) {
    const t = theoNhom.find((x) => x.ma === g.ma)!;
    const dau = g.ma === "chua-ghi-tk" ? Number(t.tien)
              : g.ma === "phieu-cha-cho-duyet" ? -Number(t.tien) : 0;
    dong([`${g.trang_thai} — ${g.ten}`, Number(t.so), Number(t.tien), dau, g.viec], undefined, g.mau);
  }
  dong(["Cộng dấu", null, null, chenh, "Khớp đúng con số chênh ở mục 2"], "dam");
  d++;

  dong(["4 · Sau khi xử lý xong hai nhóm đầu"], "muc");
  dong(["Cả hai báo cáo sẽ cùng bằng", null,
        Number(tong!.cuoc) + Number(theoNhom.find((x) => x.ma === "phieu-cha-cho-duyet")!.tien),
        null, "Gán tài khoản cho nhóm đỏ, duyệt nhóm vàng"], "dam");

  // ── Trang 2: theo tài khoản ───────────────────────────────────────────────
  const ws2 = wb.addWorksheet("Theo tài khoản");
  ws2.columns = [
    { header: "Tài khoản", key: "tai_khoan", width: 24 },
    { header: "Đã duyệt · đợt", key: "duyet_dot", width: 14 },
    { header: "Đã duyệt · tiền", key: "duyet_tien", width: 16, style: { numFmt: TIEN } },
    { header: "Chưa duyệt · đợt", key: "cho_dot", width: 16 },
    { header: "Chưa duyệt · tiền", key: "cho_tien", width: 17, style: { numFmt: TIEN } },
    { header: "(2) Cước phí", key: "cuoc", width: 15, style: { numFmt: TIEN } },
    { header: "(3) Tài khoản thu", key: "tk", width: 17, style: { numFmt: TIEN } },
    { header: "Chênh (2)−(3)", key: "chenh", width: 15, style: { numFmt: TIEN } },
  ];
  for (const r of theoTk) {
    const c = Number(r.cuoc) - Number(r.tk);
    const h = ws2.addRow({
      tai_khoan: r.tai_khoan === "CHUA_GHI" ? "(chưa ghi tài khoản)" : r.tai_khoan,
      duyet_dot: Number(r.duyet_dot), duyet_tien: Number(r.duyet_tien),
      cho_dot: Number(r.cho_dot), cho_tien: Number(r.cho_tien),
      cuoc: Number(r.cuoc), tk: Number(r.tk), chenh: c,
    });
    if (c !== 0) {
      h.getCell("chenh").font = { bold: true, color: { argb: "FFC00000" } };
      h.getCell("chenh").fill = { type: "pattern", pattern: "solid", fgColor: { argb: DO } };
    }
    if (Number(r.cho_tien) > 0)
      h.getCell("cho_tien").fill = { type: "pattern", pattern: "solid", fgColor: { argb: VANG } };
  }
  const tongTk = ws2.addRow({
    tai_khoan: "Tổng",
    duyet_dot: Number(tong!.duyet_dot), duyet_tien: Number(tong!.duyet),
    cho_dot: Number(tong!.cho_dot), cho_tien: Number(tong!.cho),
    cuoc: Number(tong!.cuoc), tk: Number(tong!.tk), chenh,
  });
  tongTk.font = { bold: true };


  // ── Trang 3: danh sách từng đợt lệch ──────────────────────────────────────
  const ws3 = wb.addWorksheet("Danh sách lệch");
  ws3.columns = [
    { header: "Trạng thái", key: "trang_thai", width: 30 },
    { header: "Báo cáo nào tính", key: "bao_cao", width: 38 },
    { header: "Diễn giải", key: "nhom", width: 44 },
    { header: "Mã hợp đồng", key: "ma_hd", width: 15 },
    { header: "Địa chỉ lắp", key: "dia_chi", width: 46 },
    { header: "Kỳ cước", key: "ky", width: 10 },
    { header: "Tháng tiền về", key: "thang_tien_ve", width: 14 },
    { header: "Ngày thu", key: "ngay_thu", width: 12 },
    { header: "Số tiền", key: "so_tien", width: 11, style: { numFmt: TIEN } },
    { header: "Tài khoản", key: "tai_khoan", width: 22 },
    { header: "Trạng thái đợt", key: "trang_thai_dot", width: 18 },
    { header: "Trạng thái phiếu cha", key: "trang_thai_phieu", width: 20 },
    { header: "ID đợt", key: "source_id", width: 38 },
  ];
  for (const r of chiTiet) {
    const g = NHOM.find((x) => x.ma === r.nhom)!;
    const h = ws3.addRow({
      ...r, trang_thai: g.trang_thai, bao_cao: g.bao_cao, nhom: g.ten,
      so_tien: n(r.so_tien),
      tai_khoan: r.tai_khoan === "CHUA_GHI" ? "(chưa ghi tài khoản)" : r.tai_khoan,
    });
    for (let i = 1; i <= 13; i++)
      h.getCell(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: g.mau } };
  }

  const moc =
    "Nguồn: kho 3m_warehouse, view v_fixed_dot_thu — đợt thu wifi cố định đồng bộ từ CMS " +
    `(MySQL wifi-api) lúc ${gio(dongBo?.luc ?? null)}. Toàn bộ lịch sử, không cắt mốc tháng. ` +
    `File chốt lúc ${new Date().toLocaleString("vi-VN")}.`;
  dauTrang(ws2, "Đối chiếu hai báo cáo CMS — theo tài khoản", moc, 8);
  dauTrang(ws3, "Danh sách từng đợt làm hai báo cáo lệch nhau", moc, 13);

  datFont(wb, "Consolas");

  const ra = process.argv[2] ?? banKeTiep("../data", "doi-chieu-cuoc-vs-tai-khoan");
  await wb.xlsx.writeFile(ra);

  const t = (s: string | number) => Number(s).toLocaleString("vi-VN");
  console.log(`Đã ghi ${ra}`);
  console.log(`  đã phê duyệt   ${t(tong!.duyet).padStart(11)} · ${tong!.duyet_dot} đợt`);
  console.log(`  chưa phê duyệt ${t(tong!.cho).padStart(11)} · ${tong!.cho_dot} đợt`);
  console.log(`  (2) cước phí   ${t(tong!.cuoc).padStart(11)} · (3) tài khoản thu ${t(tong!.tk)} · chênh ${t(chenh)}`);
  for (const g of NHOM) {
    const x = theoNhom.find((y) => y.ma === g.ma)!;
    console.log(`  ${g.ten.padEnd(58)} ${x.so.padStart(4)} đợt · ${t(x.tien).padStart(9)}`);
  }
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
