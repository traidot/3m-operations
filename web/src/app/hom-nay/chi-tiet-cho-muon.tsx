import { NganKeo } from "../ngan-keo";
import { getChoMuonCanTru, getChoMuonMayVe } from "@/lib/queries";

const n = (v: string | number | null) =>
  v === null ? "—" : Math.round(Number(v)).toLocaleString("vi-VN");

const ngayVn = (iso: string | null) =>
  iso === null ? "—" : `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

const thangVn = (ky: string) => `${ky.slice(5, 7)}/${ky.slice(0, 4)}`;

/** Máy cầm tay khách wifi cố định trả về kho trong một tháng. */
export async function ChiTietMayVe({ ky, dongLai }: { ky: string; dongLai: string }) {
  const rows = await getChoMuonMayVe(ky);

  return (
    <NganKeo dongLai={dongLai}>
      <h1>
        Máy trả về kho <span className="muted">· {thangVn(ky)}</span>
      </h1>
      <p className="muted">
        {n(rows.length)} máy cầm tay khách wifi cố định trả lại sau khi nhà mạng lắp
        xong. Đây là một đầu của việc cấn trừ cọc; đầu kia là đợt thu bên hợp đồng
        cố định, không nối trực tiếp với dòng nào ở đây.
      </p>

      {rows.length === 0 ? (
        <p className="muted">Tháng này không có máy nào trả về.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>IMEI</th>
              <th>Phiếu</th>
              <th>Ngày</th>
              <th>Khách</th>
              <th>Gói</th>
              <th>Kho nhận</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.source_id}>
                <td className="mono">{r.imei ?? "—"}</td>
                <td className="mono muted">{r.so_phieu ?? "—"}</td>
                <td className="mono muted">{ngayVn(r.ngay)}</td>
                <td className="muted">{r.khach ?? r.ma_khach ?? "—"}</td>
                <td className="muted">{r.goi ?? "—"}</td>
                <td className="muted">{r.kho ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </NganKeo>
  );
}

/** Nhãn đúng như màn Cập nhật thu cước phí bên CMS. */
const TRANG_THAI: Record<string, { ten: string; dang: string }> = {
  APPROVED: { ten: "Đã thu", dang: "" },
  PENDING_APPROVAL: { ten: "Chờ duyệt", dang: "warn" },
  REJECTED: { ten: "Bị từ chối", dang: "critical" },
};

/** Đợt thu kênh "cần trừ cọc" bên wifi cố định trong một tháng. */
export async function ChiTietCanTru({ ky, dongLai }: { ky: string; dongLai: string }) {
  const rows = await getChoMuonCanTru(ky);
  const tien = rows.reduce((t, r) => t + Number(r.tien), 0);

  return (
    <NganKeo dongLai={dongLai}>
      <h1>
        Cấn trừ cọc <span className="muted">· {thangVn(ky)}</span>
      </h1>
      <p className="muted">
        {n(rows.length)} đợt, <b>{n(tien)}</b> yên cọc chuyển thành cước của hợp đồng
        cố định. Tiền này không có đồng nào mới vào ngân hàng — khách đã nộp từ
        trước lúc mượn máy.
      </p>

      {rows.length === 0 ? (
        <p className="muted">Tháng này không có đợt cấn trừ nào.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Hợp đồng</th>
              <th>Kỳ cước</th>
              <th className="num">Tiền</th>
              <th>Ngày</th>
              <th>Trạng thái</th>
              <th>Người gõ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const tt = r.status === null ? undefined : TRANG_THAI[r.status];
              return (
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
                  <td className="mono muted">{r.ky_cuoc ?? "—"}</td>
                  <td className="num mono">{n(r.tien)}</td>
                  <td className="mono muted">{ngayVn(r.ngay)}</td>
                  <td>
                    {tt === undefined ? (
                      <span className="muted">{r.status ?? "—"}</span>
                    ) : (
                      <span className={tt.dang === "" ? "tag" : `tag ${tt.dang}`}>{tt.ten}</span>
                    )}
                  </td>
                  <td className="muted">{r.nguoi_go ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </NganKeo>
  );
}
