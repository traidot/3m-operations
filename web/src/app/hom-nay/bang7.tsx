import type { Ngay7 } from "@/lib/queries";

const n = (v: string | number) => Math.round(Number(v)).toLocaleString("vi-VN");

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
  ten, y, ds, kieu, phu,
}: {
  ten: string;
  y: string;
  ds: Ngay7[];
  kieu: "tien" | "so";
  phu?: string;
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

  const oTien = (r: Ngay7 | undefined) => {
    const tong = giaTri(r, "tien");
    const that = giaTri(r, "that");
    if (tong === 0) return <span className="muted">—</span>;
    // Bằng nhau thì không có gì cấn trừ, ghi một số cho đỡ rối mắt.
    if (that === tong) return n(tong);
    return (
      <>
        <span className="muted">{n(that)}</span> / {n(tong)}
      </>
    );
  };

  return (
    <section>
      <h2>
        {ten} <span className="muted">— {y}</span>
      </h2>
      <div className="scroller">
        <table>
          <thead>
            <tr>
              <th>Chỉ số</th>
              {ngays.map((d) => (
                <th key={d} className="num">
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
                {ngays.map((d) => {
                  const r = o.get(`${cs}|${d}`);
                  return (
                    <td key={d} className="num mono">
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
            {chiSos.length > 1 && (
              <tr className="tong">
                <td>
                  <b>Tổng</b>
                </td>
                {ngays.map((d) => (
                  <td key={d} className="num mono">
                    {kieu === "tien" ? (
                      tongCot(d, "tien") === 0 ? (
                        <span className="muted">—</span>
                      ) : tongCot(d, "that") === tongCot(d, "tien") ? (
                        <b>{n(tongCot(d, "tien"))}</b>
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
