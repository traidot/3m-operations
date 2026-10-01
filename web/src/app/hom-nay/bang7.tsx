import type { Ngay7 } from "@/lib/queries";

const n = (v: string | number) => Math.round(Number(v)).toLocaleString("vi-VN");

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
function Dau({ du, chenh }: { du: boolean; chenh: number }) {
  return (
    <span
      className={`dau ${du ? "du" : "lech"}`}
      title={du ? "tiền về đủ vào tài khoản" : `cấn trừ cọc ${n(chenh)}`}
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
 * `kieu` quyết định ô hiển thị gì — tiền thì hai số "không cấn trừ / tổng",
 * còn lại chỉ số lượng. Ngày nào cấn trừ nhiều mà chỉ hiện một số thì nhìn
 * như ngày thu tốt, trong khi ngân hàng không nhận thêm đồng nào.
 */
export function Bang7({
  ten, y, ds, kieu, phu, congTong = true,
}: {
  ten: string;
  y: string;
  ds: Ngay7[];
  kieu: "tien" | "so";
  phu?: string;
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

  // Luôn hai số, kể cả khi bằng nhau: bỏ bớt một bên thì mắt phải tự đoán ô
  // nào đang nói về cái gì, và ô có cấn trừ trông như ô lỗi. Dấu ở cuối để
  // quét dọc cả cột là thấy ngay ngày nào tiền về đủ, ngày nào phải trừ cọc.
  const oTien = (that: number, tong: number, dam = false) => {
    if (tong === 0) return <span className="muted">—</span>;
    const du = that === tong;
    return (
      <>
        <span className="muted">{n(that)}</span> / {dam ? <b>{n(tong)}</b> : n(tong)}
        <Dau du={du} chenh={tong - that} />
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
                  return (
                    <td key={d} className={`num mono${xenKe(i)}`}>
                      {kieu === "tien" ? (
                        oTien(giaTri(r, "that"), giaTri(r, "tien"))
                      ) : giaTri(r, "so") === 0 ? (
                        <span className="muted">—</span>
                      ) : (
                        n(giaTri(r, "so"))
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {congTong && chiSos.length > 1 && (
              <tr className="tong">
                <td>
                  <b>Tổng</b>
                </td>
                {ngays.map((d, i) => (
                  <td key={d} className={`num mono${xenKe(i)}`}>
                    {kieu === "tien" ? (
                      oTien(tongCot(d, "that"), tongCot(d, "tien"), true)
                    ) : tongCot(d, "so") === 0 ? (
                      <span className="muted">—</span>
                    ) : (
                      <b>{n(tongCot(d, "so"))}</b>
                    )}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {phu && <p className="muted">{phu}</p>}
    </section>
  );
}
