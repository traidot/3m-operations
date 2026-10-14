import { NganKeo } from "../ngan-keo";
import { Dau } from "./bang-ngay";
import { getDotThuNgayCamTay } from "@/lib/queries";
import { KENH_THU } from "@/lib/nhan";

const n = (v: string | number | null) =>
  v === null ? "—" : Math.round(Number(v)).toLocaleString("vi-VN");

const ngayVn = (iso: string | null) =>
  iso === null ? "—" : `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Hai kiểu chưa cấn, khác hẳn nhau khi đi sửa. */
const LY_DO: Record<string, { ten: string; dang: string }> = {
  CHUA_CAN_TRU: { ten: "Chưa cấn", dang: "warn" },
  CAN_TRU_HOA_DON_XOA: { ten: "Hoá đơn đã xoá", dang: "critical" },
};

/**
 * Chi tiết một ô của bảng "Tiền về theo ngày" bên cầm tay: mọi khoản thu của
 * một kênh trong một ngày.
 *
 * Danh sách đọc cùng nguồn và cùng điều kiện với ô (xem db/230) nên cộng ra
 * đúng con số trên bảng. Khác bên cố định ở chỗ việc còn dở là cấn vào hoá
 * đơn chứ không phải kế toán duyệt — cầm tay không có bước duyệt.
 */
export async function ChiTietTienCamTay({
  kenh,
  ngay,
  dongLai,
}: {
  kenh: string;
  ngay: string;
  dongLai: string;
}) {
  const rows = await getDotThuNgayCamTay(kenh, ngay);
  const tien = rows.reduce((t, r) => t + Number(r.tien), 0);
  const can = rows
    .filter((r) => r.da_can)
    .reduce((t, r) => t + Number(r.tien), 0);
  // Gõ muộn hơn ngày tiền về là nhập bù — chính nó làm cột tiền mấy ngày gần
  // nhất nhìn thấp hơn thực tế.
  const bu = rows.filter((r) => r.ngay_go !== null && r.ngay_go > r.ngay).length;

  return (
    <NganKeo dongLai={dongLai}>
      <h1>
        {/* kenh là mã bên nguồn vì nó còn là khoá của ô trong URL. */}
        {KENH_THU[kenh] ?? kenh} <span className="muted">· {ngayVn(ngay)}</span>
      </h1>
      <p className="muted">
        {n(rows.length)} khoản thu, <b>{n(tien)}</b> yên.{" "}
        {can === tien
          ? "Đã cấn hết vào hoá đơn."
          : `Còn ${n(tien - can)} yên chưa cấn vào hoá đơn nào, nợ của những khách này chưa giảm.`}
        {bu > 0 && ` ${n(bu)} khoản được gõ vào máy sau ngày tiền về.`}
      </p>

      {rows.length === 0 ? (
        <p className="muted">Không có khoản thu nào.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Khách</th>
              <th>Mã</th>
              <th className="num">Tiền</th>
              <th>Cấn hoá đơn</th>
              <th>Gõ máy</th>
              <th>Người gõ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const ld = r.ly_do === null ? undefined : LY_DO[r.ly_do];
              const muon = r.ngay_go !== null && r.ngay_go > r.ngay;
              return (
                <tr key={r.source_id}>
                  <td>
                    {r.url === null ? (
                      r.khach
                    ) : (
                      <a href={r.url} target="_blank" rel="noreferrer">
                        {r.khach}
                      </a>
                    )}
                  </td>
                  <td className="mono muted">{r.ma_khach ?? "—"}</td>
                  <td className="num mono">{n(r.tien)}</td>
                  <td>
                    {r.da_can ? (
                      <span className="tag">Đã cấn</span>
                    ) : (
                      <span className={`tag ${ld?.dang ?? "warn"}`}>
                        {ld?.ten ?? "Chưa cấn"}
                      </span>
                    )}
                  </td>
                  <td className={`mono${muon ? " bad" : " muted"}`}>{ngayVn(r.ngay_go)}</td>
                  <td className="muted">{r.nguoi_go ?? "—"}</td>
                </tr>
              );
            })}
            <tr className="tong">
              <td colSpan={2}>
                <b>Tổng</b> <span className="muted">đã cấn / về</span>
              </td>
              <td className="num mono nowrap">
                <span className="muted">{n(can)}</span> / <b>{n(tien)}</b>
                <Dau du={can === tien} chenh={tien - can} viec="cấn vào hoá đơn" />
              </td>
              <td colSpan={3} />
            </tr>
          </tbody>
        </table>
      )}
    </NganKeo>
  );
}
