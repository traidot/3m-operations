import type { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { getInstallCohort } from "@/lib/queries";
import { HOP_DONG, LAP_DAT, LY_DO_HUY, TINH_HUONG_LAP } from "@/lib/nhan";

/** Đơn lắp của một tháng ký. */
export async function GET(request: NextRequest) {
  const thang = request.nextUrl.searchParams.get("thang") ?? "";
  if (!/^\d{4}-\d{2}$/.test(thang)) {
    return new Response("Tháng phải có dạng YYYY-MM", { status: 400 });
  }
  const rows = await getInstallCohort(thang);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`Đơn ký ${thang}`, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "Tình huống", key: "tinh_huong", width: 20 },
    { header: "Hợp đồng", key: "ma", width: 12 },
    { header: "Địa chỉ lắp", key: "dia_chi", width: 45 },
    { header: "Phụ trách", key: "phu_trach", width: 10 },
    { header: "Người tạo", key: "nguoi_tao", width: 18 },
    { header: "Ngày ký", key: "ngay_ky", width: 12 },
    { header: "Lắp xong", key: "lap_xong", width: 12 },
    { header: "Số ngày", key: "so_ngay", width: 9, style: { numFmt: "#,##0" } },
    { header: "Trạng thái lắp", key: "lap_dat", width: 12 },
    { header: "Trạng thái hợp đồng", key: "trang_thai", width: 14 },
    { header: "Ngày huỷ", key: "ngay_huy", width: 12 },
    { header: "Lý do huỷ", key: "ly_do", width: 30 },
    { header: "Nhóm lý do huỷ", key: "nhom_ly_do", width: 22 },
    { header: "Link CMS", key: "link_cms", width: 60 },
  ];
  ws.getRow(1).font = { bold: true };

  for (const r of rows) {
    ws.addRow({
      tinh_huong: TINH_HUONG_LAP[r.tinh_huong] ?? r.tinh_huong,
      ma: r.ma_hop_dong,
      dia_chi: r.dia_chi,
      phu_trach: r.do_cong_ty ? "công ty" : "đại lý",
      nguoi_tao: r.nguoi_tao,
      ngay_ky: r.ngay_ky,
      lap_xong: r.ngay_lap_xong,
      so_ngay: r.so_ngay_cho === null ? null : Number(r.so_ngay_cho),
      lap_dat: r.trang_thai_lap_dat ? (LAP_DAT[r.trang_thai_lap_dat] ?? r.trang_thai_lap_dat) : "",
      trang_thai: HOP_DONG[r.trang_thai_hop_dong] ?? r.trang_thai_hop_dong,
      ngay_huy: r.ngay_huy,
      ly_do: r.ly_do_huy,
      nhom_ly_do: r.nhom_ly_do_huy ? (LY_DO_HUY[r.nhom_ly_do_huy] ?? r.nhom_ly_do_huy) : "",
      link_cms: r.link_cms,
    });
  }
  ws.autoFilter = { from: "A1", to: { row: 1, column: ws.columns.length } };

  const buf = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="don-lap-${thang}.xlsx"`,
    },
  });
}
