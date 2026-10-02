import type { GmoLoai, GmoThang } from "@/lib/queries";

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
export function BangGmoThang({ ds, loai }: { ds: GmoThang[]; loai: GmoLoai[] }) {
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
        nhỏ thì con số chưa nói lên gì. Bảng không cộng tiền: hỏng mã thì người
        ta tạo lại cho đúng khoản đó, có hợp đồng tạo tới bốn lần, nên cộng tiền
        từng lần là nhân bản cùng một khoản nợ. Cột <b>hợp đồng dính</b> đếm
        không trùng.
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
              <th className="num">Hợp đồng dính</th>
              <th className="num">Tỷ lệ chết</th>
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
                  <td className="num mono muted">
                    {Number(r.hop_dong_hong) === 0 ? "—" : n(r.hop_dong_hong)}
                  </td>
                  <td className={`num mono${tl !== null && tl >= DANG_LO ? " bad" : ""}`}>
                    {tl === null ? "chưa rõ" : `${tl}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3>Mã đó thu cái gì</h3>
      <p className="muted">
        Ô “Loại” lúc tạo mã và ghi chú tự do không phải lúc nào cũng khớp: có
        lần tạo ghi rõ “Cọc TP Link” mà vẫn để ô Loại là cước, lại có 49 lần
        chọn Cọc nhưng bỏ trống ghi chú. Bảng lấy ghi chú làm chuẩn khi nó có
        nói, còn lại theo ô Loại — nên nhóm cuối để riêng chứ không gộp vào cọc
        TP Link, dù số tiền đều rơi đúng mức 2.000–3.000.
      </p>
      <div className="scroller">
        <table>
          <thead>
            <tr>
              <th>Thu cái gì</th>
              <th className="num">Lần tạo</th>
              <th className="num">Khách đã trả</th>
              <th className="num">Hết hạn</th>
              <th className="num">Đang chờ</th>
              <th className="num">Tỷ lệ chết</th>
              <th className="num">Tiền đã thu</th>
            </tr>
          </thead>
          <tbody>
            {loai.map((r) => {
              const tl = r.ty_le_chet === null ? null : Number(r.ty_le_chet);
              return (
                <tr key={r.nhom_tien}>
                  <td>{r.ten}</td>
                  <td className="num mono muted">{n(r.lan)}</td>
                  <td className="num mono">{n(r.da_tra)}</td>
                  <td className="num mono">{n(r.chet)}</td>
                  <td className="num mono muted">
                    {Number(r.dang_cho) === 0 ? "—" : n(r.dang_cho)}
                  </td>
                  <td className={`num mono${tl !== null && tl >= DANG_LO ? " bad" : ""}`}>
                    {tl === null ? "chưa rõ" : `${tl}%`}
                  </td>
                  <td className="num mono muted">{n(r.tien_tra ?? 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
