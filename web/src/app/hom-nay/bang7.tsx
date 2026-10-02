import Link from "next/link";
import type { Ngay7 } from "@/lib/queries";

const n = (v: string | number) => Math.round(Number(v)).toLocaleString("vi-VN");

/** Khoá của một ô, đủ để trang dựng lại ngăn kéo từ URL. Dấu | an toàn vì tên
 *  tài khoản bên nguồn không có ký tự đó. */
export const ma = (chiSo: string, ngay: string) =>
  encodeURIComponent(`${chiSo}|${ngay}`);

/** Cột ngày tô nền xen kẽ: bảy cột số trần nằm cạnh nhau thì mắt dò theo một
 *  hàng rất dễ lạc sang ngày bên cạnh. */
const xenKe = (i: number) => (i % 2 === 1 ? " o-le" : "");

/** Nhãn cột: ngày trong tháng, hôm nay ghi rõ để khỏi đếm ngược. */
const nhanCot = (iso: string, homNay: string) =>
  iso === homNay ? "hôm nay" : iso.slice(8, 10) + "/" + iso.slice(5, 7);

/**
 * Bảng bảy ngày: mỗi hàng một chỉ số, mỗi cột một ngày.
 *
 * `kieu` chỉ đổi cách cộng ở dòng cuối: nhóm tiền tách tổng làm hai dòng,
 * tiền thật vào tài khoản và tiền cấn trừ cọc. Cấn trừ cọc là nghiệp vụ bình
 * thường — khách đã nộp từ trước, nay trừ sang cước — nhưng gộp chung một
 * tổng thì ngày cấn trừ nhiều nhìn như ngày thu tốt, trong khi ngân hàng
 * không nhận thêm đồng nào.
 */
export function Bang7({
  ten, y, ds, kieu, phu, congTong = true, moO,
}: {
  ten: string;
  y: string;
  ds: Ngay7[];
  kieu: "tien" | "so";
  phu?: string;
  /** Đường dẫn của trang chứa bảng. Có thì mỗi ô có số thành một liên kết mở
   *  ngăn kéo chi tiết; không có thì ô là chữ thường. */
  moO?: string;
  /** Tắt khi các dòng lồng nhau — "đơn hẹn" đã gồm cả "đã lắp xong", cộng lại
   *  ra số không tồn tại. */
  congTong?: boolean;
}) {
  if (ds.length === 0) return null;
  const ngays = [...new Set(ds.map((r) => r.ngay))].sort();
  const homNay = ngays.at(-1) ?? "";
  const chiSos = [...new Set(ds.map((r) => r.chi_so))];
  const o = new Map(ds.map((r) => [`${r.chi_so}|${r.ngay}`, r]));

  const giaTri = (r: Ngay7 | undefined, cot: "tien" | "that" | "so") =>
    Number(
      r === undefined ? 0 : cot === "tien" ? r.tien : cot === "that" ? r.tien_that : r.so_luong,
    );
  const tongCot = (ngay: string, cot: "tien" | "that" | "so") =>
    chiSos.reduce((t, cs) => t + giaTri(o.get(`${cs}|${ngay}`), cot), 0);

  // Cấn trừ cọc nằm sẵn ở dòng riêng của nó, nên từng ô chỉ cần một con số.
  // Chỗ duy nhất phải tách là dòng tổng: cộng gộp thì không biết bao nhiêu
  // thật sự vào ngân hàng.
  const coCoc = ngays.some((d) => tongCot(d, "tien") !== tongCot(d, "that"));

  return (
    <section>
      <h2>
        {ten} <span className="muted">— {y}</span>
      </h2>
      <div className="scroller">
        <table className="deu">
          <thead>
            <tr>
              <th>Chỉ số</th>
              {ngays.map((d, i) => (
                <th key={d} className={`num${xenKe(i)}`}>
                  {nhanCot(d, homNay)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chiSos.map((cs) => (
              <tr key={cs}>
                <td>
                  {cs}
                  {kieu === "so" && (
                    <span className="muted">
                      {" · "}
                      {ds.find((r) => r.chi_so === cs)?.don_vi}
                    </span>
                  )}
                </td>
                {ngays.map((d, i) => {
                  const r = o.get(`${cs}|${d}`);
                  const co = kieu === "tien" ? giaTri(r, "tien") : giaTri(r, "so");
                  const noi = co === 0 ? <span className="muted">—</span> : n(co);
                  return (
                    <td key={d} className={`num mono${xenKe(i)}`}>
                      {moO !== undefined && co > 0 ? (
                        <Link className="o-mo" href={`${moO}?o=${ma(cs, d)}`} scroll={false}>
                          {noi}
                        </Link>
                      ) : (
                        noi
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {congTong && chiSos.length > 1 && (
              <tr className="tong">
                <td>
                  <b>{kieu === "tien" ? "Tổng vào tài khoản" : "Tổng"}</b>
                </td>
                {ngays.map((d, i) => {
                  const v = tongCot(d, kieu === "tien" ? "that" : "so");
                  return (
                    <td key={d} className={`num mono${xenKe(i)}`}>
                      {v === 0 ? <span className="muted">—</span> : <b>{n(v)}</b>}
                    </td>
                  );
                })}
              </tr>
            )}
            {/* Dòng này không cộng vào dòng trên: nó là tiền ghi nhận chứ
                không phải tiền mới vào ngân hàng. */}
            {congTong && kieu === "tien" && coCoc && (
              <tr className="tong">
                <td className="muted">
                  Cấn trừ cọc <span className="muted">· ngoài tài khoản</span>
                </td>
                {ngays.map((d, i) => {
                  const v = tongCot(d, "tien") - tongCot(d, "that");
                  return (
                    <td key={d} className={`num mono muted${xenKe(i)}`}>
                      {v === 0 ? "—" : n(v)}
                    </td>
                  );
                })}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {phu && <p className="muted">{phu}</p>}
    </section>
  );
}
