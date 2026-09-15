import type { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { getHopDongThang, type HopDongThang } from "@/lib/queries";
import { HOP_DONG, KY_CUOC } from "@/lib/nhan";

/** Xuất hợp đồng wifi cố định của một tháng, kèm cột tình trạng để lọc trong Excel. */
function tinhTrang(r: HopDongThang): string {
  if (r.dang_chay && !r.do_cong_ty && !r.co_ky_cuoc) return "Của đại lý, đại lý tự thu";
  if (r.dang_chay && !r.co_ky_cuoc) {
    return r.thieu_gia ? "Công ty, thiếu giá cước" : "Công ty, chưa ra kỳ cước";
  }
  if (r.co_ky_cuoc && !r.dang_chay) return "Có kỳ cước, đã ngừng";
  return "Đang chạy, có kỳ cước";
}

const so = (v: string | null) => (v === null ? null : Math.round(Number(v)));

export async function GET(request: NextRequest) {
  const thang = request.nextUrl.searchParams.get("thang") ?? "";
  if (!/^\d{4}-\d{2}$/.test(thang)) {
    return new Response("Tháng phải có dạng YYYY-MM", { status: 400 });
  }

  const rows = await getHopDongThang(thang);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`Hợp đồng ${thang}`, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "Tình trạng", key: "tinh_trang", width: 30 },
    { header: "Hợp đồng", key: "ma", width: 12 },
    { header: "Địa chỉ", key: "dia_chi", width: 45 },
    { header: "Trạng thái", key: "trang_thai", width: 12 },
    { header: "Phụ trách", key: "phu_trach", width: 10 },
    { header: "Người tạo", key: "nguoi_tao", width: 18 },
    { header: "Lắp xong", key: "lap_xong", width: 12 },
    { header: "Huỷ", key: "huy", width: 12 },
    { header: "Cước/tháng", key: "cuoc_thang", width: 12, style: { numFmt: "#,##0" } },
    { header: "Bắt đầu thu", key: "bat_dau_thu", width: 12 },
    { header: "Kỳ tháng này", key: "ky", width: 16 },
    { header: "Phải thu", key: "phai_thu", width: 12, style: { numFmt: "#,##0" } },
    { header: "Đã thu", key: "da_thu", width: 12, style: { numFmt: "#,##0" } },
    { header: "Khó đòi", key: "kho_doi", width: 9 },
    { header: "Link CMS", key: "link_cms", width: 55 },
  ];
  ws.getRow(1).font = { bold: true };

  for (const r of rows) {
    ws.addRow({
      tinh_trang: tinhTrang(r),
      ma: r.ma_hop_dong,
      dia_chi: r.dia_chi,
      trang_thai: HOP_DONG[r.trang_thai_hop_dong] ?? r.trang_thai_hop_dong,
      phu_trach: r.do_cong_ty ? "công ty" : "đại lý",
      nguoi_tao: r.nguoi_tao,
      lap_xong: r.ngay_lap_xong,
      huy: r.ngay_huy ?? "chưa huỷ",
      cuoc_thang: r.thieu_gia ? null : so(r.cuoc_thang),
      bat_dau_thu: r.bat_dau_thu,
      ky: r.trang_thai_ky ? (KY_CUOC[r.trang_thai_ky] ?? r.trang_thai_ky) : "không có kỳ",
      phai_thu: so(r.phai_thu),
      da_thu: so(r.da_thu),
      kho_doi: r.kho_doi ? "x" : "",
      link_cms: r.link_cms,
    });
  }
  ws.autoFilter = { from: "A1", to: { row: 1, column: ws.columns.length } };

  const buf = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="hop-dong-${thang}.xlsx"`,
    },
  });
}
