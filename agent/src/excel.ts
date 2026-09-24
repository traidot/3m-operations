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
export function dauTrang(
  ws: ExcelJS.Worksheet,
  ten: string,
  nguon: string,
  soCot: number,
) {
  ws.spliceRows(1, 0, [ten], [nguon]);
  ws.getRow(1).font = { bold: true, size: 13 };
  ws.getRow(2).font = { italic: true, size: 10, color: { argb: "FF666666" } };
  ws.mergeCells(1, 1, 1, soCot);
  ws.mergeCells(2, 1, 2, soCot);
  ws.getRow(3).font = { bold: true };
  ws.getRow(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: MAU.xam } };
  ws.views = [{ state: "frozen", ySplit: 3 }];
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: soCot } };
}

export const gio = (s: string | null) =>
  s ? new Date(s).toLocaleString("vi-VN") : "không rõ";
