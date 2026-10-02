import type { GmoThang } from "@/lib/queries";

const n = (v: string | number | null) =>
  v === null ? "—" : Math.round(Number(v)).toLocaleString("vi-VN");

const thangVn = (ky: string) => `${ky.slice(5, 7)}/${ky.slice(0, 4)}`;

/** Tỷ lệ chết từ mức này trở lên thì tô đỏ. */
const DANG_LO = 25;

/**
 * Mã combini theo tháng tạo.
 *
 * Tỷ lệ chết tính trên phần ĐÃ CÓ KẾT CỤC, không phải trên tổng số mã tạo ra:
 * mã vừa tạo hôm qua chưa tới hạn thì chưa biết khách có trả hay không. Lấy
 * số đã trả chia tổng thì tháng đang chạy nào cũng trông tệ, rồi "đẹp dần lên"
 * khi các mã lần lượt hết hạn — một xu hướng không có thật.
 */
export function BangGmoThang({ ds }: { ds: GmoThang[] }) {
  if (ds.length === 0) return null;

  return (
    <section>
      <h2>
        6 · Mã combini theo tháng{" "}
        <span className="muted">— bao nhiêu mã tạo ra rồi chết</span>
      </h2>
      <p className="muted">
        Mỗi lần tạo mã sinh bốn mã combini cùng số tiền, khách trả ở một chỗ là
        xong, nên bảng đếm theo <b>lần tạo</b> chứ không theo mã. Cột{" "}
        <b>đang chờ</b> là mã còn trong hạn, chưa biết khách có trả hay không —
        nên tỷ lệ chết chỉ tính trên phần đã ngã ngũ, tháng mới mở mẫu số còn
        nhỏ thì con số chưa nói lên gì.
      </p>
      <div className="scroller">
        <table>
          <thead>
            <tr>
              <th>Tháng tạo</th>
              <th className="num">Tạo</th>
              <th className="num">Khách đã trả</th>
              <th className="num">Hết hạn, không trả</th>
              <th className="num">Còn đang chờ</th>
              <th className="num">Tỷ lệ chết</th>
              <th className="num">Tiền chết</th>
            </tr>
          </thead>
          <tbody>
            {ds.map((r) => {
              const tl = r.ty_le_chet === null ? null : Number(r.ty_le_chet);
              return (
                <tr key={r.thang}>
                  <td className="mono">{thangVn(r.thang)}</td>
                  <td className="num mono muted">{n(r.tao)}</td>
                  <td className="num mono">{n(r.da_tra)}</td>
                  <td className="num mono">{n(r.chet)}</td>
                  <td className="num mono muted">
                    {Number(r.dang_cho) === 0 ? "—" : n(r.dang_cho)}
                  </td>
                  <td className={`num mono${tl !== null && tl >= DANG_LO ? " bad" : ""}`}>
                    {tl === null ? "chưa rõ" : `${tl}%`}
                  </td>
                  <td className="num mono muted">{n(r.tien_chet ?? 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
