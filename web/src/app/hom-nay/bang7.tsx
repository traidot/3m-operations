import type { Ngay7 } from "@/lib/queries";

const n = (v: string | number) => Math.round(Number(v)).toLocaleString("vi-VN");

/** Cột ngày tô nền xen kẽ: bảy cột số trần nằm cạnh nhau thì mắt dò theo một
 *  hàng rất dễ lạc sang ngày bên cạnh. */
const xenKe = (i: number) => (i % 2 === 1 ? " o-le" : "");

/** Nhãn cột: ngày trong tháng, hôm nay ghi rõ để khỏi đếm ngược. */
const nhanCot = (iso: string, homNay: string) =>
  iso === homNay ? "hôm nay" : iso.slice(8, 10) + "/" + iso.slice(5, 7);

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
  // nào đang nói về cái gì, và ô có cấn trừ trông như ô lỗi.
  const oTien = (r: Ngay7 | undefined) => {
    const tong = giaTri(r, "tien");
    if (tong === 0) return <span className="muted">—</span>;
    return (
      <>
        <span className="muted">{n(giaTri(r, "that"))}</span> / {n(tong)}
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
                        oTien(r)
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
                      tongCot(d, "tien") === 0 ? (
                        <span className="muted">—</span>
                      ) : (
                        <>
                          <span className="muted">{n(tongCot(d, "that"))}</span>{" "}
                          / <b>{n(tongCot(d, "tien"))}</b>
                        </>
                      )
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
