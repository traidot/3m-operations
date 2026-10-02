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
 * Dấu đứng cuối ô tiền. Vẽ bằng SVG chứ không dùng ký tự ✓ ⚠: ký tự phụ thuộc
 * font, mỗi máy ra một cỡ một nét, và cái tam giác cảnh báo thường bị font
 * dựng mảnh tới mức nhìn không ra.
 */
export function Dau({ du, chenh }: { du: boolean; chenh: number }) {
  return (
    <span
      className={`dau ${du ? "du" : "lech"}`}
      title={du ? "đã duyệt hết" : `còn ${n(chenh)} chưa duyệt`}
    >
      <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
        {du ? (
          <path
            d="M3 8.6l3.3 3.3L13.2 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <>
            <path
              d="M8 1.9l6.6 11.6H1.4z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path
              d="M8 6.3v3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
            <circle cx="8" cy="11.6" r="0.95" fill="currentColor" />
          </>
        )}
      </svg>
    </span>
  );
}

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

  type Cot = "tien" | "that" | "duyet" | "so";
  const giaTri = (r: Ngay7 | undefined, cot: Cot) => {
    if (r === undefined) return 0;
    if (cot === "tien") return Number(r.tien);
    if (cot === "that") return Number(r.tien_that);
    if (cot === "duyet") return Number(r.tien_duyet);
    return Number(r.so_luong);
  };
  const tongCot = (ngay: string, cot: Cot) =>
    chiSos.reduce((t, cs) => t + giaTri(o.get(`${cs}|${ngay}`), cot), 0);

  // Dòng cấn trừ cọc nhận ra bằng chính số liệu: cả tuần không có đồng nào
  // vào tài khoản mà vẫn có tiền ghi nhận. Không dò theo tên kênh — tên bên
  // nguồn đổi lúc nào không biết.
  const laCoc = (cs: string) =>
    ngays.every((d) => giaTri(o.get(`${cs}|${d}`), "that") === 0) &&
    ngays.some((d) => giaTri(o.get(`${cs}|${d}`), "tien") > 0);
  const kenhThat = chiSos.filter((cs) => !laCoc(cs));
  const kenhCoc = chiSos.filter(laCoc);
  const congQua = (ds: string[], ngay: string, cot: Cot) =>
    ds.reduce((t, cs) => t + giaTri(o.get(`${cs}|${ngay}`), cot), 0);

  // Hai số "đã duyệt / tổng ghi nhận" kèm dấu. Phần chênh là tiền đã đếm trên
  // báo cáo mà kế toán chưa xác nhận — chỉ số đó mới đáng đặt cạnh tổng, chứ
  // "vào tài khoản" thì mọi dòng tài khoản đều khớp theo đúng định nghĩa.
  const oTien = (duyet: number, tong: number, dam = false) => {
    if (tong === 0) return <span className="muted">—</span>;
    return (
      <>
        <span className="muted">{n(duyet)}</span> / {dam ? <b>{n(tong)}</b> : n(tong)}
        <Dau du={duyet === tong} chenh={tong - duyet} />
      </>
    );
  };

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
                  // Cấn trừ cọc chỉ một số: nó luôn là tiền ghi nhận, đặt
                  // cạnh số đã duyệt chỉ làm dòng này trông như dòng tài
                  // khoản, trong khi không đồng nào vào ngân hàng.
                  const noi =
                    kieu === "tien" && !laCoc(cs) ? (
                      oTien(giaTri(r, "duyet"), co)
                    ) : co === 0 ? (
                      <span className="muted">—</span>
                    ) : (
                      n(co)
                    );
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
                {ngays.map((d, i) => (
                  <td key={d} className={`num mono${xenKe(i)}`}>
                    {kieu === "tien" ? (
                      oTien(congQua(kenhThat, d, "duyet"), congQua(kenhThat, d, "tien"), true)
                    ) : tongCot(d, "so") === 0 ? (
                      <span className="muted">—</span>
                    ) : (
                      <b>{n(tongCot(d, "so"))}</b>
                    )}
                  </td>
                ))}
              </tr>
            )}
            {/* Dòng này không cộng vào dòng trên: nó là tiền ghi nhận chứ
                không phải tiền mới vào ngân hàng. */}
            {congTong && kieu === "tien" && kenhCoc.length > 0 && (
              <tr className="tong">
                <td className="muted">
                  Cấn trừ cọc <span className="muted">· ngoài tài khoản</span>
                </td>
                {ngays.map((d, i) => {
                  const v = congQua(kenhCoc, d, "tien");
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
