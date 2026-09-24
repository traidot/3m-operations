import { existsSync } from "node:fs";

/**
 * Tên file báo cáo có đánh version, không bao giờ ghi đè bản cũ: dò các bản đã
 * có rồi lấy số kế tiếp. Chạy lại lần nữa là ra v2, v3 — giữ lại để so hai lần
 * chạy với nhau.
 */
export function banKeTiep(thuMuc: string, tenGoc: string, duoi = ".xlsx"): string {
  for (let v = 1; v < 1000; v++) {
    const duong = `${thuMuc}/${tenGoc}-v${v}${duoi}`;
    if (!existsSync(duong)) return duong;
  }
  throw new Error(`Quá 999 bản của ${tenGoc} trong ${thuMuc} — dọn bớt đi`);
}
