import ExcelJS from "exceljs";
import { pool, q } from "../db.js";
import { MAU, NEN_NHOM, SO_LE, TIEN, datFont, dauTrang, gio } from "../excel.js";
import { banKeTiep } from "../ten-file.js";
import { ghep, type Dot, type GiaoDich } from "./ghep.js";

/**
 * Đối soát sao kê ngân hàng với phần mềm ở mức TỪNG GIAO DỊCH.
 *
 *   npm run sao-ke:doi-soat
 *   npm run sao-ke:doi-soat -- --tu=2026-01-01 --den=2026-09-30
 *
 * Phép ghép luôn chạy trên TOÀN BỘ dữ liệu rồi mới lọc lúc xuất. Cắt dữ liệu
 * trước khi ghép thì đợt thu cuối tháng 12 khớp giao dịch đầu tháng 1 sẽ thành
 * "chưa ghép" giả ngay ở mép khoảng.
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
  vao_bao_cao_tai_khoan: boolean; can_tru_coc: boolean;
};

type Thang = {
  thang: string; tai_khoan: string; so_gd: string; tien_tho: string;
  noi_bo: string; tien_khach: string; so_dot_pm: string; tien_pm: string;
  chenh: string; so_dot_cms: string; tien_cms: string;
  tien_cho_duyet: string; chenh_cms: string;
  cms_loai_ra: string; cho_duyet_trong_cms: string;
};

const num = (v: unknown) => Number(v);

/** Tổng tiền phần mềm của một tài khoản, để xếp các mục không phải ngân hàng. */
const tienPm = (rows: Thang[], tk: string) =>
  rows.reduce((t, r) => t + (r.tai_khoan === tk ? num(r.tien_pm) : 0), 0);



/** Cờ dạng --ten=giá trị; thiếu thì trả undefined. */
const co = (ten: string) =>
  process.argv.find((a) => a.startsWith(`--${ten}=`))?.split("=")[1];

