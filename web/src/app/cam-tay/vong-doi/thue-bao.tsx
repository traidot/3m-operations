import { NganKeo } from "../../ngan-keo";
import { HOP_DONG, LOAI_KHACH, MAU_HOP_DONG, MAU_LOAI_KHACH } from "@/lib/nhan";
import type { ThueBaoNo } from "@/lib/queries";

const n = (v: string | number | null) =>
  v === null ? "—" : Math.round(Number(v)).toLocaleString("vi-VN");

/** Ngăn kéo cho nhóm tính theo THUÊ BAO — nợ tiền là thuê bao nợ, máy không nợ. */
export function ChiTietThueBao({
  ten,
  mo_ta,
  rows,
  dongLai,
}: {
  ten: string;
  mo_ta: string;
  rows: ThueBaoNo[];
  dongLai: string;
}) {
  const cong = (k: keyof ThueBaoNo) => rows.reduce((t, r) => t + Number(r[k] ?? 0), 0);

  return (
    <NganKeo dongLai={dongLai}>
      <h1>{ten}</h1>
      <p className="muted">
        {mo_ta}. {n(rows.length)} thuê bao · đang đòi {n(cong("no"))} · bỏ thu{" "}
        {n(cong("bo_thu"))}.
      </p>

      {rows.length === 0 ? (
        <p className="empty">Không còn thuê bao nào.</p>
      ) : (
        <div className="scroller">
          <table>
            <thead>
              <tr>
                <th>Thuê bao</th>
                <th>Khách</th>
                <th>Gói</th>
                <th className="num">Đang đòi</th>
                <th className="num">Bỏ thu</th>
                <th className="num">Quá hạn</th>
                <th className="num">Máy</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.subscription_id}>
                  <td className="mono">
                    {r.subscription_id}
                    <div>
                      <span className={`chip ${MAU_HOP_DONG[r.trang_thai] ?? "tat"}`}>
                        {HOP_DONG[r.trang_thai] ?? r.trang_thai}
                      </span>
                    </div>
                    {r.ngay_ngung && <div className="mono muted">ngừng {r.ngay_ngung}</div>}
                  </td>
                  <td className="muted">
                    {r.khach}
                    {r.ma_khach && <div className="mono">{r.ma_khach}</div>}
                    {r.loai_khach && (
                      <div>
                        <span className={`chip ${MAU_LOAI_KHACH[r.loai_khach] ?? "tat"}`}>
                          {LOAI_KHACH[r.loai_khach] ?? r.loai_khach}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="muted">
                    {r.goi ?? "—"}
                    {r.gia_thang && <div className="mono">{n(r.gia_thang)}/tháng</div>}
                  </td>
                  <td className={`num mono${Number(r.no) > 0 ? " bad" : " muted"}`}>
                    {Number(r.no) > 0 ? n(r.no) : "—"}
                    {Number(r.so_hd_doi) > 0 && (
                      <div className="muted">{n(r.so_hd_doi)} hoá đơn</div>
                    )}
                  </td>
                  <td className={`num mono${Number(r.bo_thu) > 0 ? " bad" : " muted"}`}>
                    {Number(r.bo_thu) > 0 ? n(r.bo_thu) : "—"}
                    {Number(r.so_hd_bo) > 0 && (
                      <div className="muted">{n(r.so_hd_bo)} hoá đơn</div>
                    )}
                  </td>
                  <td className="num mono muted">
                    {r.qua_han_lau_nhat && Number(r.qua_han_lau_nhat) > 0
                      ? `${n(r.qua_han_lau_nhat)} ngày`
                      : "—"}
                  </td>
                  <td className="num mono muted">{n(r.so_may)}</td>
                  <td className="khong-xuong-dong">
                    {r.link_cms && (
                      <a href={r.link_cms} target="_blank" rel="noreferrer">
                        CMS →
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </NganKeo>
  );
}
