import { Fragment } from "react";
import type { GmoThang, GmoThangLoai } from "@/lib/queries";

const n = (v: string | number | null) =>
  v === null ? "—" : Math.round(Number(v)).toLocaleString("vi-VN");

const thangVn = (ky: string) => `${ky.slice(5, 7)}/${ky.slice(0, 4)}`;

/** Tỷ lệ chết từ mức này trở lên thì tô đỏ. */
const DANG_LO = 25;

/**
 * Mã combini theo tháng tạo, mỗi tháng tách tiếp theo thứ đang thu.
 *
 * Một bảng chứ không phải hai: cắt theo tháng rồi cắt theo loại ở hai bảng
 * riêng thì không trả lời được "tháng 9 mã thu cọc chết bao nhiêu", phải tự
 * nhân chéo trong đầu.
 *
 * Tỷ lệ chết tính trên phần ĐÃ CÓ KẾT CỤC, không phải trên tổng số mã tạo ra:
 * mã vừa tạo hôm qua chưa tới hạn thì chưa biết khách có trả hay không. Lấy
 * số đã trả chia tổng thì tháng đang chạy nào cũng trông tệ, rồi "đẹp dần lên"
 * khi các mã lần lượt hết hạn — một xu hướng không có thật.
 */
export function BangGmoThang({
  ds,
  o,
  cocMo,
}: {
  ds: GmoThang[];
  o: GmoThangLoai[];
  /** Nhóm "cọc không ghi rõ" nghiêng về đâu, để người đọc khỏi tự đoán. */
  cocMo: { lan: string; co_dau_hieu_tplink: string };
}) {
  if (ds.length === 0) return null;

  const oTyLe = (v: string | null) => {
    const tl = v === null ? null : Number(v);
    return (
      <td className={`num mono${tl !== null && tl >= DANG_LO ? " bad" : ""}`}>
        {tl === null ? "chưa rõ" : `${tl}%`}
      </td>
    );
  };

  return (
    <section>
      <h2>
        6 · Mã combini{" "}
        <span className="muted">— bao nhiêu mã tạo ra rồi chết, và thu cái gì</span>
      </h2>
      <p className="muted">
        Mỗi lần tạo mã sinh bốn mã combini cùng số tiền, khách trả ở một chỗ là
        xong, nên bảng đếm theo <b>lần tạo</b> chứ không theo mã. Cột{" "}
        <b>đang chờ</b> là mã còn trong hạn, chưa biết khách có trả hay không —
        nên tỷ lệ chết chỉ tính trên phần đã ngã ngũ. Bảng không cộng tiền: hỏng
        mã thì người ta tạo lại cho đúng khoản đó, có hợp đồng tạo tới bốn lần,
        nên cộng tiền từng lần là nhân bản cùng một khoản nợ — cột{" "}
        <b>hợp đồng dính</b> đếm không trùng.
      </p>
      <p className="muted">
        Phân loại lấy ghi chú làm chuẩn khi nó có nói, còn lại theo ô “Loại” lúc
        tạo mã: hai nguồn này không phải lúc nào cũng khớp, có lần ghi rõ “Cọc TP
        Link” mà vẫn để ô Loại là cước. Nhóm <b>cọc không ghi rõ</b> để riêng chứ
        không gộp — trong {n(cocMo.lan)} lần tạo của nhóm đó chỉ{" "}
        <b>{n(cocMo.co_dau_hieu_tplink)}</b> cái có dấu hiệu TP Link từ chỗ khác,
        số còn lại không có gì để dựa vào ngoài mức tiền.
      </p>
      <div className="scroller">
        <table>
          <thead>
            <tr>
              <th>Tháng tạo</th>
              <th>Thu cái gì</th>
              <th className="num">Lần tạo</th>
              <th className="num">Khách đã trả</th>
              <th className="num">Hết hạn</th>
              <th className="num">Đang chờ</th>
              <th className="num">Hợp đồng dính</th>
              <th className="num">Tỷ lệ chết</th>
            </tr>
          </thead>
          <tbody>
            {ds.map((t) => {
              const con = o.filter((r) => r.thang === t.thang);
              return (
                <Fragment key={t.thang}>
                  <tr className="tong">
                    <td rowSpan={con.length + 1} className="mono">
                      {thangVn(t.thang)}
                    </td>
                    <td className="muted">cả tháng</td>
                    <td className="num mono">
                      <b>{n(t.tao)}</b>
                    </td>
                    <td className="num mono">
                      <b>{n(t.da_tra)}</b>
                    </td>
                    <td className="num mono">
                      <b>{n(t.chet)}</b>
                    </td>
                    <td className="num mono muted">
                      {Number(t.dang_cho) === 0 ? "—" : n(t.dang_cho)}
                    </td>
                    <td className="num mono muted">
                      {Number(t.hop_dong_hong) === 0 ? "—" : n(t.hop_dong_hong)}
                    </td>
                    {oTyLe(t.ty_le_chet)}
                  </tr>
                  {con.map((r) => (
                    <tr key={r.nhom_tien}>
                      <td>{r.ten}</td>
                      <td className="num mono muted">{n(r.tao)}</td>
                      <td className="num mono muted">{n(r.da_tra)}</td>
                      <td className="num mono muted">{n(r.chet)}</td>
                      <td className="num mono muted">
                        {Number(r.dang_cho) === 0 ? "—" : n(r.dang_cho)}
                      </td>
                      <td className="num mono muted">
                        {Number(r.hop_dong_hong) === 0 ? "—" : n(r.hop_dong_hong)}
                      </td>
                      {oTyLe(r.ty_le_chet)}
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
