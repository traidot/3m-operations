import type { DotThuCoDinh } from "@/lib/queries";

export const CHUA_GHI = "CHUA_GHI";
export const TRU_COC = "cần trừ cọc";

/**
 * Ba cách cắt thời gian. Mốc `den` luôn là tháng cuối cùng được tính, `tu` rỗng
 * nghĩa là không chặn đầu dưới.
 */
export type PhamVi = "tat-ca" | "nam" | "thang";

export const TEN_PHAM_VI: Record<PhamVi, string> = {
  "tat-ca": "Từ đầu đến hết tháng",
  nam: "Cả năm",
  thang: "Một tháng",
};

/**
 * Hai góc nhìn, mỗi cái neo vào một trục rồi suy ra trục kia:
 *  - `ky`      neo vào KỲ CƯỚC, suy ra tiền về lúc nào và vào tài khoản nào
 *  - `tien-ve` neo vào NGÀY TIỀN VỀ, suy ra đó là cước của kỳ nào
 */
export type GocNhin = "ky" | "tien-ve";

export function khoang(pv: PhamVi, thang: string): { tu: string; den: string } {
  if (pv === "thang") return { tu: thang, den: thang };
  if (pv === "nam") return { tu: `${thang.slice(0, 4)}-01`, den: `${thang.slice(0, 4)}-12` };
  return { tu: "", den: thang };
}

export function nhanKhoang(pv: PhamVi, thang: string): string {
  const [nam, m] = thang.split("-");
  if (pv === "thang") return `tháng ${Number(m)}/${nam}`;
  if (pv === "nam") return `năm ${nam}`;
  return `từ đầu đến hết tháng ${Number(m)}/${nam}`;
}

/** Nhãn ngắn cho tiêu đề cột — "trước/trong/sau" cái gì. */
export function nhanCot(pv: PhamVi, thang: string): string {
  const [nam, m] = thang.split("-");
  if (pv === "thang") return `tháng ${Number(m)}`;
  if (pv === "nam") return `năm ${nam}`;
  return `mốc ${Number(m)}/${nam}`;
}

const trong = (v: string, tu: string, den: string) => (!tu || v >= tu) && v <= den;

/** Tập được neo: theo góc nhìn nào thì lọc theo trục đó. */
export function tapNeo(
  rows: DotThuCoDinh[],
  gn: GocNhin,
  tu: string,
  den: string,
): DotThuCoDinh[] {
  return gn === "ky"
    ? rows.filter((r) => trong(r.ky, tu, den) && r.vao_bao_cao_cuoc)
    : rows.filter((r) => trong(r.thang_tien_ve, tu, den));
}

/**
 * Trục suy ra rơi trước, trong, hay sau khoảng đang xem. Góc nhìn kỳ cước thì
 * suy ra tháng tiền về; góc nhìn tiền về thì suy ra kỳ cước.
 */
export function nhip(
  r: DotThuCoDinh,
  gn: GocNhin,
  tu: string,
  den: string,
): Nhip {
  const v = gn === "ky" ? r.thang_tien_ve : r.ky;
  if (tu && v < tu) return "truoc";
  if (v > den) return "sau";
  return trong(v, tu, den) ? "dung" : "truoc";
}

export type Nhip = "truoc" | "dung" | "sau";

/**
 * Phạm vi "từ đầu" không có đầu dưới nên cột "trước" luôn bằng 0 — bỏ đi chứ
 * đừng hiện một cột không bao giờ khác 0.
 */
export const nhipCua = (pv: PhamVi): Nhip[] =>
  pv === "tat-ca" ? ["dung", "sau"] : ["truoc", "dung", "sau"];

export const tong = (rows: DotThuCoDinh[]) =>
  rows.reduce((t, r) => t + Number(r.so_tien), 0);

export const TEN_TK: Record<string, string> = { [CHUA_GHI]: "(chưa ghi tài khoản)" };

/** Tài khoản xếp theo tiền nhiều trước, để bảng không nhảy chỗ. */
export const xepTaiKhoan = (rows: DotThuCoDinh[]) =>
  [...new Set(rows.map((r) => r.tai_khoan))].sort(
    (a, b) =>
      tong(rows.filter((r) => r.tai_khoan === b)) - tong(rows.filter((r) => r.tai_khoan === a)),
  );
