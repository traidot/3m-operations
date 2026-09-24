import type ExcelJS from "exceljs";

/** Định dạng dùng chung cho các báo cáo xuất ra Excel. */
export const TIEN = "#,##0";

export const MAU = {
  xam: "FFEFEFEF",
  xanh: "FFE8F5E9",
  vang: "FFFFF3CD",
  tim: "FFEDE7F6",
  do: "FFFCE4E4",
  chuDo: "FFC00000",
} as const;

/**
 * Chèn hai dòng đầu trang nói rõ trang này lấy số ở đâu và chốt lúc nào. Nhìn
 * một cột như "Chuyển khoản nội bộ" hay "Tiền khách" mà không biết nó là số
 * của sao kê hay của phần mềm thì rất dễ đọc ngược, nên nguồn phải nằm ngay
 * trên đầu chứ không chỉ nằm ở trang Ghi chú.
 */
/** Một dải cột cùng một nguồn, hiện thành ô gộp trên hàng tiêu đề nhóm. */
export type Nhom = { ten: string; tu: number; den: number; mau?: string };

export function dauTrang(
  ws: ExcelJS.Worksheet,
  ten: string,
  nguon: string,
  soCot: number,
  nhom?: Nhom[],
) {
  ws.spliceRows(1, 0, [ten], [nguon], ...(nhom ? [[]] : []));
  ws.getRow(1).font = { bold: true, size: 13 };
  ws.getRow(2).font = { italic: true, size: 10, color: { argb: "FF666666" } };
  ws.mergeCells(1, 1, 1, soCot);
  ws.mergeCells(2, 1, 2, soCot);

  const dHeader = nhom ? 4 : 3;
  if (nhom) {
    for (const g of nhom) {
      if (g.den > g.tu) ws.mergeCells(3, g.tu, 3, g.den);
      const o = ws.getCell(3, g.tu);
      o.value = g.ten;
      o.alignment = { horizontal: "center", vertical: "middle" };
      o.font = { bold: true, size: 11 };
      for (let c = g.tu; c <= g.den; c++)
        ws.getCell(3, c).fill = {
          type: "pattern", pattern: "solid",
          fgColor: { argb: g.mau ?? MAU.xam },
        };
    }
    ws.getRow(3).height = 20;
  }
  ws.getRow(dHeader).font = { bold: true };
  ws.getRow(dHeader).fill = { type: "pattern", pattern: "solid", fgColor: { argb: MAU.xam } };
  ws.views = [{ state: "frozen", ySplit: dHeader }];
  ws.autoFilter = { from: { row: dHeader, column: 1 }, to: { row: dHeader, column: soCot } };
}

export const gio = (s: string | null) =>
  s ? new Date(s).toLocaleString("vi-VN") : "không rõ";

/**
 * Đặt một font cho cả sổ, giữ nguyên đậm/nghiêng/cỡ/màu đã set. ExcelJS không
 * có font mặc định ở mức workbook nên phải quét từng ô.
 */
export function datFont(wb: ExcelJS.Workbook, name: string) {
  for (const ws of wb.worksheets)
    ws.eachRow({ includeEmpty: false }, (row) =>
      row.eachCell({ includeEmpty: false }, (cell) => {
        cell.font = { ...cell.font, name };
      }));
}

/** Nền so le theo khối, để mắt bám được dòng trên bảng dài. */
export const SO_LE = ["FFFFFFFF", "FFF4F6F8"] as const;

/** Nền nhạt phân biệt hai nguồn trên hàng tiêu đề nhóm. */
export const NEN_NHOM = {
  saoKe: "FFFCE8D8",
  phanMem: "FFDCEBF7",
  chenh: "FFF0E4F5",
} as const;
