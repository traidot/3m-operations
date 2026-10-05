import { NganKeo } from "../ngan-keo";
import { getTramChiTiet } from "@/lib/queries";
import { NGHEN_NGAY, TRAM_VAN_HANH } from "@/lib/nhan";

const n = (v: string | number | null) =>
  v === null ? "—" : Math.round(Number(v)).toLocaleString("vi-VN");

/** Ngăn kéo cũng phải có trần, không thì trạm nghìn dòng làm treo trang. */
const TRAN = 300;

/**
 * Danh sách việc đang nằm ở một trạm.
 *
 * Nguồn là v_tram_chi_tiet — chính cái mà bảng trạm gom lên — nên số dòng ở
 * đây bằng đúng cột "đang nằm", trừ khi chạm trần.
 */
export async function ChiTietTram({
  tram,
  ton,
  quaLau,
  tien,
  dongLai,
}: {
  tram: string;
  /**
   * Ba con số lấy từ bảng trạm, KHÔNG đếm lại trên danh sách: ngăn kéo cắt ở
   * 300 dòng nên tự đếm sẽ ra "300 cái quá 90 ngày" trong khi bảng nói 389, và
   * tiền thì hụt hơn một nửa. Hai chỗ nói hai số là mất lòng tin vào cả hai.
   */
  ton: number;
  quaLau: number | null;
  tien: string | null;
  dongLai: string;
}) {
  const b = TRAM_VAN_HANH[tram];
  if (b === undefined) return null;
  const rows = await getTramChiTiet(tram);

  const coNguoi = rows.some((r) => r.nguoi !== null);
  const coTuoi = rows.some((r) => r.tuoi_ngay !== null);
  // CHO_HEN đếm ngày còn lại nên "nằm lâu" không có nghĩa ở đó.
  const demLau = tram !== "CHO_HEN";
  const lau = quaLau ?? 0;
  const soTien = Number(tien ?? 0);

  return (
    <NganKeo dongLai={dongLai}>
      <h1>{b.ten}</h1>
      <p className="muted">
        {b.y}. <b>{n(ton)}</b> việc đang nằm ở trạm này
        {demLau && lau > 0 && (
          <>
            , {n(lau)} cái đã quá {NGHEN_NGAY} ngày
          </>
        )}
        {b.cot_tien !== null && soTien > 0 && (
          <>
            , kèm <b>{n(soTien)}</b> yên
          </>
        )}
        .
        {rows.length < ton && (
          <>
            {" "}
            Ngăn kéo dừng ở {TRAN} dòng {demLau ? "già nhất" : "gần hẹn nhất"};
            làm hết chỗ này rồi mở lại sẽ thấy tiếp.
          </>
        )}
      </p>

      {rows.length === 0 ? (
        <p className="muted">
          <b>Không còn việc nào.</b>
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              {coTuoi && <th className="num">{b.cot_tuoi}</th>}
              <th>{b.cot_ma}</th>
              <th>{b.cot_ai}</th>
              {b.cot_tien !== null && <th className="num">{b.cot_tien}</th>}
              {coNguoi && <th>Người nhập</th>}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.tram}-${r.id}`}>
                {coTuoi && (
                  <td
                    className={`num mono${
                      demLau && (r.tuoi_ngay ?? 0) > NGHEN_NGAY ? " bad" : ""
                    }`}
                  >
                    {r.tuoi_ngay === null ? (
                      <span className="muted">—</span>
                    ) : (
                      <>
                        <b>{n(r.tuoi_ngay)}</b>{" "}
                        <span className="muted">ngày</span>
                      </>
                    )}
                  </td>
                )}
                <td className="mono">{r.ma ?? "—"}</td>
                <td className="muted">{r.ai ?? "—"}</td>
                {b.cot_tien !== null && (
                  <td className="num mono">{n(r.tien)}</td>
                )}
                {coNguoi && <td className="muted">{r.nguoi ?? "—"}</td>}
                <td className="khong-xuong-dong">
                  {r.url !== null && (
                    <a href={r.url} target="_blank" rel="noreferrer">
                      mở →
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </NganKeo>
  );
}
