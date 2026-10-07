import type { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { getContractsForExport, type ContractFilter } from "@/lib/queries";
import { HOP_DONG, KY_CUOC, LAP_DAT, LY_DO_HUY, TINH_TRANG_CUOC, CANH_BAO } from "@/lib/nhan";
import { lyDoCanhBao } from "@/lib/ly-do-canh-bao";

/** Toàn bộ hợp đồng wifi cố định khớp bộ lọc đang chọn trên trang. */
const so = (v: string | null) => (v === null ? null : Math.round(Number(v)));

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const loc: ContractFilter = {
    q: p.get("q") ?? "",
    hopDong: p.get("hd") ?? "",
    lapDat: p.get("lap") ?? "",
    cuoc: p.get("cuoc") ?? "",
    canhBao: p.get("cb") ?? "",
    ky: p.get("ky") ?? "",
    kyTrangThai: p.get("ky_tt") ?? "",
    thangKy: p.get("thang_ky") ?? "",
    thangHuy: p.get("thang_huy") ?? "",
    lyDoHuy: p.get("ly_do") ?? "",
    phuTrach: p.get("pt") ?? "",
  };
  const rows = await getContractsForExport(loc);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Hợp đồng", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "Mã hợp đồng", key: "ma", width: 12 },
    { header: "Địa chỉ lắp", key: "dia_chi", width: 45 },
    { header: "Trạng thái hợp đồng", key: "trang_thai", width: 14 },
    { header: "Lắp đặt", key: "lap_dat", width: 12 },
    { header: "Phụ trách", key: "phu_trach", width: 10 },
    { header: "Người tạo", key: "nguoi_tao", width: 18 },
    { header: "Gói", key: "goi", width: 12 },
    { header: "Cước/tháng", key: "cuoc_thang", width: 12, style: { numFmt: "#,##0" } },
    { header: "Bắt đầu thu", key: "bat_dau_thu", width: 12 },
    { header: "Kết thúc thu", key: "ket_thuc_thu", width: 12 },
    { header: "Ngày ký", key: "ngay_ky", width: 12 },
    { header: "Lắp xong", key: "lap_xong", width: 12 },
    { header: "Ngày huỷ", key: "ngay_huy", width: 12 },
    { header: "Lý do huỷ", key: "ly_do_huy", width: 30 },
    { header: "Nhóm lý do huỷ", key: "nhom_ly_do", width: 22 },
    { header: "Khó đòi", key: "kho_doi", width: 8 },
    { header: "Tình trạng cước", key: "tinh_trang_cuoc", width: 16 },
    { header: "Cảnh báo", key: "canh_bao", width: 40 },
    { header: "Lý do cụ thể", key: "ly_do_canh_bao", width: 90 },
    { header: "Link CMS", key: "link_cms", width: 60 },
  ];
  ws.getRow(1).font = { bold: true };

  for (const r of rows) {
    ws.addRow({
      ma: r.contract_code,
      dia_chi: r.dia_chi,
      trang_thai: HOP_DONG[r.trang_thai_hop_dong] ?? r.trang_thai_hop_dong,
      lap_dat: r.trang_thai_lap_dat ? (LAP_DAT[r.trang_thai_lap_dat] ?? r.trang_thai_lap_dat) : "",
      phu_trach: r.do_cong_ty ? "công ty" : "đại lý",
      nguoi_tao: r.nguoi_nhap,
      goi: r.goi_cuoc,
      cuoc_thang: so(r.cuoc_thang),
      bat_dau_thu: r.fee_start_on,
      ket_thuc_thu: r.fee_end_on,
      ngay_ky: r.ngay_ky,
      lap_xong: r.ngay_lap_xong,
      ngay_huy: r.ngay_huy,
      ly_do_huy: r.ly_do_huy,
      nhom_ly_do: r.nhom_ly_do_huy ? (LY_DO_HUY[r.nhom_ly_do_huy] ?? r.nhom_ly_do_huy) : "",
      kho_doi: r.kho_doi ? "x" : "",
      tinh_trang_cuoc: TINH_TRANG_CUOC[r.tinh_trang_cuoc] ?? r.tinh_trang_cuoc,
      canh_bao: r.canh_bao.map((cb) => CANH_BAO[cb] ?? cb).join(", "),
      // Mỗi cảnh báo một dòng trong cùng ô: đọc được mà vẫn lọc được theo cột
      // "Cảnh báo" bên cạnh.
      ly_do_canh_bao: lyDoCanhBao(r).join("\n"),
      link_cms: `https://cms-wifi.deepsync.vn/contracts/${r.subscription_id}`,
    });
  }
  ws.getColumn("ly_do_canh_bao").alignment = { wrapText: true, vertical: "top" };
  ws.autoFilter = { from: "A1", to: { row: 1, column: ws.columns.length } };

  const buf = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="hop-dong-wifi-co-dinh.xlsx"`,
    },
  });
}
