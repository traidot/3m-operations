import type { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { getThueBaoThang, type ThueBaoThang } from "@/lib/queries";
import { DICH_VU, HOP_DONG } from "@/lib/nhan";

/**
 * Xuất danh sách thuê bao của một tháng ra Excel — đúng những dòng ngăn kéo
 * đang bày, nhưng không cắt ở 500 và kèm cột tình trạng để lọc trong Excel.
 */
function tinhTrang(r: ThueBaoThang): string {
  if (r.dang_chay && !r.co_cuoc) return "Đang dùng, chưa có phiếu thu";
  if (r.co_cuoc && !r.dang_chay) return "Có phiếu thu, đã ngừng";
  return "Đang dùng, có phiếu thu";
}

const so = (v: string | null) => (v === null ? null : Math.round(Number(v)));

export async function GET(request: NextRequest) {
  const thang = request.nextUrl.searchParams.get("thang") ?? "";
  const tdv = request.nextUrl.searchParams.get("tdv") ?? "";

  if (!/^\d{4}-\d{2}$/.test(thang)) {
    return new Response("Tháng phải có dạng YYYY-MM", { status: 400 });
  }
  if (tdv && !Object.hasOwn(DICH_VU, tdv)) {
    return new Response("Dịch vụ không hợp lệ", { status: 400 });
  }

  const tatCa = await getThueBaoThang(thang, tdv || undefined);
  // Giống ngăn kéo: tháng chưa tới thì "đang dùng" chưa so được, chỉ lấy dòng có phiếu thu.
  const thangNay = new Date().toLocaleDateString("sv-SE").slice(0, 7);
  const rows = thang > thangNay ? tatCa.filter((r) => r.co_cuoc) : tatCa;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`Thuê bao ${thang}`, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "Tình trạng", key: "tinh_trang", width: 30 },
    { header: "Thuê bao", key: "thue_bao", width: 11 },
    { header: "Dịch vụ", key: "dich_vu", width: 15 },
    { header: "Gói", key: "goi", width: 30 },
    { header: "Khách", key: "khach", width: 28 },
    { header: "Mã khách", key: "ma_khach", width: 11 },
    { header: "Trạng thái", key: "trang_thai", width: 12 },
    { header: "Kích hoạt", key: "kich_hoat", width: 12 },
    { header: "Ngừng", key: "ngung", width: 12 },
    { header: "Cước cuối", key: "cuoc_cuoi", width: 11 },
    { header: "Phải thu", key: "phai_thu", width: 12, style: { numFmt: "#,##0" } },
    { header: "Đã thu", key: "da_thu", width: 12, style: { numFmt: "#,##0" } },
    { header: "Chưa thu", key: "chua_thu", width: 12, style: { numFmt: "#,##0" } },
    { header: "Không đòi được", key: "khong_doi_duoc", width: 15, style: { numFmt: "#,##0" } },
    { header: "Link CMS", key: "link_cms", width: 60 },
  ];
  ws.getRow(1).font = { bold: true };

  for (const r of rows) {
    ws.addRow({
      tinh_trang: tinhTrang(r),
      thue_bao: r.subscription_id,
      dich_vu: DICH_VU[r.dich_vu ?? ""] ?? r.dich_vu,
      goi: r.goi,
      khach: r.khach,
      ma_khach: r.ma_khach,
      trang_thai: HOP_DONG[r.trang_thai] ?? r.trang_thai,
      kich_hoat: r.kich_hoat,
      ngung: r.ngung ?? "chưa ngừng",
      cuoc_cuoi: r.cuoc_cuoi ?? "chưa từng có",
      phai_thu: so(r.phai_thu),
      da_thu: so(r.da_thu),
      chua_thu: so(r.chua_thu),
      khong_doi_duoc: so(r.khong_doi_duoc),
      link_cms: r.link_cms,
    });
  }
  ws.autoFilter = { from: "A1", to: { row: 1, column: ws.columns.length } };

  const buf = await wb.xlsx.writeBuffer();
  const ten = `thue-bao-${thang}${tdv ? `-${tdv.toLowerCase()}` : ""}.xlsx`;
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${ten}"`,
    },
  });
}
