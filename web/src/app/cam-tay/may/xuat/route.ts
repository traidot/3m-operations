import ExcelJS from "exceljs";
import { getTelecomMay } from "@/lib/queries";
import { COC, DICH_VU, LOAI_KHACH, MAY, MAY_CUOC } from "@/lib/nhan";
import { LOC, locRows } from "../loc";

const TIEN = "#,##0";
const so = (v: string | null) => (v === null ? null : Number(v));

/**
 * Xuất đúng những máy đang hiện trên màn hình — dùng chung hàm lọc với trang
 * nên bảng và file không bao giờ lệch nhau.
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const t = {
    loc: sp.get("loc") ?? "",
    q: sp.get("q") ?? "",
    may: sp.get("may") ?? "",
    lk: sp.get("lk") ?? "",
    nk: sp.get("nk") ?? "",
  };
  const rows = locRows(await getTelecomMay(), t);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Máy wifi cầm tay", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "IMEI", key: "imei", width: 20 },
    { header: "Loại máy", key: "model", width: 26 },
    { header: "Nhóm thiết bị", key: "nhom_may", width: 16 },
    { header: "Tình trạng cước", key: "tinh_trang_cuoc", width: 22 },
    { header: "Đơn cho mượn chờ lắp cố định", key: "cho_muon", width: 28 },
    { header: "Tình trạng máy", key: "trang_thai", width: 14 },
    { header: "Ngày thuê", key: "ngay_thue", width: 12 },
    { header: "Ngày trả", key: "ngay_tra", width: 12 },
    { header: "Khách", key: "khach", width: 24 },
    { header: "Mã khách", key: "ma_khach", width: 12 },
    { header: "Loại khách", key: "loai_khach", width: 14 },
    { header: "Nhóm khách", key: "nhom_khach", width: 26 },
    { header: "Cọc", key: "coc", width: 10, style: { numFmt: TIEN } },
    { header: "Tình trạng cọc", key: "trang_thai_coc", width: 16 },
    { header: "Số lượt thuê", key: "so_luot_thue", width: 12 },
    { header: "Số lần gắn thuê bao", key: "so_lan_gan", width: 18 },
    { header: "Thuê bao hiện tại", key: "thue_bao_hien_tai", width: 16 },
    { header: "Dịch vụ", key: "dich_vu", width: 16 },
    { header: "Gói", key: "goi", width: 22 },
    { header: "Số kỳ", key: "so_ky", width: 8 },
    { header: "Kỳ đầu", key: "ky_dau", width: 10 },
    { header: "Kỳ cuối", key: "ky_cuoi", width: 10 },
    { header: "Phải thu", key: "phai_thu", width: 11, style: { numFmt: TIEN } },
    { header: "Đã thu", key: "da_thu", width: 11, style: { numFmt: TIEN } },
    { header: "Chưa thu", key: "chua_thu", width: 11, style: { numFmt: TIEN } },
    { header: "Mất trắng", key: "mat_trang", width: 11, style: { numFmt: TIEN } },
    { header: "Số tháng hụt", key: "thang_hut", width: 13 },
    { header: "Tiền hụt ước tính", key: "tien_hut_uoc", width: 17, style: { numFmt: TIEN } },
    { header: "Link CMS", key: "link_cms", width: 60 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const r of rows) {
    ws.addRow({
      ...r,
      nhom_may: r.nhom_may ? (DICH_VU[r.nhom_may] ?? r.nhom_may) : null,
      tinh_trang_cuoc: MAY_CUOC[r.tinh_trang_cuoc] ?? r.tinh_trang_cuoc,
      cho_muon: r.cho_muon ? "có" : "",
      trang_thai: r.trang_thai ? (MAY[r.trang_thai] ?? r.trang_thai) : null,
      loai_khach: r.loai_khach ? (LOAI_KHACH[r.loai_khach] ?? r.loai_khach) : null,
      trang_thai_coc: r.trang_thai_coc ? (COC[r.trang_thai_coc] ?? r.trang_thai_coc) : null,
      coc: so(r.coc),
      so_luot_thue: so(r.so_luot_thue),
      so_lan_gan: so(r.so_lan_gan),
      so_ky: so(r.so_ky),
      phai_thu: so(r.phai_thu),
      da_thu: so(r.da_thu),
      chua_thu: so(r.chua_thu),
      mat_trang: so(r.mat_trang),
      thang_hut: so(r.thang_hut),
      tien_hut_uoc: so(r.tien_hut_uoc),
    });
  }
  ws.autoFilter = { from: "A1", to: { row: 1, column: ws.columns.length } };

  // Tên file phải thuần ASCII: header HTTP chỉ nhận latin1, nhãn tiếng Việt có
  // dấu nhét vào đây là Node ném lỗi và cả route trả 500.
  const ten = t.loc && t.loc in LOC ? t.loc : "tat-ca";
  const buf = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="may-cam-tay-${ten}-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