async function main() {
  const tu = co("tu") ?? "";
  const den = co("den") ?? "";
  const trong = (ngay: string | null) =>
    ngay !== null && (!tu || ngay >= tu) && (!den || ngay <= den);
  const nhanKhoang = tu || den
    ? `Chỉ tính ${tu ? `từ ${tu}` : "đến"}${tu && den ? " đến " : ""}${den && !tu ? den : den}`
    : "Toàn bộ lịch sử";
  const gdAll = await q<GdRow & { tien_vao: string; id: string }>(`
    select r.id::text, r.tai_khoan, r.ngay::text as ngay, r.tien_vao::text,
           r.ma_hd, r.trang, r.dong, r.ten_gd, r.loai_gd, r.noi_bo
      from bank_row r
      join bank_import i on i.id = r.import_id and i.dang_dung
     order by r.ngay, r.id`);

  const dotAll = await q<DotRow & { so_tien: string }>(`
    select source_id, tai_khoan, ngay_thu::text as ngay_thu, so_tien::text,
           ma_hd, ky, dia_chi, trang_thai_dot, trang_thai_phieu,
           vao_bao_cao_tai_khoan, can_tru_coc
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
           tien_khach::text, so_dot_pm::text, tien_pm::text, chenh::text,
           so_dot_cms::text, tien_cms::text, tien_cho_duyet::text, chenh_cms::text,
           cms_loai_ra::text, cho_duyet_trong_cms::text
      from v_sao_ke_thang order by thang, tai_khoan`);

  const wb = new ExcelJS.Workbook();

  // ── Trang 1: theo tháng và tài khoản ──────────────────────────────────────
  const ws1 = wb.addWorksheet("Theo tháng và tài khoản");
  ws1.columns = [
    { header: "Tháng", key: "thang", width: 10 },
    { header: "Tài khoản", key: "tai_khoan", width: 20 },
    { header: "số GD", key: "so_gd", width: 10 },
    { header: "tiền vào thô", key: "tien_tho", width: 16, style: { numFmt: TIEN } },
    { header: "chuyển khoản nội bộ", key: "noi_bo", width: 21, style: { numFmt: TIEN } },
    { header: "tiền khách", key: "tien_khach", width: 16, style: { numFmt: TIEN } },
    { header: "số đợt", key: "so_dot_cms", width: 12 },
    { header: "tiền", key: "tien_cms", width: 15, style: { numFmt: TIEN } },
    { header: "số đợt", key: "so_dot_pm", width: 12 },
    { header: "tiền", key: "tien_pm", width: 15, style: { numFmt: TIEN } },
    { header: "CMS loại ra", key: "cms_loai_ra", width: 16, style: { numFmt: TIEN } },
    { header: "chưa approve mà CMS vẫn tính", key: "cho_duyet_trong_cms", width: 28, style: { numFmt: TIEN } },
    { header: "so với CMS", key: "chenh_cms", width: 15, style: { numFmt: TIEN } },
    { header: "so với bỏ lọc duyệt", key: "chenh", width: 20, style: { numFmt: TIEN } },
  ];
  // Mỗi tháng hiện đủ mọi tài khoản, tháng nào tài khoản đó không phát sinh thì
  // để 0 — bảng đều hàng nên so mắt theo cột được, không phải dò xem tháng này
  // có thiếu dòng nào không.
  const thangCo = [...new Set(thang.map((r) => r.thang))]
    .filter((th) => (!tu || th >= tu.slice(0, 7)) && (!den || th <= den.slice(0, 7)))
    .sort();
  const tkNganHang = [...new Set(thang.filter((r) => num(r.so_gd) > 0).map((r) => r.tai_khoan))];
  const tkKhac = [...new Set(thang.map((r) => r.tai_khoan))]
    .filter((t) => !tkNganHang.includes(t))
    .sort((a, b) => tienPm(thang, b) - tienPm(thang, a));
  const moiTk = [...tkNganHang.sort(), ...tkKhac];
  const oTheoKhoa = new Map(thang.map((r) => [`${r.thang}|${r.tai_khoan}`, r]));

  // Ghi lại khối dòng của từng tháng để gộp ô và tô so le sau khi thêm đầu trang.
  const khoi: { tu: number; den: number }[] = [];
  let d1 = 1;
  for (const th of thangCo) {
    const tu = d1 + 1;
    for (const tk of moiTk) {
      const r = oTheoKhoa.get(`${th}|${tk}`);
      const h = ws1.addRow({
        thang: th,
        tai_khoan: tk === "CHUA_GHI" ? "(chưa ghi tài khoản)" : tk,
        so_gd: num(r?.so_gd ?? 0), tien_tho: num(r?.tien_tho ?? 0),
        noi_bo: num(r?.noi_bo ?? 0), tien_khach: num(r?.tien_khach ?? 0),
        so_dot_cms: num(r?.so_dot_cms ?? 0), tien_cms: num(r?.tien_cms ?? 0),
        so_dot_pm: num(r?.so_dot_pm ?? 0), tien_pm: num(r?.tien_pm ?? 0),
        cho_duyet_trong_cms: num(r?.cho_duyet_trong_cms ?? 0),
        // Cột "CMS loại ra" và hai cột chênh gán công thức sau, khi đã biết số
        // dòng thật.
      });
      d1++;
      for (const k of ["chenh_cms", "chenh"])
        if (num(r?.[k as "chenh"] ?? 0) !== 0) {
          h.getCell(k).font = { bold: true, color: { argb: MAU.chuDo } };
          h.getCell(k).fill = { type: "pattern", pattern: "solid", fgColor: { argb: DO } };
        }
      for (const k of ["cms_loai_ra", "cho_duyet_trong_cms"])
        if (num(r?.[k as "cms_loai_ra"] ?? 0) !== 0)
          h.getCell(k).fill = { type: "pattern", pattern: "solid", fgColor: { argb: MAU.vang } };
    }
    khoi.push({ tu, den: d1 });
  }

  // Dòng tổng, cách một dòng trống để bộ lọc của Excel không kéo nó theo.
  const congCot = (lay: (r: Thang) => number) =>
    thang.reduce((t, r) => (thangCo.includes(r.thang) ? t + lay(r) : t), 0);
  ws1.addRow({});
  d1++;
  const dTongTruoc = ++d1;
  const hTong = ws1.addRow({
    tai_khoan: "TỔNG",
    so_gd: congCot((r) => num(r.so_gd)),
    tien_tho: congCot((r) => num(r.tien_tho)),
    noi_bo: congCot((r) => num(r.noi_bo)),
    tien_khach: congCot((r) => num(r.tien_khach)),
    so_dot_cms: congCot((r) => num(r.so_dot_cms)),
    tien_cms: congCot((r) => num(r.tien_cms)),
    so_dot_pm: congCot((r) => num(r.so_dot_pm)),
    tien_pm: congCot((r) => num(r.tien_pm)),
    cho_duyet_trong_cms: congCot((r) => num(r.cho_duyet_trong_cms)),
  });
  hTong.font = { bold: true };
  for (let c = 1; c <= 14; c++)
    hTong.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: MAU.xam } };


  // ── Trang 2: từng giao dịch sao kê ────────────────────────────────────────
  const ws2 = wb.addWorksheet("Từng giao dịch");
  ws2.columns = [
    { header: "ngày", key: "ngay", width: 15 },
    { header: "tài khoản", key: "tai_khoan", width: 20 },
    { header: "số tiền", key: "tien_vao", width: 18, style: { numFmt: TIEN } },
    { header: "loại GD", key: "loai_gd", width: 18 },
    { header: "người chuyển", key: "ten_gd", width: 26 },
    { header: "mã HĐ kế toán dò", key: "ma_hd_sk", width: 25 },
    { header: "trang gốc", key: "trang", width: 20 },
    { header: "dòng gốc", key: "dong", width: 19 },
    { header: "Kết quả đối soát", key: "ket_qua", width: 62 },
    { header: "mã HĐ", key: "ma_hd_pm", width: 17 },
    { header: "kỳ cước", key: "ky", width: 24 },
    { header: "số kỳ gộp", key: "so_ky", width: 19 },
    { header: "ngày thu", key: "ngay_thu", width: 19 },
    { header: "Lệch ngày", key: "lech_ngay", width: 11 },
    { header: "tài khoản", key: "tk_pm", width: 20 },
    { header: "trạng thái đợt", key: "trang_thai_dot", width: 23 },
    { header: "trạng thái phiếu cha", key: "trang_thai_phieu", width: 28 },
    { header: "ID đợt", key: "source_id", width: 38 },
  ];
  for (const g of gds) {
    if (!trong(g.ngay)) continue;
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
    { header: "Có trong báo cáo khoản thu", key: "trong_bc", width: 26 },
    { header: "Vì sao chưa ghép", key: "vi_sao", width: 52 },
    { header: "GD sao kê gần nhất cùng số tiền", key: "ung_vien", width: 34 },
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
  // Dải ngày sao kê của từng tài khoản: đợt rơi ngoài dải thì sao kê không có
  // dữ liệu để mà khớp, đó không phải thiếu tiền.
  const dai = new Map<string, { tu: string; den: string }>();
  for (const g of gds) {
    if (!g.ngay) continue;
    const c = dai.get(g.tai_khoan);
    if (!c) dai.set(g.tai_khoan, { tu: g.ngay, den: g.ngay });
    else {
      if (g.ngay < c.tu) c.tu = g.ngay;
      if (g.ngay > c.den) c.den = g.ngay;
    }
  }
  const leTheoTien = [...kq.dot_le]
    .filter((d) => trong(d.ngay_thu))
    .sort((a, b) => b.so_tien - a.so_tien);
  for (const d of leTheoTien) {
    const r = dotTheoId.get(d.source_id)!;
    // Giao dịch còn trống, cùng tài khoản, cùng số tiền, gần ngày thu nhất —
    // để soi tay xem có phải cùng một khoản mà lệch ngày quá xa hay không.
    const gan = kq.gd_le
      .filter((g) => g.tai_khoan === r.tai_khoan && g.tien_vao === r.so_tien && g.ngay)
      .map((g) => ({ g, l: Math.abs(Date.parse(g.ngay!) - Date.parse(r.ngay_thu ?? "")) / 86_400_000 }))
      .sort((a, b) => a.l - b.l)[0];
    const kho = dai.get(r.tai_khoan);
    const ngoaiDai =
      kho && r.ngay_thu ? r.ngay_thu < kho.tu || r.ngay_thu > kho.den : false;

    const viSao = r.can_tru_coc
      ? "Cấn trừ cọc — tiền đã vào từ tháng khách nộp cọc, không có giao dịch riêng"
      : r.tai_khoan === "CHUA_GHI"
        ? "Chưa ghi tài khoản thu — không biết tìm ở sao kê nào"
        : !kho
          ? "Tài khoản này không có trang nào trong file sao kê"
          : ngoaiDai
            ? `Ngoài dải sao kê — tài khoản này chỉ có từ ${kho.tu} đến ${kho.den}`
            : gan
              ? `Có giao dịch cùng số tiền nhưng lệch ${Math.round(gan.l)} ngày — soi tay`
              : "Không có giao dịch nào cùng số tiền ở tài khoản này";

    ws3.addRow({
      ...r,
      trong_bc: r.vao_bao_cao_tai_khoan ? "có" : "không",
      vi_sao: viSao,
      ung_vien: gan ? `${gan.g.ngay} · lệch ${Math.round(gan.l)} ngày` : null,
      tai_khoan: r.tai_khoan === "CHUA_GHI" ? "(chưa ghi tài khoản)" : r.tai_khoan,
    });
  }


  const moc =
    `Nguồn 1 — SAO KÊ NGÂN HÀNG: ${nguon?.ten_file ?? "?"} (file sửa ${gio(nguon?.sua_luc ?? null)}, ` +
    `nhập lúc ${gio(nguon?.nhap_luc ?? null)}). ` +
    "Nguồn 2 — THÔNG TIN BÁO CÁO KHOẢN THU của CMS wifi cố định (report/collection-account), " +
    `lấy đủ mọi đợt kể cả đợt chưa ghi tài khoản và đợt chưa duyệt, chốt lúc ${gio(nguon?.dong_bo ?? null)}. ` +
    `Phạm vi: ${nhanKhoang.toLowerCase()}. File xuất lúc ${new Date().toLocaleString("vi-VN")}.`;
  dauTrang(ws1, "Sao kê ngân hàng đặt cạnh phần mềm — theo tháng và tài khoản", moc, 14, [
    { ten: "", tu: 1, den: 2, mau: "FFFFFFFF" },
    { ten: "SAO KÊ NGÂN HÀNG", tu: 3, den: 6, mau: NEN_NHOM.saoKe },
    { ten: "PHẦN MỀM · GIỐNG CMS (report/collection-account)", tu: 7, den: 8, mau: NEN_NHOM.phanMem },
    { ten: "PHẦN MỀM · BỎ ĐIỀU KIỆN DUYỆT (mọi đợt) — cột tiền = tiền giống CMS + CMS loại ra", tu: 9, den: 12, mau: NEN_NHOM.phanMem },
    { ten: "CHÊNH = tiền khách − phần mềm", tu: 13, den: 14, mau: NEN_NHOM.chenh },
  ]);
  // dauTrang chèn ba dòng (tên, nguồn, nhóm) nên chỉ số dòng dịch xuống 3.
  const GIU = new Set<string>([DO, MAU.vang]);
  // Hai cột chênh và dòng tổng để Excel tự tính, không ghi số chết: sửa một ô
  // số liệu là chênh và tổng nhảy theo, và người đọc thấy được phép tính.
  // dauTrang chèn ba dòng nên mọi chỉ số dịch xuống 3.
  const dDau = (khoi[0]?.tu ?? 1) + 3;
  const dCuoi = (khoi.at(-1)?.den ?? 0) + 3;
  const dTong = dTongTruoc + 3;
  // Kèm sẵn `result` để công cụ nào không tự tính công thức vẫn đọc ra số.
  // ExcelJS BỎ HẲN key `result` khi nó bằng 0, nên phải nhận ô công thức qua
  // `formula` chứ không qua `result` — dò nhầm là Number(object) ra NaN và lan
  // ra cả dòng tổng.
  const giaTri = (v: ExcelJS.CellValue): number =>
    typeof v === "object" && v !== null && "formula" in v
      ? Number((v as ExcelJS.CellFormulaValue).result ?? 0)
      : Number(v ?? 0);
  const so = (r: number, c: number) => giaTri(ws1.getCell(r, c).value);
  const cot = (c: number) => String.fromCharCode(64 + c);
  for (let r = dDau; r <= dCuoi; r++) {
    // K = phần CMS gạt đi, để H + K đóng lại đúng bằng J.
    ws1.getCell(r, 11).value = { formula: `J${r}-H${r}`, result: so(r, 10) - so(r, 8) };
    // chênh = tiền khách (F) trừ đi số của phần mềm — H giống CMS, J bỏ lọc.
    const khach = so(r, 6);
    ws1.getCell(r, 13).value = { formula: `F${r}-H${r}`, result: khach - so(r, 8) };
    ws1.getCell(r, 14).value = { formula: `F${r}-J${r}`, result: khach - so(r, 10) };
  }
  for (let c = 3; c <= 14; c++) {
    let tong = 0;
    for (let r = dDau; r <= dCuoi; r++) tong += so(r, c);
    ws1.getCell(dTong, c).value = {
      formula: `SUM(${cot(c)}${dDau}:${cot(c)}${dCuoi})`,
      result: tong,
    };
  }

  // Vòng so le chỉ phủ các khối tháng; dòng tổng nằm ngoài nên giữ nguyên nền.
  khoi.forEach((k, i) => {
    ws1.mergeCells(k.tu + 3, 1, k.den + 3, 1);
    ws1.getCell(k.tu + 3, 1).alignment = { vertical: "middle", horizontal: "center" };
    const nen = SO_LE[i % 2]!;
    for (let r = k.tu + 3; r <= k.den + 3; r++)
      for (let c = 1; c <= 14; c++) {
        const o = ws1.getCell(r, c);
        // Ô đã tô cảnh báo thì giữ, đừng phủ nền so le lên.
        const cu = (o.fill as ExcelJS.FillPattern | undefined)?.fgColor?.argb;
        if (!cu || !GIU.has(cu))
          o.fill = { type: "pattern", pattern: "solid", fgColor: { argb: nen } };
      }
  });
  dauTrang(ws2, "Từng giao dịch sao kê, ghép với khoản thu bên phần mềm", moc, 18, [
    { ten: "SAO KÊ NGÂN HÀNG", tu: 1, den: 8, mau: NEN_NHOM.saoKe },
    { ten: "KẾT QUẢ ĐỐI SOÁT", tu: 9, den: 9, mau: NEN_NHOM.chenh },
    { ten: "PHẦN MỀM · khoản thu đã ghép được", tu: 10, den: 18, mau: NEN_NHOM.phanMem },
  ]);
  dauTrang(ws3, "Đợt thu bên phần mềm không tìm được giao dịch nào trên sao kê", moc, 12);

  // ── Trang 4: ghi chú ──────────────────────────────────────────────────────
  const ws4 = wb.addWorksheet("Ghi chú");
  ws4.columns = [{ width: 34 }, { width: 110 }];
  // Mọi con số tóm tắt đếm trên tập đã lọc theo phạm vi, để console và file
  // không nói hai chuyện khác nhau.
  const gdHien = gds.filter((g) => trong(g.ngay));
  // Bảng theo tháng gom theo cột `thang`, nên dòng không đọc ra ngày rơi ra
  // ngoài. Nói rõ ở Ghi chú, không thì cộng tay hai trang thấy lệch.
  const thieuNgay = gds.filter((g) => g.ngay === null);
  const soThieuNgay = thieuNgay.length;
  const tienThieuNgay = thieuNgay.reduce((x, g) => x + g.tien_vao, 0);
  const capHien = kq.cap.filter((c) => trong(c.gd.ngay));
  const gdLeHien = kq.gd_le.filter((g) => trong(g.ngay));
  const dotLeHien = kq.dot_le.filter((d) => trong(d.ngay_thu));
  const capGop = capHien.filter((c) => c.khoan.dot.length > 1);
  const tienCap = capHien.reduce((t, c) => t + c.gd.tien_vao, 0);
  const tienGdLe = gdLeHien.reduce((t, g) => t + g.tien_vao, 0);
  const tienDotLe = dotLeHien.reduce((t, d) => t + d.so_tien, 0);
  const t = (n: number) => n.toLocaleString("vi-VN");
  for (const [a, b] of [
    ["Mục", "Nội dung"],
    ["Nguồn 1 · sao kê ngân hàng",
     `${nguon?.ten_file ?? "?"} — 3 trang: Yucho Thương, Yucho Arai cố định, GMO. File sửa ${gio(nguon?.sua_luc ?? null)}, nhập vào kho ${gio(nguon?.nhap_luc ?? null)}.`],
    ["Nguồn 2 · thông tin báo cáo khoản thu",
     `Đợt thu của CMS wifi cố định, cùng dữ liệu dựng nên Báo cáo tài khoản thu (report/collection-account), toàn bộ lịch sử. Khác một chỗ: ở đây lấy đủ mọi đợt, kể cả đợt chưa ghi tài khoản và đợt chưa duyệt mà báo cáo của CMS loại ra. Chốt lúc ${gio(nguon?.dong_bo ?? null)}.`],
    ["Vì sao trang này ít giao dịch hơn trang Từng giao dịch",
     `Bảng theo tháng chỉ gom được dòng sao kê đọc ra ngày. ${soThieuNgay} dòng không có ngày (${t(tienThieuNgay)}) nằm ngoài bảng này nhưng vẫn có trong trang Từng giao dịch.`],
    ["Hai cột tiền của phần mềm",
     "GIỐNG CMS = đúng bộ lọc của Báo cáo tài khoản thu: bỏ đợt chưa ghi tài khoản và bỏ đợt mà cả đợt lẫn phiếu cha đều chưa duyệt. BỎ ĐIỀU KIỆN DUYỆT = mọi đợt trong kho. Hiệu hai cột chính là phần CMS gạt ra."],
    ["Hai cột nhỏ bên phải cột tiền",
     "CMS LOẠI RA = tiền − tiền giống CMS, tức phần CMS gạt đi (đợt chưa ghi tài khoản, và đợt mà cả đợt lẫn phiếu cha đều chưa duyệt). Cộng nó vào cột giống CMS ra đúng cột tiền. CHƯA APPROVE MÀ CMS VẪN TÍNH = đợt đã duyệt nhưng phiếu cha chưa duyệt — CMS vẫn tính nên nó nằm sẵn trong cột giống CMS, KHÔNG được cộng thêm. Hai cột này rời nhau, cộng lại ra tổng tiền còn chờ duyệt."],
    ["Phạm vi",
     `${nhanKhoang} (theo ngày giao dịch của sao kê và ngày thu của phần mềm). Phép ghép vẫn chạy trên toàn bộ lịch sử rồi mới lọc, nên không sinh ra "chưa ghép" giả ở mép khoảng.`],
    ["Chốt lúc", new Date().toLocaleString("vi-VN")],
    ["", ""],
    ["Giao dịch sao kê", `${gdHien.length} dòng · ${t(gdHien.reduce((s, g) => s + g.tien_vao, 0))}`],
    ["  trong đó nội bộ", `${gdHien.filter((g) => g.noi_bo).length} dòng · ${t(gdHien.reduce((s, g) => s + (g.noi_bo ? g.tien_vao : 0), 0))}`],
    ["Ghép được", `${capHien.length} cặp · ${t(tienCap)}`],
    ["  trong đó khách nộp gộp",
     `${capGop.length} giao dịch gom ${capGop.reduce((s2, c) => s2 + c.khoan.dot.length, 0)} kỳ · ${t(capGop.reduce((s2, c) => s2 + c.gd.tien_vao, 0))}`],
    ["GD sao kê chưa ghép", `${gdLeHien.length} dòng · ${t(tienGdLe)}`],
    ["Đợt phần mềm chưa ghép", `${dotLeHien.length} đợt · ${t(tienDotLe)}`],
    ["", ""],
    ["Vì sao sao kê nhiều tiền hơn",
     "Ba tài khoản này còn nhận cả tiền ngoài cước wifi cố định, nên giao dịch không ghép được là bình thường, không mặc nhiên là lỗi."],
    ["Quy tắc ghép",
     "Đơn vị bên phần mềm là LẦN THU (các đợt cùng hợp đồng, cùng ngày thu), vì khách hay đóng gộp mấy kỳ một lần. Một giao dịch ghép đúng một lần thu, một đợt chỉ nằm trong một cặp. Ghép theo bậc: mã HĐ + tiền + tài khoản + ngày ≤ 5, rồi nới dần."],
    ["Màu", "Xanh: khớp chắc · Vàng: khớp mã HĐ nhưng lệch tài khoản hoặc ngày · Tím: chỉ khớp tiền và ngày · Đỏ: không ghép được · Xám: nội bộ"],
  ]) ws4.addRow([a, b]);
  ws4.getRow(1).font = { bold: true };
  ws4.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: XAM } };

  datFont(wb, "Consolas");

  const duoi = tu || den ? `-tu-${tu || "dau"}-den-${den || "nay"}` : "";
  const ra = co("ra") ?? banKeTiep("../data", `doi-soat-sao-ke-tung-giao-dich${duoi}`);
  await wb.xlsx.writeFile(ra);

  console.log(`Đã ghi ${ra}  ·  ${nhanKhoang}`);
  console.log(`  giao dịch sao kê   ${String(gdHien.length).padStart(5)} dòng · ${t(gdHien.reduce((s, g) => s + g.tien_vao, 0)).padStart(11)}`);
  console.log(`  ghép được          ${String(capHien.length).padStart(5)} cặp  · ${t(tienCap).padStart(11)}`);
  console.log(`    khách nộp gộp    ${String(capGop.length).padStart(5)} GD gom ${capGop.reduce((s2, c) => s2 + c.khoan.dot.length, 0)} kỳ · ${t(capGop.reduce((s2, c) => s2 + c.gd.tien_vao, 0))}`);
  for (const b of [1, 2, 3, 4]) {
    const c = capHien.filter((x) => x.bac === b);
    if (c.length === 0) continue;
    console.log(`    bậc ${b}            ${String(c.length).padStart(5)} cặp  · ${t(c.reduce((s, x) => s + x.gd.tien_vao, 0)).padStart(11)}  ${BAC_TEN[b]!.ten}`);
  }
  console.log(`  GD sao kê chưa ghép${String(gdLeHien.length).padStart(5)} dòng · ${t(tienGdLe).padStart(11)}`);
  console.log(`  đợt PM chưa ghép   ${String(dotLeHien.length).padStart(5)} đợt  · ${t(tienDotLe).padStart(11)}`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
