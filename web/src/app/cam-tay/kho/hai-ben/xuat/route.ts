import ExcelJS from "exceljs";
import { getKhoLanNhap, getKhoMa, type KhoMa } from "@/lib/queries";
import { KHO_PM, LOAI_KHACH, LOAI_MA, MAY_CUOC, PHIEU_KHO } from "@/lib/nhan";

const KHO_MA: Record<string, string> = { ...KHO_PM, PM_KHONG_CO: "phần mềm không có mã" };
const so = (v: string | null) => (v === null ? null : Number(v));

/** Ba phần loại trừ nhau, cùng luật với màn hình /cam-tay/kho/hai-ben. */
const PHAN: { ten: string; hop: (r: KhoMa) => boolean }[] = [
  { ten: "Chỉ file có", hop: (r) => r.file_co && !r.pm_co },
  { ten: "Cả hai bên có", hop: (r) => r.file_co && r.pm_co },
  { ten: "Chỉ phần mềm có", hop: (r) => r.pm_co && !r.file_co },
];

/**
 * Xuất ba phần ra ba trang, kèm một trang tổng hợp ở đầu.
 *
 * Mỗi trang giữ đủ cả hai phía dù một phía chắc chắn rỗng — mở file ra là so
 * được ngay, không phải nhớ trang nào thiếu cột gì.
 */
export async function GET() {
  const [rows, lan] = await Promise.all([getKhoMa(), getKhoLanNhap()]);
  const wb = new ExcelJS.Workbook();

  const tq = wb.addWorksheet("Tổng hợp");
  tq.columns = [
    { header: "Mục", key: "muc", width: 42 },
    { header: "Số mã", key: "so", width: 12, style: { numFmt: "#,##0" } },
    { header: "Ghi chú", key: "ghi_chu", width: 70 },
  ];
  tq.getRow(1).font = { bold: true };
  const dem = (hop: (r: KhoMa) => boolean) => rows.filter(hop).length;
  const chiFile = dem(PHAN[0]!.hop);
  const caHai = dem(PHAN[1]!.hop);
  const chiPm = dem(PHAN[2]!.hop);
  for (const r of [
    { muc: "Bản đối chiếu làm tay (file)", so: chiFile + caHai,
      ghi_chu: lan ? `${lan.ten_file}, chốt ngày ${lan.sua_luc?.slice(0, 10) ?? "không rõ"}` : "" },
    { muc: "Phần mềm wifi cầm tay", so: caHai + chiPm,
      ghi_chu: "mã có chứng từ ở bất kỳ bảng nào bên nguồn" },
    { muc: "— Chỉ file có", so: chiFile,
      ghi_chu: "phần mềm không có mã này ở bất kỳ bảng nào" },
    { muc: "— Cả hai bên có", so: caHai, ghi_chu: "phần chung" },
    { muc: "— Chỉ phần mềm có", so: chiPm,
      ghi_chu: "phần mềm có chứng từ, bản đối chiếu không nhắc tới" },
    { muc: "Hợp hai bên", so: rows.length, ghi_chu: "không bên nào một mình nắm đủ" },
  ]) {
    tq.addRow(r);
  }

  for (const p of PHAN) {
    const ws = wb.addWorksheet(p.ten, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = [
      { header: "Mã thiết bị", key: "ma", width: 18 },
      { header: "Loại định danh", key: "loai_ma", width: 22 },
      { header: "Đời máy", key: "doi_may", width: 26 },
      { header: "PM: chỗ đứng", key: "cho_dung", width: 20 },
      { header: "PM: phiếu gần nhất", key: "phieu", width: 14 },
      { header: "PM: ngày phiếu", key: "ngay_phieu", width: 13 },
      { header: "PM: lý do phiếu", key: "ly_do", width: 32 },
      { header: "PM: kho", key: "kho", width: 20 },
      { header: "PM: khách", key: "khach", width: 28 },
      { header: "PM: mã khách", key: "ma_khach", width: 13 },
      { header: "PM: nguồn biết khách", key: "nguon_khach", width: 20 },
      { header: "PM: tình trạng cước", key: "cuoc", width: 22 },
      { header: "PM: kỳ cuối", key: "ky_cuoi", width: 11 },
      { header: "PM: cước chưa thu", key: "chua_thu", width: 15, style: { numFmt: "#,##0" } },
      { header: "PM: cọc", key: "coc", width: 11, style: { numFmt: "#,##0" } },
      { header: "PM: nhà mạng", key: "nha_mang", width: 14 },
      { header: "File: nhóm hàng", key: "f_nhom", width: 16 },
      { header: "File: kết luận", key: "f_ket_luan", width: 44 },
      { header: "File: vị trí trong sổ", key: "f_vi_tri", width: 20 },
      { header: "File: kiểm kho 15/09", key: "f_kiem_kho", width: 20 },
      { header: "File: người giữ", key: "f_nguoi_giu", width: 28 },
    ];
    ws.getRow(1).font = { bold: true };
    for (const r of rows.filter(p.hop)) {
      ws.addRow({
        ma: r.ma,
        loai_ma: LOAI_MA[r.loai_ma] ?? r.loai_ma,
        doi_may: r.doi_may,
        cho_dung: KHO_MA[r.cho_dung] ?? r.cho_dung,
        phieu: r.doc_type ? (PHIEU_KHO[r.doc_type] ?? r.doc_type) : null,
        ngay_phieu: r.doc_date,
        ly_do: r.reason_type,
        kho: r.warehouse_name,
        khach: r.khach,
        ma_khach: r.ma_khach,
        nguon_khach: r.nguon_khach,
        cuoc: r.tinh_trang_cuoc ? (MAY_CUOC[r.tinh_trang_cuoc] ?? r.tinh_trang_cuoc) : null,
        ky_cuoi: r.ky_cuoi,
        chua_thu: so(r.chua_thu),
        coc: so(r.coc),
        nha_mang: r.nha_mang,
        f_nhom: r.file_nhom_hang,
        f_ket_luan: r.file_ket_luan,
        f_vi_tri: r.file_vi_tri_so,
        f_kiem_kho: r.file_kiem_kho,
        f_nguoi_giu: r.file_nguoi_giu,
      });
    }
    ws.autoFilter = { from: "A1", to: { row: 1, column: ws.columns.length } };
  }

  const ngay = new Date().toISOString().slice(0, 10);
  const buf = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="kho-hai-ben-${ngay}.xlsx"`,
    },
  });
}
