import Link from "next/link";

export type DonVi = "ngay" | "thang";

export type Tham = Record<string, string | string[] | undefined>;
export const mot = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
export const ngay = (d: Date) => d.toISOString().slice(0, 10);

/** Mặc định: theo tháng thì 12 tháng gần nhất, theo ngày thì 30 ngày. */
export function khoang(donVi: DonVi) {
  const den = new Date();
  const tu = new Date(den);
  if (donVi === "ngay") tu.setDate(tu.getDate() - 30);
  else tu.setMonth(tu.getMonth() - 11, 1);
  return { tu: ngay(tu), den: ngay(den) };
}

/** Đọc đơn vị và khoảng ngày từ URL, dùng chung cho hai trang báo cáo tháng. */
export function docKhoang(sp: Tham) {
  const donVi: DonVi = mot(sp.don_vi) === "ngay" ? "ngay" : "thang";
  const mac = khoang(donVi);
  return { donVi, tu: mot(sp.tu) || mac.tu, den: mot(sp.den) || mac.den };
}

/**
 * Bộ lọc khoảng thời gian.
 *
 * `veMacDinh` phải trỏ về chính trang đang đứng — trước đây nút này cứng ở
 * "/thang", nên bấm từ trang khác là nhảy trang.
 */
export function LocKhoang({
  donVi,
  tu,
  den,
  veMacDinh,
  chiThang = false,
}: {
  donVi: DonVi;
  tu: string;
  den: string;
  veMacDinh: string;
  /** Trang chỉ có đơn vị tháng thì không hiện ô chọn đơn vị. */
  chiThang?: boolean;
}) {
  return (
    <form method="get" className="formgrid">
      {!chiThang && (
        <label>
          Đơn vị
          <span className="o-chon">
            <select name="don_vi" defaultValue={donVi}>
              <option value="thang">theo tháng</option>
              <option value="ngay">theo ngày</option>
            </select>
          </span>
        </label>
      )}
      <label>
        Từ ngày
        <input type="date" name="tu" defaultValue={tu} />
      </label>
      <label>
        Đến ngày
        <input type="date" name="den" defaultValue={den} />
      </label>
      <div className="actions">
        <button className="primary" type="submit">
          Xem
        </button>
        <Link href={veMacDinh}>
          <button type="button">Mặc định</button>
        </Link>
      </div>
    </form>
  );
}
