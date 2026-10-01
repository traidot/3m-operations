import type { BaoCaoNgay } from "@/lib/queries";

const n = (v: string | number | null) =>
  v === null ? "—" : Math.round(Number(v)).toLocaleString("vi-VN");

/**
 * So hôm nay với trung bình 7 ngày. Null khi nền quá nhỏ — chia cho số gần 0
 * ra vài nghìn phần trăm, thành báo động giả mỗi khi hôm trước không có gì.
 */
export function lech(homNay: number, tb: number): number | null {
  if (tb < 1) return null;
  return Math.round(((homNay - tb) / tb) * 100);
}

/** Ngưỡng coi là đáng nhìn, dùng chung cho mọi trang báo cáo ngày. */
const DANG_NHIN = 50;

export type Cot = "tien" | "so";

/**
 * Một nhóm chỉ số. `cot` quyết định bảng đọc cột tiền hay cột số lượng —
 * nhóm tiền thì số đợt là phụ, nhóm hợp đồng thì ngược lại.
 */
export function BangNgay({
  ten, y, ds, cot, phu,
}: {
  ten: string;
  y: string;
  ds: BaoCaoNgay[];
  cot: Cot;
  phu?: string;
}) {
  const lay = (r: BaoCaoNgay, k: "hom_nay" | "hom_qua" | "tb_7") =>
    Number(cot === "tien" ? r[`tien_${k}`] : r[`so_${k}`]);
  // Dòng cả ba mốc đều 0 là tài khoản đã ngừng dùng — để lại chỉ tổ làm rối
  // bảng mà không nói thêm điều gì.
  ds = ds.filter((r) => lay(r, "hom_nay") || lay(r, "hom_qua") || lay(r, "tb_7"));
  if (ds.length === 0) return null;
  const tong = (k: "hom_nay" | "hom_qua" | "tb_7") =>
    ds.reduce((t, r) => t + lay(r, k), 0);

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
              <th className="num">Hôm nay</th>
              <th className="num">Hôm qua</th>
              <th className="num">TB 7 ngày</th>
              <th className="num">Lệch</th>
              {cot === "tien" && <th className="num">Số lượt</th>}
            </tr>
          </thead>
          <tbody>
            {ds.map((r) => {
              const nay = lay(r, "hom_nay");
              const d = lech(nay, lay(r, "tb_7"));
              // Lệch xuống cũng tô: ngày không ai huỷ bất thường như ngày
              // huỷ gấp đôi.
              const dam = d !== null && Math.abs(d) >= DANG_NHIN;
              return (
                <tr key={r.chi_so}>
                  <td>
                    {r.chi_so}
                    {cot === "so" && <span className="muted"> · {r.don_vi}</span>}
                  </td>
                  <td className={`num mono${dam ? " bad" : ""}`}>{n(nay)}</td>
                  <td className="num mono muted">{n(lay(r, "hom_qua"))}</td>
                  <td className="num mono muted">{n(lay(r, "tb_7"))}</td>
                  <td className={`num mono${dam ? " bad" : " muted"}`}>
                    {d === null ? "—" : `${d > 0 ? "+" : ""}${d}%`}
                  </td>
                  {cot === "tien" && (
                    <td className="num mono muted">{n(r.so_hom_nay)}</td>
                  )}
                </tr>
              );
            })}
            {ds.length > 1 && (
              <tr className="tong">
                <td>
                  <b>Tổng</b>
                </td>
                <td className="num mono">
                  <b>{n(tong("hom_nay"))}</b>
                </td>
                <td className="num mono muted">{n(tong("hom_qua"))}</td>
                <td className="num mono muted">{n(tong("tb_7"))}</td>
                <td className="num mono muted">
                  {(() => {
                    const d = lech(tong("hom_nay"), tong("tb_7"));
                    return d === null ? "—" : `${d > 0 ? "+" : ""}${d}%`;
                  })()}
                </td>
                {cot === "tien" && <td />}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {phu && <p className="muted">{phu}</p>}
    </section>
  );
}
