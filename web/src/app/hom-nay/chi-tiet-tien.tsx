import { NganKeo } from "../ngan-keo";
import { getDotThuNgay } from "@/lib/queries";

const n = (v: string | number | null) =>
  v === null ? "—" : Math.round(Number(v)).toLocaleString("vi-VN");

const ngayVn = (iso: string | null) =>
  iso === null ? "—" : `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Nhãn đúng như màn Cập nhật thu cước phí bên CMS, để đọc hai bên không lệch. */
const TRANG_THAI: Record<string, { ten: string; dang: string }> = {
  // Đã thu là trạng thái bình thường nên để nhãn xám; chỉ cái đang chờ và cái
  // bị chặn mới tô màu, không thì cả cột sặc sỡ và chẳng còn gì nổi lên.
  APPROVED: { ten: "Đã thu", dang: "" },
  PENDING_APPROVAL: { ten: "Chờ duyệt", dang: "warn" },
  REJECTED: { ten: "Bị từ chối", dang: "critical" },
};

/**
 * Chi tiết một ô của bảng "Tiền về theo ngày": mọi đợt thu của một tài khoản
 * trong một ngày.
 *
 * Danh sách này phải cộng ra đúng con số trong ô, nên nó đọc từ cùng một
 * nguồn và cùng điều kiện (xem db/187) — người xem tin ô hay tin danh sách
 * cũng ra một kết quả.
 */
export async function ChiTietTien({
  kenh,
  ngay,
  dongLai,
}: {
  kenh: string;
  ngay: string;
  dongLai: string;
}) {
  const rows = await getDotThuNgay(kenh, ngay);
  const tien = rows.reduce((t, r) => t + Number(r.tien), 0);
  const coc = kenh === "cần trừ cọc";
  // Gõ muộn hơn ngày tiền về là nhập bù — đáng chỉ ra vì chính nó làm cột
  // tiền của mấy ngày gần nhất nhìn thấp hơn thực tế.
  const bu = rows.filter((r) => r.ngay_go !== null && r.ngay_go > ngay).length;

  return (
    <NganKeo dongLai={dongLai}>
      <h1>
        {kenh} · {ngayVn(ngay)}
      </h1>
      <p className="muted">
        {n(rows.length)} đợt thu, <b>{n(tien)}</b> yên.{" "}
        {coc
          ? "Đây là tiền khách đã nộp từ trước nay trừ sang cước — không có đồng nào mới vào tài khoản hôm đó."
          : "Tiền thật chạy qua tài khoản này."}
        {bu > 0 && ` ${n(bu)} đợt được gõ vào máy sau ngày tiền về.`}
      </p>

      {rows.length === 0 ? (
        <p className="muted">Không có đợt thu nào.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Hợp đồng</th>
              <th>Kỳ</th>
              <th className="num">Tiền</th>
              <th>Trạng thái</th>
              <th>Gõ máy</th>
              <th>Người gõ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const tt = r.status === null ? undefined : TRANG_THAI[r.status];
              const muon = r.ngay_go !== null && r.ngay_go > ngay;
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
                  <td className="mono muted">{r.ky ?? "—"}</td>
                  <td className="num mono">{n(r.tien)}</td>
                  <td>
                    {tt === undefined ? (
                      <span className="muted">{r.status ?? "—"}</span>
                    ) : (
                      <span className={tt.dang === "" ? "tag" : `tag ${tt.dang}`}>{tt.ten}</span>
                    )}
                  </td>
                  <td className={`mono${muon ? " bad" : " muted"}`}>{ngayVn(r.ngay_go)}</td>
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
