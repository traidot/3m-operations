import { NganKeo } from "../../ngan-keo";
import { Chip } from "../../chip";
import { getTelecomDevices, getTelecomInvoices, getTelecomSub } from "@/lib/queries";
import {
  CANH_BAO_TELECOM,
  CANH_BAO_TELECOM_NANG,
  COC,
  DICH_VU,
  HOA_DON,
  HOP_DONG,
  MAY,
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

export async function ChiTietThueBao({ id, dongLai }: { id: string; dongLai: string }) {
  const [tb, hd, may] = await Promise.all([
    getTelecomSub(id),
    getTelecomInvoices(id),
    getTelecomDevices(id),
  ]);

  return (
    <NganKeo dongLai={dongLai}>
      <h1 className="mono">{tb?.khach ?? id}</h1>

      {!tb ? (
        <p className="empty">Không tìm thấy thuê bao này.</p>
      ) : (
        <>
          <p className="muted">
            Thuê bao{" "}
            {tb.link_cms ? (
              <a href={tb.link_cms} target="_blank" rel="noreferrer">
                {tb.subscription_id} ↗
              </a>
            ) : (
              tb.subscription_id
            )}{" "}
            · {DICH_VU[tb.service_type ?? ""] ?? tb.service_type}
            {tb.goi && ` · ${tb.goi}`}
          </p>

          {tb.canh_bao.length > 0 && (
            <p className="actions">
              {tb.canh_bao.map((cb) => (
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
            <O ten="trạng thái">
              <Chip ma={tb.trang_thai} nhan={HOP_DONG} />
            </O>
            <O ten="giá/tháng" gia_tri={n(tb.gia_thang)} />
            <O ten="kích hoạt" gia_tri={tb.ngay_kich_hoat ?? "—"} />
            <O ten="ngừng" gia_tri={tb.ngay_ngung ?? "—"} />
            <O ten="mã máy" gia_tri={tb.ma_may ?? "—"} />
            <O ten="kỳ gần nhất" gia_tri={tb.ky_gan_nhat_den ?? "—"} />
            <O
              ten="hoá đơn"
              gia_tri={
                Number(tb.hoa_don_don_hang) > 0
                  ? `${n(tb.so_hoa_don)} · ${n(tb.hoa_don_don_hang)} qua đơn hàng`
                  : n(tb.so_hoa_don)
              }
            />
            {/* Đại lý tự thu: không bày ô tiền nào. */}
            {!tb.la_dai_ly && (
              <>
                <O ten="đã thu" gia_tri={n(tb.da_thu)} />
                <O ten="còn nợ">
                  <span className={Number(tb.con_no) > 0 ? "bad" : undefined}>{n(tb.con_no)}</span>
                </O>
                <O ten="mất trắng">
                  <span className={Number(tb.tien_mat) > 0 ? "bad" : undefined}>
                    {n(tb.tien_mat)}
                  </span>
                </O>
                <O ten="quá hạn" gia_tri={`${n(tb.ngay_qua_han)} ngày`} />
              </>
            )}
          </dl>

          <h2>Máy và cọc</h2>
          {may.length === 0 ? (
            <p className="empty">Thuê bao này chưa gắn máy nào.</p>
          ) : (
            <div className="scroller">
              <table>
                {/* Ngăn kéo chỉ rộng nửa màn hình, tám cột thì cột cuối bị cắt.
                    Gộp khoảng ngày thành một ô, cọc kèm luôn tình trạng. */}
                <thead>
                  <tr>
                    <th>IMEI</th>
                    <th>Gắn</th>
                    <th>Tình trạng máy</th>
                    <th className="num">Cọc</th>
                    <th>Thuê · trả</th>
                  </tr>
                </thead>
                <tbody>
                  {may.map((m) => (
                    <tr key={`${m.imei}-${m.gan_tu}`}>
                      <td className="mono">
                        {m.imei}
                        {m.dang_gan && <span className="muted"> · đang gắn</span>}
                      </td>
                      <td className="mono">
                        {m.gan_tu ?? "—"}
                        {m.gan_den && ` → ${m.gan_den}`}
                      </td>
                      <td>
                        {m.trang_thai_may ? (
                          <Chip ma={m.trang_thai_may} nhan={MAY} />
                        ) : (
                          <span className="muted khong-xuong-dong">không có phiếu</span>
                        )}
                      </td>
                      <td className="num mono">
                        {n(m.coc)}
                        {m.trang_thai_coc && (
                          <span className="muted">
                            {" "}
                            · {COC[m.trang_thai_coc] ?? m.trang_thai_coc}
                          </span>
                        )}
                      </td>
                      <td className="mono">
                        {m.ngay_thue ?? "—"}
                        {m.ngay_tra && ` → ${m.ngay_tra}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="muted khoi-ghi-chu">
            “Không có phiếu” — bên nguồn không có dòng nào trong sổ cho thuê, chưa biết
            cọc. <a href="/cam-tay/coc?nhom=CHUA_GAN">Xem tất cả</a>.
          </p>

          <h2>Hoá đơn</h2>
          {hd.length === 0 ? (
            <p className="empty">Chưa có hoá đơn nào.</p>
          ) : (
            <div className="scroller">
              <table>
                <thead>
                  <tr>
                    <th>Kỳ</th>
                    <th>Trạng thái</th>
                    <th className="num">Tiền</th>
                    <th className="num">Đã trả</th>
                    <th className="num">Còn lại</th>
                    <th>Hạn · kênh</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {hd.map((h) => {
                    const huy = h.trang_thai === "VOID";
                    const con_lai_that = huy ? 0 : Number(h.con_lai);
                    return (
                    <tr key={h.invoice_id}>
                      <td className="mono">
                        {h.ky_tu ? `${h.ky_tu.slice(0, 7)}` : (h.ngay_lap?.slice(0, 7) ?? "—")}
                        {h.so_hoa_don && <div className="muted">{h.so_hoa_don}</div>}
                      </td>
                      <td>
                        <Chip ma={h.trang_thai} nhan={HOA_DON} />
                      </td>
                      <td className="num mono">{n(h.tien)}</td>
                      <td className="num mono">{n(h.da_tra)}</td>
                      {/* Hoá đơn đã thu hồi thì "tiền − đã trả" không còn là
                          khoản phải đòi; mọi con số tổng đã loại nó rồi, để số
                          ở đây là tự mâu thuẫn với dòng "còn nợ" bên trên. */}
                      <td className={`num mono${con_lai_that > 0 ? " bad" : ""}`}>
                        {huy ? "—" : n(h.con_lai)}
                      </td>
                      <td className="mono">
                        <span className={h.qua_han && con_lai_that > 0 ? "bad" : undefined}>
                          {huy ? "—" : (h.han_tra ?? "—")}
                        </span>
                        {h.kenh_thu && <div className="muted">{h.kenh_thu}</div>}
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
          )}
          <p className="muted khoi-ghi-chu">
            “Không đòi được” là hoá đơn bên hệ thống gốc đã đánh dấu bỏ, tiền coi như mất.
            Gói trả trước như SIM năm thu một lần qua đơn hàng — hoá đơn đó gắn vào đơn
            chứ không vào thuê bao nên không nằm trong bảng dưới, nhưng vẫn được tính là
            đã có chứng cứ thu tiền.
            Hạn trả là ngày kỳ cước bắt đầu — phiếu thu xuất mùng 5 và 15 cho tháng sau,
            qua mùng 1 của tháng dùng mà chưa thu được là quá hạn.
          </p>
          {tb?.link_cms && (
            <div className="actions">
              <a href={tb.link_cms} target="_blank" rel="noreferrer">
                <button type="button">Mở thuê bao bên CMS →</button>
              </a>
            </div>
          )}
        </>
      )}
    </NganKeo>
  );
}
