import type { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { getTelecomChurn, getTelecomChurnList } from "@/lib/queries";
import { DICH_VU, LOAI_KHACH } from "@/lib/nhan";

const TEN_LOAI: Record<string, string> = { ...LOAI_KHACH, CHUA_PHAN_LOAI: "chưa phân loại" };
const so = (v: string | null) => (v === null ? null : Number(v));

/** Báo cáo huỷ thuê bao cầm tay: một trang tổng hợp, một trang danh sách. */
export async function GET(request: NextRequest) {
  const thang = request.nextUrl.searchParams.get("thang") ?? "";
  const loai = request.nextUrl.searchParams.get("loai") ?? "";
  if (thang && !/^\d{4}-\d{2}$/.test(thang)) {
    return new Response("Tháng phải có dạng YYYY-MM", { status: 400 });
  }

  const [tong, ds] = await Promise.all([getTelecomChurn(), getTelecomChurnList(thang)]);
  // Lọc loại khách làm ở đây chứ không trong SQL: hai truy vấn dùng chung một
  // hàm, thêm tham số vào hàm chỉ để lọc thì đổi chữ ký cho cả hai chỗ.
  const locLoai = <T extends { loai_khach: string | null }>(rows: T[]) =>
    loai ? rows.filter((r) => (r.loai_khach ?? "CHUA_PHAN_LOAI") === loai) : rows;

  const wb = new ExcelJS.Workbook();

  const th = wb.addWorksheet("Theo tháng", { views: [{ state: "frozen", ySplit: 1 }] });
  th.columns = [
    { header: "Tháng", key: "thang", width: 10 },
    { header: "Loại khách", key: "loai", width: 16 },
    { header: "Đầu kỳ", key: "dau_ky", width: 9, style: { numFmt: "#,##0" } },
    { header: "Mới", key: "moi", width: 8, style: { numFmt: "#,##0" } },
    { header: "Huỷ", key: "huy", width: 8, style: { numFmt: "#,##0" } },
    { header: "Cuối kỳ", key: "cuoi_ky", width: 9, style: { numFmt: "#,##0" } },
    { header: "Tỉ lệ huỷ %", key: "ty_le", width: 12, style: { numFmt: "0.0" } },
    { header: "Tháng chưa xong", key: "chua_xong", width: 16 },
  ];
  th.getRow(1).font = { bold: true };
  for (const r of locLoai(tong)) {
    th.addRow({
      thang: r.thang,
      loai: TEN_LOAI[r.loai_khach] ?? r.loai_khach,
      dau_ky: so(r.dau_ky),
      moi: so(r.moi),
      huy: so(r.huy),
      cuoi_ky: so(r.cuoi_ky),
      ty_le: so(r.ty_le_huy),
      chua_xong: r.thang_chua_xong ? "x" : "",
    });
  }
  th.autoFilter = { from: "A1", to: { row: 1, column: th.columns.length } };

  const ct = wb.addWorksheet("Danh sách ngừng", { views: [{ state: "frozen", ySplit: 1 }] });
  ct.columns = [
    { header: "Tháng ngừng", key: "thang", width: 12 },
    { header: "Mã thuê bao", key: "tb", width: 12 },
    { header: "Khách", key: "khach", width: 28 },
    { header: "Mã khách", key: "ma_khach", width: 12 },
    { header: "Loại khách", key: "loai", width: 16 },
    { header: "Dịch vụ", key: "dich_vu", width: 16 },
    { header: "Gói", key: "goi", width: 20 },
    { header: "Giá/tháng", key: "gia", width: 11, style: { numFmt: "#,##0" } },
    { header: "Kích hoạt", key: "kich_hoat", width: 12 },
    { header: "Ngừng", key: "ngung", width: 12 },
    { header: "Số tháng dùng", key: "so_thang", width: 14, style: { numFmt: "#,##0" } },
    { header: "Còn nợ", key: "con_no", width: 11, style: { numFmt: "#,##0" } },
    { header: "Link CMS", key: "link", width: 60 },
  ];
  ct.getRow(1).font = { bold: true };
  for (const r of locLoai(ds)) {
    ct.addRow({
      thang: r.thang,
      tb: r.subscription_id,
      khach: r.khach,
      ma_khach: r.ma_khach,
      loai: TEN_LOAI[r.loai_khach ?? "CHUA_PHAN_LOAI"] ?? r.loai_khach,
      dich_vu: DICH_VU[r.service_type ?? ""] ?? r.service_type,
      goi: r.goi,
      gia: so(r.gia_thang),
      kich_hoat: r.ngay_kich_hoat,
      ngung: r.ngay_ngung,
      so_thang: so(r.so_thang_dung),
      con_no: so(r.con_no),
      link: r.link_cms,
    });
  }
  ct.autoFilter = { from: "A1", to: { row: 1, column: ct.columns.length } };

  const ten = ["huy-thue-bao", thang || "tat-ca", loai || ""].filter(Boolean).join("-");
  const buf = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${ten}.xlsx"`,
    },
  });
}
