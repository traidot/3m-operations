import { NganKeo } from "../../ngan-keo";
import { Chip } from "../../chip";
import { getCustomerSubs, getTelecomCustomer } from "@/lib/queries";
import {
  CANH_BAO_TELECOM,
  CANH_BAO_TELECOM_NANG,
  DICH_VU,
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

export async function ChiTietKhach({ id, dongLai }: { id: string; dongLai: string }) {
  const [kh, tb] = await Promise.all([getTelecomCustomer(id), getCustomerSubs(id)]);

  return (
    <NganKeo dongLai={dongLai}>
      <h1>{kh?.khach ?? "Khách"}</h1>

      {!kh ? (
        <p className="empty">Không tìm thấy khách này.</p>
      ) : (
        <>
          <p className="muted">
            {kh.dien_thoai ?? "chưa có số điện thoại"} · {n(kh.so_thue_bao)} thuê bao,{" "}
            {n(kh.dang_chay)} đang chạy
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
                    <td>{DICH_VU[s.service_type ?? ""] ?? s.service_type ?? "—"}</td>
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
                    <td>
                      <a href={`/cam-tay/thue-bao?xem=${s.subscription_id}`}>hoá đơn →</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </NganKeo>
  );
}
