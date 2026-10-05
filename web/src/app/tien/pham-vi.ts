import type { DotThuCoDinh } from "@/lib/queries";

export const CHUA_GHI = "CHUA_GHI";
export const TRU_COC = "cần trừ cọc";

/**
 * Hai cách cắt thời gian. Mốc `den` là tháng cuối cùng được tính.
 *
 * Mỗi phạm vi kéo theo một trục diễn biến khác: cả năm thì xem theo tháng, một
 * tháng thì xem theo ngày. Xem `mocCua` và `cacMoc`.
 */
export type PhamVi = "nam" | "thang";

export const TEN_PHAM_VI: Record<PhamVi, string> = {
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
  return { tu: `${thang.slice(0, 4)}-01`, den: `${thang.slice(0, 4)}-12` };
}

export function nhanKhoang(pv: PhamVi, thang: string): string {
  const [nam, m] = thang.split("-");
  return pv === "thang" ? `tháng ${Number(m)}/${nam}` : `năm ${nam}`;
}

/** Nhãn ngắn cho tiêu đề cột — "trước/trong/sau" cái gì. */
export function nhanCot(pv: PhamVi, thang: string): string {
  const [nam, m] = thang.split("-");
  return pv === "thang" ? `tháng ${Number(m)}` : `năm ${nam}`;
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

export const nhipCua = (_pv: PhamVi): Nhip[] => ["truoc", "dung", "sau"];

export const tong = (rows: DotThuCoDinh[]) =>
  rows.reduce((t, r) => t + Number(r.so_tien), 0);

export const TEN_TK: Record<string, string> = { [CHUA_GHI]: "(chưa ghi tài khoản)" };

/** Tài khoản xếp theo tiền nhiều trước, để bảng không nhảy chỗ. */
export const xepTaiKhoan = (rows: DotThuCoDinh[]) =>
  [...new Set(rows.map((r) => r.tai_khoan))].sort(
    (a, b) =>
      tong(rows.filter((r) => r.tai_khoan === b)) - tong(rows.filter((r) => r.tai_khoan === a)),
  );

/**
 * Đuôi tên file, suy từ PHẠM VI chứ không từ tham số `thang`. Khi xem cả năm
 * thì `thang` vẫn giữ tháng chọn lần trước, lấy thẳng nó ra là file cả năm mà
 * tên lại ghi một tháng.
 */
export const duoiTenFile = (pv: PhamVi, thang: string): string =>
  pv === "nam" ? thang.slice(0, 4) : thang;

/**
 * Trục diễn biến: bảng tài khoản cho biết tiền về ĐÂU, trục này cho biết tiền
 * về LÚC NÀO bên trong khoảng đang xem.
 *
 * Cả năm thì mốc là tháng của chính trục đang neo. Một tháng thì mốc là NGÀY
 * TIỀN VỀ — kỳ cước không có ngày, nó chỉ tới tháng, nên dù đang neo vào kỳ thì
 * trục ngày vẫn phải lấy theo ngày tiền về.
 *
 * Trả null khi đợt rơi ra ngoài khoảng: xem theo kỳ tháng 9 mà tiền về tháng 10
 * thì nó không có chỗ trên trục ngày của tháng 9. Màn hình gom riêng thành một
 * dòng chứ không bỏ, nếu không thì tổng hai bảng lệch nhau.
 */
export function mocCua(
  r: DotThuCoDinh,
  pv: PhamVi,
  gn: GocNhin,
  thang: string,
): string | null {
  if (pv === "nam") {
    const v = gn === "ky" ? r.ky : r.thang_tien_ve;
    return v.slice(0, 4) === thang.slice(0, 4) ? v : null;
  }
  return r.ngay_thu !== null && r.ngay_thu.slice(0, 7) === thang ? r.ngay_thu : null;
}

/** Đủ mọi mốc của khoảng, kể cả mốc không có đồng nào — ngày trống cũng là tin. */
export function cacMoc(pv: PhamVi, thang: string): string[] {
  const [nam, m] = thang.split("-").map(Number) as [number, number];
  if (pv === "nam") {
    return Array.from({ length: 12 }, (_, i) => `${nam}-${String(i + 1).padStart(2, "0")}`);
  }
  const soNgay = new Date(Date.UTC(nam, m, 0)).getUTCDate();
  return Array.from(
    { length: soNgay },
    (_, i) => `${thang}-${String(i + 1).padStart(2, "0")}`,
  );
}
