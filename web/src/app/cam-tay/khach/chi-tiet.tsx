import { NganKeo } from "../../ngan-keo";
import Link from "next/link";
import { Chip } from "../../chip";
import { getCustomerSubs, getLooseInvoices, getTelecomCustomer } from "@/lib/queries";
import {
  CANH_BAO_TELECOM,
  CANH_BAO_TELECOM_NANG,
  DICH_VU,
  HOA_DON,
  HOP_DONG,
} from "@/lib/nhan";

const n = (v: string | null) => (v === null ? "—" : Number(v).toLocaleString("vi-VN"));

function O({ ten, gia_tri, children }: { ten: string; gia_tri?: string; children?: React.ReactNode }) {
  return (
    <div>
      <dt>{ten}</dt>
      <dd>{children ?? gia_tri}</dd>
    </div>
  );
}

export async function ChiTietKhach({
  id,
  dongLai,
  linkHoaDon,
}: {
  id: string;
  dongLai: string;
  linkHoaDon: (subscriptionId: string) => string;
}) {
  const [kh, tb, le] = await Promise.all([
    getTelecomCustomer(id),
    getCustomerSubs(id),
    getLooseInvoices(id),
  ]);

  return (
    <NganKeo dongLai={dongLai}>
      <h1>{kh?.khach ?? "Khách"}</h1>

      {!kh ? (
        <p className="empty">Không tìm thấy khách này.</p>
      ) : (
        <>
          <p className="muted">
            {[
              kh.ma_khach,
              kh.dien_thoai ?? "chưa có số điện thoại",
              `${n(kh.so_thue_bao)} thuê bao, ${n(kh.dang_chay)} đang chạy`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>

          {kh.canh_bao.length > 0 && (
            <p className="actions">
              {kh.canh_bao.map((cb) => (
                <span
                  key={cb}
                  className={`tag ${CANH_BAO_TELECOM_NANG.has(cb) ? "critical" : "warn"}`}
                >
                  {CANH_BAO_TELECOM[cb] ?? cb}
                </span>
              ))}
            </p>
          )}

          <dl className="chung-cu">
            <O ten="đã thu" gia_tri={n(kh.da_thu)} />
            <O ten="còn nợ">
              <span className={Number(kh.con_no) > 0 ? "bad" : undefined}>{n(kh.con_no)}</span>
            </O>
            <O ten="mất trắng">
              <span className={Number(kh.tien_mat) > 0 ? "bad" : undefined}>{n(kh.tien_mat)}</span>
            </O>
            <O ten="quá hạn" gia_tri={`${n(kh.ngay_qua_han)} ngày`} />
            <O ten="máy chưa trả" gia_tri={n(kh.may_chua_tra)} />
            <O ten="kỳ gần nhất" gia_tri={kh.ky_gan_nhat_den?.slice(0, 7) ?? "—"} />
          </dl>

          <h2>Thuê bao</h2>
          <div className="scroller">
            <table>
              <thead>
                <tr>
                  <th>Dịch vụ</th>
                  <th>Gói</th>
                  <th>Trạng thái</th>
                  <th className="num">Giá</th>
                  <th className="num">Hoá đơn</th>
                  <th className="num">Đã thu</th>
                  <th className="num">Còn nợ</th>
                  <th>Kỳ cuối</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {tb.map((s) => (
                  <tr key={s.subscription_id}>
                    <td>
                      {DICH_VU[s.service_type ?? ""] ?? s.service_type ?? "—"}
                      <div className="mono muted">{s.subscription_id}</div>
                    </td>
                    <td>{s.goi ?? "—"}</td>
                    <td>
                      <Chip ma={s.trang_thai} nhan={HOP_DONG} />
                    </td>
                    <td className="num mono">{n(s.gia_thang)}</td>
                    <td className="num mono muted">{n(s.so_hoa_don)}</td>
                    <td className="num mono">{n(s.da_thu)}</td>
                    <td className={`num mono${Number(s.con_no) > 0 ? " bad" : ""}`}>
                      {n(s.con_no)}
                    </td>
                    <td className="mono">{s.ky_gan_nhat_den?.slice(0, 7) ?? "—"}</td>
                    <td className="khong-xuong-dong">
                      <Link href={linkHoaDon(s.subscription_id)} scroll={false}>
                        hoá đơn
                      </Link>
                      {s.link_cms && (
                        <>
                          {" · "}
                          <a href={s.link_cms} target="_blank" rel="noreferrer">
                            CMS ↗
                          </a>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {le.length > 0 && (
            <>
              <h2>Hoá đơn không gắn thuê bao</h2>
              <div className="scroller">
                <table>
                  <thead>
                    <tr>
                      <th>Kỳ</th>
                      <th>Trạng thái</th>
                      <th className="num">Tiền</th>
                      <th className="num">Đã trả</th>
                      <th className="num">Còn lại</th>
                      <th>Hạn</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {le.map((h) => {
                      const huy = h.trang_thai === "VOID";
                      return (
                        <tr key={h.invoice_id}>
                          <td className="mono">
                            {h.ky_tu?.slice(0, 7) ?? h.ngay_lap?.slice(0, 7) ?? "—"}
                            {h.so_hoa_don && <div className="muted">{h.so_hoa_don}</div>}
                          </td>
                          <td>
                            <Chip ma={h.trang_thai} nhan={HOA_DON} />
                          </td>
                          <td className="num mono">{n(h.tien)}</td>
                          <td className="num mono">{n(h.da_tra)}</td>
                          <td
                            className={`num mono${!huy && Number(h.con_lai) > 0 ? " bad" : ""}`}
                          >
                            {huy ? "—" : n(h.con_lai)}
                          </td>
                          <td className="mono">
                            <span className={h.qua_han && !huy ? "bad" : undefined}>
                              {huy ? "—" : (h.han_tra ?? "—")}
                            </span>
                          </td>
                          <td>
                            {h.link_cms && (
                              <a href={h.link_cms} target="_blank" rel="noreferrer">
                                CMS ↗
                              </a>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="muted khoi-ghi-chu">
                Bên nguồn có hoá đơn chỉ ghi mã khách, không gắn thuê bao nào —
                thường là khoản thu lẻ. Tiền vẫn cộng vào nợ của khách.
              </p>
            </>
          )}

          {kh.link_cms && kh.link_cms.length > 0 && (
            <div className="actions">
              {kh.link_cms.map((u, i) => (
                <a key={u} href={u} target="_blank" rel="noreferrer">
                  <button type="button">
                    {/* Một party gộp từ hai mã nguồn thì có hai hồ sơ bên CMS. */}
                    Mở bên CMS{kh.link_cms!.length > 1 ? ` (${i + 1})` : ""} →
                  </button>
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </NganKeo>
  );
}
