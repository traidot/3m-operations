import { readdirSync } from "node:fs";

/**
 * Tên file báo cáo có đánh version, không bao giờ ghi đè bản cũ.
 *
 * Lấy số LỚN NHẤT đang có rồi cộng một, chứ không lấy chỗ trống đầu tiên: dọn
 * bớt bản cũ xong mà vẫn còn v8, v9 thì bản mới phải là v10, không thể quay về
 * v1 rồi nằm lẫn với bản cũ hơn.
 */
export function banKeTiep(thuMuc: string, tenGoc: string, duoi = ".xlsx"): string {
  const mau = new RegExp(
    `^${tenGoc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-v(\\d+)${duoi.replace(".", "\\.")}$`,
  );
  let cao = 0;
  for (const f of readdirSync(thuMuc)) {
    const m = mau.exec(f);
    if (m) cao = Math.max(cao, Number(m[1]));
  }
  return `${thuMuc}/${tenGoc}-v${cao + 1}${duoi}`;
}
