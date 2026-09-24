import ExcelJS from "exceljs";
import { getDotThuCoDinhThang, type DotThuCoDinh } from "@/lib/queries";

const CHUA_GHI = "CHUA_GHI";
const TRU_COC = "cần trừ cọc";
const TIEN = "#,##0";

const tong = (rows: DotThuCoDinh[]) => rows.reduce((t, r) => t + Number(r.so_tien), 0);
const nhip = (r: DotThuCoDinh) =>
  r.thang_tien_ve < r.ky ? "truoc" : r.thang_tien_ve === r.ky ? "dung" : "muon";

/**
 * Cùng ba khối với màn hình, một luật chung nên cộng ngang cộng dọc đều khớp.
 * Trang đầu để đọc, trang sau để lọc — cột "Vai trò trong tháng" nói rõ mỗi đợt
 * rơi vào khối nào.
 */
export async function GET(req: Request) {
  const thang = new URL(req.url).searchParams.get("thang") ?? new Date().toISOString().slice(0, 7);
  const m = Number(thang.split("-")[1]);
  const tatCa = await getDotThuCoDinhThang(thang);
  const theoKy = tatCa.filter((r) => r.ky === thang && r.vao_bao_cao_cuoc);
  const theoTienVe = tatCa.filter((r) => r.thang_tien_ve === thang);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`Tháng ${thang}`);
  ws.columns = [{ width: 36 }, { width: 14 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 52 }];
  let d = 0;
  const dong = (v: (string | number | null)[], dang?: "tieu-de" | "muc" | "dam" | "phu") => {
    const h = ws.getRow(++d);
    v.forEach((x, i) => {
      if (x !== null) h.getCell(i + 1).value = x;
    });
    for (let i = 2; i <= 5; i++) h.getCell(i).numFmt = TIEN;
    if (dang === "tieu-de") h.font = { bold: true, size: 14 };
    if (dang === "muc") {
      h.font = { bold: true, size: 11 };
      h.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
    }
    if (dang === "dam") h.font = { bold: true };
    if (dang === "phu") h.font = { color: { argb: "FF888888" }, italic: true };
    return h;
  };

  dong([`Kỳ cước và dòng tiền — tháng ${m}/${thang.slice(0, 4)}`], "tieu-de");
  dong([`Wifi cố định · chốt lúc ${new Date().toLocaleString("vi-VN")}`], "phu");
  d++;

  dong([`1 · Cước kỳ ${thang} đã thu, về tài khoản nào`], "muc");
  dong(["Tài khoản", "Số đợt", `Thu trước T${m}`, `Thu trong T${m}`, `Thu sau T${m}`, "Tổng"], "dam");
  const taiKhoan = [...new Set(theoKy.map((r) => r.tai_khoan))].sort(
    (a, b) => tong(theoKy.filter((r) => r.tai_khoan === b)) - tong(theoKy.filter((r) => r.tai_khoan === a)),
  );
  for (const tk of taiKhoan) {
    const r = theoKy.filter((x) => x.tai_khoan === tk);
    const h = dong([
      tk === CHUA_GHI ? "(chưa ghi tài khoản)" : tk,
      r.length,
      ...["truoc", "dung", "muon"].map((k) => tong(r.filter((x) => nhip(x) === k))),
      tong(r),
    ]);
    // Cột thứ 6 là "Tổng" nên ghi chú phải sang cột 7.
    if (tk === TRU_COC)
      h.getCell(7).value =
        "Cọc khách nộp trước qua combini, nay trừ sang cước — sao kê ghi ở tháng nộp cọc";
    if (tk === CHUA_GHI) h.getCell(7).value = "Báo cáo tài khoản thu của CMS loại thẳng nhóm này";
  }
  dong([
    `Tổng đã thu của kỳ ${thang}`,
    theoKy.length,
    ...["truoc", "dung", "muon"].map((k) => tong(theoKy.filter((x) => nhip(x) === k))),
    tong(theoKy),
  ], "dam");
  dong(["Có giao dịch ngân hàng gắn với chính kỳ này", null, null, null, null,
    tong(theoKy.filter((r) => !r.can_tru_coc))], "dam");
  dong([null, null, null, null, null, "Khớp với ô “Tổng đã thu” tháng này của Báo cáo thống kê cước phí bên CMS."], "phu");
  d++;

  dong([`2 · Tiền về trong tháng ${m} là cước của kỳ nào`], "muc");
  dong(["Nhóm kỳ", "Số đợt", "Số tiền", "Tỉ lệ"], "dam");
  for (const g of [
    { ten: "Kỳ trước — trả nợ kỳ cũ", rows: theoTienVe.filter((r) => r.ky < thang) },
    { ten: `Kỳ ${thang} — đúng kỳ`, rows: theoTienVe.filter((r) => r.ky === thang) },
    { ten: "Kỳ sau — khách nộp trước", rows: theoTienVe.filter((r) => r.ky > thang) },
  ]) {
    const h = dong([g.ten, g.rows.length, tong(g.rows), tong(g.rows) / Math.max(tong(theoTienVe), 1)]);
    h.getCell(4).numFmt = "0.0%";
  }
  dong([`Tổng tiền về trong tháng ${m}`, theoTienVe.length, tong(theoTienVe)], "dam");
  d++;

  dong(["3 · Cờ cảnh báo"], "muc");
  dong(["Cần xử lý", `Ở khối 1 (kỳ ${thang})`, `Ở khối 2 (tiền về T${m})`, null, null, "Việc"], "dam");
  for (const c of [
    { ten: "Đợt chưa ghi tài khoản thu", hop: (r: DotThuCoDinh) => r.tai_khoan === CHUA_GHI,
      viec: "Người thu mở đợt, chọn tài khoản đã nhận tiền" },
    { ten: "Đợt hoặc phiếu cha chưa duyệt", hop: (r: DotThuCoDinh) => r.cho_duyet,
      viec: "Duyệt nốt; soát các đợt số tiền lẻ trước khi duyệt" },
    { ten: "Phiếu cha đã bị xoá ở nguồn", hop: (r: DotThuCoDinh) => r.phieu_da_xoa,
      viec: "Đợt còn sống mà phiếu cha mất — kiểm tra trên CMS" },
    { ten: "Cấn trừ cọc — sao kê nằm ở tháng nộp cọc", hop: (r: DotThuCoDinh) => r.can_tru_coc,
      viec: "Không phải lỗi: tiền thật đã vào qua combini từ trước, chỉ khác tháng" },
  ]) {
    const a = tong(theoKy.filter(c.hop));
    const b = tong(theoTienVe.filter(c.hop));
    if (a === 0 && b === 0) continue;
    dong([c.ten, a, b, null, null, c.viec]);
  }

  const ws2 = wb.addWorksheet("Chi tiết từng đợt", { views: [{ state: "frozen", ySplit: 1 }] });
  ws2.columns = [
    { header: "Vai trò trong tháng", key: "vai_tro", width: 34 },
    { header: "Mã hợp đồng", key: "ma_hd", width: 16 },
    { header: "Địa chỉ lắp", key: "dia_chi", width: 42 },
    { header: "Cước tháng", key: "cuoc_thang", width: 11, style: { numFmt: TIEN } },
    { header: "Kỳ cước", key: "ky", width: 10 },
    { header: "Tháng tiền về", key: "thang_tien_ve", width: 14 },
    { header: "Ngày thu", key: "ngay_thu", width: 12 },
    { header: "Số tiền", key: "so_tien", width: 10, style: { numFmt: TIEN } },
    { header: "Tài khoản", key: "tai_khoan", width: 20 },
    { header: "Trạng thái đợt", key: "trang_thai_dot", width: 17 },
    { header: "Trạng thái phiếu cha", key: "trang_thai_phieu", width: 20 },
    { header: "ID đợt", key: "source_id", width: 38 },
  ];
  ws2.getRow(1).font = { bold: true };
  for (const r of tatCa) {
    const vai =
      r.ky === thang && r.thang_tien_ve === thang
        ? "đúng kỳ, đúng tháng"
        : r.ky === thang && r.thang_tien_ve < thang
          ? "cước kỳ này, thu trước"
          : r.ky === thang
            ? "cước kỳ này, thu muộn"
            : r.ky < thang
              ? "tiền tháng này, trả nợ kỳ cũ"
              : "tiền tháng này, nộp trước kỳ sau";
    ws2.addRow({
      ...r,
      vai_tro: vai,
      tai_khoan: r.tai_khoan === CHUA_GHI ? "(chưa ghi tài khoản)" : r.tai_khoan,
      cuoc_thang: r.cuoc_thang === null ? null : Number(r.cuoc_thang),
      so_tien: Number(r.so_tien),
    });
  }
  ws2.autoFilter = { from: "A1", to: { row: 1, column: ws2.columns.length } };

  const buf = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ky-cuoc-va-dong-tien-${thang}.xlsx"`,
    },
  });
}
