import Link from "next/link";
import {
  getCanhBaoVanHanh,
  getNoThatCoDinh,
  type CanhBaoVanHanh,
} from "@/lib/queries";
import {
  CANH_BAO_VAN_HANH,
  NHOM_CANH_BAO,
  THU_TU_NHOM_CANH_BAO,
} from "@/lib/nhan";

export const dynamic = "force-dynamic";

const n = (v: string | number | null) =>
  v === null ? null : Math.round(Number(v)).toLocaleString("vi-VN");

/** Chờ quá ngần này ngày thì không còn là "đang xử lý" nữa. */
const QUA_LAU = 30;

/**
 * Một bảng cho cả mảng wifi cố định: đang tồn những cảnh báo gì, bao nhiêu,
 * bao nhiêu tiền, cái cũ nhất nằm bao lâu, và bấm vào thì đi đâu để xử lý.
 *
 * Các cảnh báo vẫn nằm rải ở nhiều màn — màn này không thay chúng, chỉ đếm.
 * Mỗi dòng trỏ sang đúng màn đã có, vì mỗi loại cần một bộ cột khác nhau.
 */
export default async function Page() {
  const [rows, [no]] = await Promise.all([getCanhBaoVanHanh(), getNoThatCoDinh()]);
  const biet = (r: CanhBaoVanHanh) => CANH_BAO_VAN_HANH[r.ma];

  // Loại nào có trong view mà chưa có nhãn thì vẫn phải hiện, kẻo thêm cảnh báo
  // bên SQL rồi tưởng đã lên màn hình.
  const laDu = rows.filter((r) => biet(r) === undefined);

  const theoNhom = (nhom: string) =>
    rows
      .filter((r) => biet(r)?.nhom === nhom)
      .sort((a, b) => b.so_luong - a.so_luong);

  const dangTon = rows.filter((r) => r.so_luong > 0).length;

  return (
    <main>
      <h1>Cảnh báo vận hành — wifi cố định</h1>
      <p className="muted">
        {dangTon}/{rows.length} loại đang có việc. Nợ thật đang phải đi đòi là{" "}
        <b>{n(no?.tien ?? null) ?? "—"}</b> yên ở {n(no?.hop_dong ?? 0)} hợp
        đồng — số này đếm một lần cho mỗi hợp đồng nên mới là tổng.
      </p>
      <p className="muted">
        <b>Đừng cộng cột tiền theo chiều dọc.</b> Mỗi loại đo một thứ khác nhau,
        và cùng một khoản có thể nằm ở nhiều dòng: hợp đồng vừa nợ nặng vừa có
        mã combini hết hạn thì khoản nợ đó được kể ở cả hai chỗ. Cộng hết lại ra
        1.071.548 nhưng 68.000 trong đó bị đếm hai ba lần.
      </p>
      <p className="muted">
        Dòng nào <b>0</b> là sạch thật — bảng cố tình giữ cả loại đang sạch, vì
        bảng tự bỏ dòng thì không phân biệt được “hết việc” với “câu đếm hỏng”.
        Chỉ tính phần <b>công ty</b>; hợp đồng đại lý không nằm ở đây. Mỗi dòng
        bấm được, sang đúng màn xử lý loại đó.
      </p>

      {laDu.length > 0 && (
        <p className="tag critical">
          {laDu.length} loại chưa có nhãn ở nhan.ts: {laDu.map((r) => r.ma).join(", ")}
        </p>
      )}

      {THU_TU_NHOM_CANH_BAO.map((nhom) => {
        const ds = theoNhom(nhom);
        if (ds.length === 0) return null;

        return (
          <section key={nhom}>
            <h2>
              {NHOM_CANH_BAO[nhom]!.ten}{" "}
              <span className="muted">— {NHOM_CANH_BAO[nhom]!.y}</span>
            </h2>
            <table>
              <thead>
                <tr>
                  <th>Cảnh báo</th>
                  <th className="num">Số lượng</th>
                  <th className="num">Hợp đồng</th>
                  <th className="num">Tiền</th>
                  <th className="num">Cũ nhất</th>
                </tr>
              </thead>
              <tbody>
                {ds.map((r) => {
                  const b = biet(r)!;
                  const sach = r.so_luong === 0;
                  const lau = (r.cu_nhat_ngay ?? 0) >= QUA_LAU;
                  return (
                    <tr key={r.ma}>
                      <td>
                        {sach ? (
                          <b className="muted">{b.ten}</b>
                        ) : (
                          <Link href={b.di} className="o-mo">
                            <b>{b.ten}</b>
                          </Link>
                        )}
                        <div className="muted">{b.y}</div>
                      </td>
                      <td className={`num mono${sach ? " muted" : ""}`}>
                        {sach ? (
                          "— sạch"
                        ) : (
                          <>
                            <b>{n(r.so_luong)}</b>{" "}
                            <span className="muted">{r.don_vi}</span>
                          </>
                        )}
                      </td>
                      <td className="num mono muted">
                        {/* Chỉ ghi khi khác số lượng, không thì là nhắc lại. */}
                        {sach || r.so_hop_dong === r.so_luong
                          ? "—"
                          : n(r.so_hop_dong)}
                      </td>
                      <td className="num mono">
                        {r.tien === null ? (
                          <span className="muted" title="loại này không quy ra tiền được">
                            không tính được
                          </span>
                        ) : (
                          <b>{n(r.tien)}</b>
                        )}
                      </td>
                      <td className={`num mono${lau ? " bad" : " muted"}`}>
                        {r.cu_nhat_ngay === null
                          ? "—"
                          : `${n(r.cu_nhat_ngay)} ngày`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}
    </main>
  );
}
