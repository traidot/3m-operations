import { NganKeo } from "../../ngan-keo";
import Link from "next/link";
import { Chip } from "../../chip";
import {
  getCustomerSubs,
  getLooseInvoices,
  getTelecomCustomer,
  type TelecomInvoice,
} from "@/lib/queries";
import {
  CANH_BAO_TELECOM,
  CANH_BAO_TELECOM_NANG,
  DICH_VU,
  HOA_DON,
  HOP_DONG,
  LOAI_HOA_DON,
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


/** Bảng hoá đơn không gắn thẳng thuê bao, dùng chung cho hai nhóm. */
function BangHoaDon({
  tieuDe,
  rows,
  linkHoaDon,
  ghiChu,
}: {
  tieuDe: string;
  rows: TelecomInvoice[];
  linkHoaDon: (subscriptionId: string) => string;
  ghiChu: string;
}) {
  const coChu = rows.some((h) => (h.so_thue_bao ?? 0) > 0);

  return (
    <>
      <h2>{tieuDe}</h2>
      <div className="scroller">
        <table>
          <thead>
            <tr>
              <th>Kỳ</th>
              <th>Loại</th>
              {coChu && <th>Thuộc thuê bao</th>}
              <th>Trạng thái</th>
              <th className="num">Tiền</th>
              <th className="num">Đã trả</th>
              <th className="num">Còn lại</th>
              <th>Hạn</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((h) => {
              const huy = h.trang_thai === "VOID";
              return (
                <tr key={h.invoice_id}>
                  <td className="mono">
                    {h.ky_tu?.slice(0, 7) ?? h.ngay_lap?.slice(0, 7) ?? "—"}
                    {h.so_hoa_don && <div className="muted">{h.so_hoa_don}</div>}
                  </td>
                  <td className="muted">{LOAI_HOA_DON[h.loai ?? ""] ?? h.loai ?? "—"}</td>
                  {coChu && (
                    <td className="mono">
                      {h.thue_bao_don ? (
                        <Link href={linkHoaDon(h.thue_bao_don)} scroll={false}>
                          {h.thue_bao_don}
                        </Link>
                      ) : (h.so_thue_bao ?? 0) > 1 ? (
                        <span className="muted">{h.so_thue_bao} thuê bao</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  )}
                  <td>
                    <Chip ma={h.trang_thai} nhan={HOA_DON} />
                  </td>
                  <td className="num mono">{n(h.tien)}</td>
                  <td className="num mono">{n(h.da_tra)}</td>
                  <td className={`num mono${!huy && Number(h.con_lai) > 0 ? " bad" : ""}`}>
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
      <p className="muted khoi-ghi-chu">{ghiChu}</p>
    </>
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

  // Hoá đơn không điền subscriptionId chia làm hai chuyện khác hẳn nhau: gói
  // thu một lần xuất theo đơn hàng (vẫn có chủ, nối được qua orderRef) và
  // khoản thu lẻ thật sự không nối về đâu. Xem db/110.
  const theoDon = le.filter((h) => (h.so_thue_bao ?? 0) > 0);
  const khongNoiDuoc = le.filter((h) => (h.so_thue_bao ?? 0) === 0);

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

          {/* Đại lý tự thu nên mình không theo cước của họ — bỏ hẳn các ô tiền
              thay vì bày số 3M không quản. Máy vẫn là của 3M nên vẫn theo. */}
          {kh.la_dai_ly && (
            <p className="muted">
              Khách loại đại lý — đại lý tự thu cước của khách mình, nên phần cước không
              theo dõi ở đây và không vào danh sách thu cước.
            </p>
          )}
          <dl className="chung-cu">
            {!kh.la_dai_ly && (
              <>
                <O ten="đã thu" gia_tri={n(kh.da_thu)} />
                <O ten="còn nợ">
                  <span className={Number(kh.con_no) > 0 ? "bad" : undefined}>{n(kh.con_no)}</span>
                </O>
                <O ten="mất trắng">
                  <span className={Number(kh.tien_mat) > 0 ? "bad" : undefined}>
                    {n(kh.tien_mat)}
                  </span>
                </O>
                {Number(kh.phai_hoan) > 0 && (
                  <O ten="phải hoàn khách" gia_tri={n(kh.phai_hoan)} />
                )}
                <O ten="quá hạn" gia_tri={`${n(kh.ngay_qua_han)} ngày`} />
              </>
            )}
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
                    <td className="num mono">
                      {kh.la_dai_ly ? <span className="muted">—</span> : n(s.da_thu)}
                    </td>
                    <td className={`num mono${!kh.la_dai_ly && Number(s.con_no) > 0 ? " bad" : ""}`}>
                      {kh.la_dai_ly ? <span className="muted">—</span> : n(s.con_no)}
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

          {theoDon.length > 0 && (
            <BangHoaDon
              tieuDe="Hoá đơn theo đơn hàng"
              rows={theoDon}
              linkHoaDon={linkHoaDon}
              ghiChu="Gói thu một lần — SIM năm, gói trả trước — bên nguồn xuất hoá đơn theo đơn hàng chứ không theo thuê bao, nên không hiện ở bảng trên. Cột “thuộc thuê bao” là suy từ mã đơn hàng. Tiền đã cộng vào nợ của khách rồi, đừng cộng lần nữa."
            />
          )}

          {khongNoiDuoc.length > 0 && (
            <BangHoaDon
              tieuDe="Hoá đơn không nối được về thuê bao"
              rows={khongNoiDuoc}
              linkHoaDon={linkHoaDon}
              ghiChu="Bên nguồn chỉ ghi mã khách, không có cả mã đơn hàng để lần ra thuê bao — thường là khoản thu lẻ. Tiền vẫn cộng vào nợ của khách."
            />
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
