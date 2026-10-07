import Link from "next/link";
import { getBaoCaoNgay, getFindings, getFreshness, type BaoCaoNgay } from "@/lib/queries";

const n = (v: string | number | null) =>
  v === null ? "—" : Math.round(Number(v)).toLocaleString("vi-VN");

/** Nhóm nào đặt trên cùng — tiền trước, vì trang này xem vào mỗi sáng. */
const NHOM: { ma: string; ten: string; y: string; tien: boolean }[] = [
  { ma: "tien", ten: "Tiền vào hôm nay", y: "đã nhận được bao nhiêu", tien: true },
  { ma: "no", ten: "Công nợ phát sinh", y: "hoá đơn vừa xuất, sẽ phải đi đòi", tien: true },
  { ma: "moi", ten: "Khách mới", y: "ký, kích hoạt, lắp xong", tien: false },
  { ma: "huy", ten: "Mất khách", y: "dừng dịch vụ trong ngày", tien: false },
  { ma: "kho", ten: "Kho", y: "thiết bị ra vào trong ngày", tien: false },
];

/**
 * So hôm nay với trung bình 7 ngày. Trả về phần trăm lệch, hoặc null khi nền
 * quá nhỏ — chia cho số gần 0 thì ra vài nghìn phần trăm, đọc thành báo động
 * giả mỗi khi hôm trước không có gì.
 */
function lech(homNay: number, tb: number): number | null {
  if (tb < 1) return null;
  return Math.round(((homNay - tb) / tb) * 100);
}

function Muc({ r, tien }: { r: BaoCaoNgay; tien: boolean }) {
  const nay = Number(tien ? r.tien_hom_nay : r.so_hom_nay);
  const qua = Number(tien ? r.tien_hom_qua : r.so_hom_qua);
  const tb = Number(tien ? r.tien_tb_7 : r.so_tb_7);
  const d = lech(nay, tb);
  // Ít hơn hẳn mọi ngày là dấu hiệu đáng nhìn, kể cả ở nhóm "mất khách":
  // ngày không ai huỷ cũng bất thường như ngày huỷ gấp đôi.
  const dam = d !== null && Math.abs(d) >= 50;
  return (
    <tr>
      <td>
        {r.chi_so}
        {!tien && <span className="muted"> · {r.don_vi}</span>}
      </td>
      <td className={`num mono${dam ? " bad" : ""}`}>{n(nay)}</td>
      <td className="num mono muted">{n(qua)}</td>
      <td className="num mono muted">{n(tb)}</td>
      <td className={`num mono${dam ? " bad" : " muted"}`}>
        {d === null ? "—" : `${d > 0 ? "+" : ""}${d}%`}
      </td>
    </tr>
  );
}

export async function NoiDungHomNayChung() {
  const [rows, findings, freshness] = await Promise.all([
    getBaoCaoNgay(),
    getFindings(),
    getFreshness(),
  ]);

  // Số trên trang chỉ đúng khi kho vừa đồng bộ; nguồn chết âm thầm thì mọi
  // dòng "hôm nay" đều bằng 0 mà nhìn như một ngày ế.
  const cu = freshness.filter(
    (f) => f.lan_dong_bo_cuoi === null || Number(f.gio_ke_tu_lan_cuoi) > Number(f.nguong_gio),
  );

  const hom_nay = new Date().toLocaleDateString("vi-VN", {
    weekday: "long", day: "2-digit", month: "2-digit", year: "numeric",
  });

  return (
    <>
      <p className="muted">
        {hom_nay}. Mỗi dòng là chuyện xảy ra trong ngày, đặt cạnh <b>hôm qua</b> và{" "}
        <b>trung bình 7 ngày</b> trước đó để biết nhiều hay ít. Cột cuối là phần trăm
        lệch so với trung bình; lệch từ 50% trở lên thì tô đỏ, kể cả lệch xuống —
        ngày không ai huỷ cũng bất thường như ngày huỷ gấp đôi.
      </p>

      {cu.length > 0 && (
        <p className="stale">
          <b>Số dưới đây có thể đã cũ.</b> Chưa đồng bộ kịp:{" "}
          {cu.map((f) => `${f.source}·${f.table_name}`).join(", ")}. <Link href="/dong-bo">Xem đồng bộ →</Link>
        </p>
      )}

      {findings.length > 0 && (
        <p className="ly-do">
          <b>{findings.length} việc cần xử lý</b> đang chờ —{" "}
          <Link href="/">xem Bản tin →</Link>
        </p>
      )}

      {NHOM.map((g) => {
        const ds = rows.filter((r) => r.nhom === g.ma);
        if (ds.length === 0) return null;
        return (
          <section key={g.ma}>
            <h2>
              {g.ten} <span className="muted">— {g.y}</span>
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
                  </tr>
                </thead>
                <tbody>
                  {ds.map((r) => (
                    <Muc key={r.chi_so} r={r} tien={g.tien} />
                  ))}
                </tbody>
              </table>
            </div>
            {g.tien && (
              <p className="muted">
                Số tiền, đơn vị yên. Cột số lượng xem ở nhóm dưới nếu cần.
              </p>
            )}
          </section>
        );
      })}
    </>
  );
}
