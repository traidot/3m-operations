import type { ChoMuon } from "@/lib/queries";

const n = (v: string | number) => Math.round(Number(v)).toLocaleString("vi-VN");
const thangVn = (ky: string) => `${ky.slice(5, 7)}/${ky.slice(0, 4)}`;

/**
 * Cho khách wifi cố định mượn máy cầm tay — chỗ hai hệ thống dính vào nhau.
 *
 * Khách ký wifi cố định nhưng chờ nhà mạng lắp hàng tháng, nên 3M cho mượn
 * một máy cầm tay dùng tạm và thu cọc. Lắp xong, khách trả máy, cọc chuyển
 * thành cước của hợp đồng cố định.
 *
 * Hai đầu của việc này nằm ở hai hệ: máy trả về trong kho cầm tay, tiền cấn
 * trừ trong sổ thu của cố định. Không có khoá nối trực tiếp nên bảng chỉ đặt
 * hai cột cạnh nhau theo tháng — đọc như một phép đối chiếu là sai.
 */
export function BangChoMuon({
  ds,
  giu,
  so,
}: {
  ds: ChoMuon[];
  giu: { dang_muon: string; da_tra: string; tat_ca: string };
  /** Số thứ tự mục, vì hai màn đánh số khác nhau. */
  so: number;
}) {
  if (ds.length === 0) return null;

  return (
    <section>
      <h2>
        {so} · Cho mượn máy cầm tay{" "}
        <span className="muted">— chỗ hai hệ thống dính vào nhau</span>
      </h2>
      <p className="muted">
        Khách ký wifi cố định nhưng chờ nhà mạng lắp hàng tháng, nên bên mình cho
        mượn một máy cầm tay dùng tạm và thu cọc. Lắp xong khách trả máy, cọc
        chuyển thành cước của hợp đồng cố định. Hiện <b>{n(giu.dang_muon)}</b> máy
        còn ở nhà khách, {n(giu.da_tra)} đã trả — tổng {n(giu.tat_ca)} lượt mượn.
        Mấy thuê bao này không sinh cước và không có hoá đơn bên cầm tay.
      </p>
      <div className="scroller">
        <table>
          <thead>
            <tr>
              <th>Tháng</th>
              <th className="num">Máy trả về kho</th>
              <th className="num">Đợt cấn trừ cọc</th>
              <th className="num">Tiền cấn trừ</th>
            </tr>
          </thead>
          <tbody>
            {ds.map((r) => (
              <tr key={r.ky}>
                <td className="mono">{thangVn(r.ky)}</td>
                <td className="num mono">
                  {Number(r.may_tra_ve) === 0 ? <span className="muted">—</span> : n(r.may_tra_ve)}
                </td>
                <td className="num mono">
                  {Number(r.dot_can_tru) === 0 ? (
                    <span className="muted">—</span>
                  ) : (
                    n(r.dot_can_tru)
                  )}
                </td>
                <td className="num mono muted">{n(r.tien_can_tru)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">
        Hai cột giữa là hai đầu của cùng một việc nhưng <b>không khớp một-một</b>:
        kho mới ghi lý do “wifi cố định trả về” từ tháng 8 nên các tháng trước
        trống, và việc cấn trừ có thể làm trước hoặc sau ngày trả máy. Đừng đọc
        chúng như một phép đối chiếu.
      </p>
    </section>
  );
}
