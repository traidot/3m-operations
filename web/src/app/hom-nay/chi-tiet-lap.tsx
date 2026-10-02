import { NganKeo } from "../ngan-keo";
import { getLapQuaHanDs } from "@/lib/queries";

const n = (v: string | number | null) =>
  v === null ? "—" : Math.round(Number(v)).toLocaleString("vi-VN");

const ngayVn = (iso: string | null) =>
  iso === null ? "—" : `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** Trễ bao nhiêu ngày thì coi là tồn đọng chứ không còn là chậm vài hôm. */
const DONG_CU = 30;
/** Bảng dài quá thì không ai cuộn hết; phần đuôi cũng là các đơn trễ ít nhất. */
const TOI_DA = 200;

/**
 * Đơn lắp đã qua ngày hẹn mà chưa xong.
 *
 * Xếp theo số ngày trễ giảm dần chứ không theo ngày hẹn: đống này tồn từ đầu
 * năm, cái cần gọi trước là cái nằm lâu nhất.
 */
export async function ChiTietLapQuaHan({ dongLai }: { dongLai: string }) {
  const tatCa = await getLapQuaHanDs();
  const rows = tatCa.slice(0, TOI_DA);
  const cu = tatCa.filter((r) => Number(r.tre_ngay) >= DONG_CU).length;

  return (
    <NganKeo dongLai={dongLai}>
      <h1>Đơn lắp quá hạn</h1>
      <p className="muted">
        {n(tatCa.length)} đơn đã qua ngày hẹn mà chưa lắp xong, trong đó{" "}
        <b>{n(cu)}</b> đơn trễ từ {DONG_CU} ngày trở lên — phần này là tồn đọng cũ
        chứ không phải việc tuần nay.
        {tatCa.length > TOI_DA && ` Bảng hiện ${n(TOI_DA)} đơn trễ lâu nhất.`}
      </p>

      <table>
        <thead>
          <tr>
            <th>Hợp đồng</th>
            <th>Địa chỉ</th>
            <th>Hẹn lắp</th>
            <th className="num">Trễ</th>
            <th>Phụ trách</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.source_id}>
              <td className="mono">
                {r.url === null ? (
                  (r.ma_hd ?? "—")
                ) : (
                  <a href={r.url} target="_blank" rel="noreferrer">
                    {r.ma_hd ?? "mở CMS"}
                  </a>
                )}
              </td>
              <td className="muted">{r.dia_chi ?? "—"}</td>
              <td className="mono muted">{ngayVn(r.ngay_hen)}</td>
              <td className={`num mono${Number(r.tre_ngay) >= DONG_CU ? " bad" : ""}`}>
                {n(r.tre_ngay)} ngày
              </td>
              <td className="muted">{r.nguoi_phu_trach ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </NganKeo>
  );
}
