import { NganKeo } from "../../ngan-keo";
import Link from "next/link";
import { Chip } from "../../chip";
import { getTelecomMayKy, getTelecomMayMot } from "@/lib/queries";
import { COC, DICH_VU, HOA_DON, MAY } from "@/lib/nhan";

const n = (v: string | null) => (v === null ? "—" : Number(v).toLocaleString("vi-VN"));

function O({ ten, gia_tri, children }: { ten: string; gia_tri?: string; children?: React.ReactNode }) {
  return (
    <div>
      <dt>{ten}</dt>
      <dd>{children ?? gia_tri}</dd>
    </div>
  );
}

export async function ChiTietMay({ imei, dongLai }: { imei: string; dongLai: string }) {
  const [may, ky] = await Promise.all([getTelecomMayMot(imei), getTelecomMayKy(imei)]);

  return (
    <NganKeo dongLai={dongLai}>
      <h1 className="mono">{imei}</h1>

      {!may ? (
        <p className="empty">Không tìm thấy máy này.</p>
      ) : (
        <>
          <p className="muted">
            {may.khach}
            {may.ma_khach && ` · ${may.ma_khach}`}
          </p>

          <dl className="chung-cu">
            <O ten="tình trạng">
              <Chip ma={may.trang_thai} nhan={MAY} />
            </O>
            <O ten="cọc" gia_tri={n(may.coc)} />
            <O ten="tình trạng cọc">
              <Chip ma={may.trang_thai_coc} nhan={COC} />
            </O>
            <O ten="ngày thuê" gia_tri={may.ngay_thue ?? "—"} />
            <O ten="ngày trả" gia_tri={may.ngay_tra ?? "chưa trả"} />
            <O ten="lượt cho thuê" gia_tri={n(may.so_luot_thue)} />
            <O ten="lượt gắn" gia_tri={`${n(may.so_lan_gan)} lượt · ${n(may.so_thue_bao)} thuê bao`} />
            <O ten="dịch vụ" gia_tri={DICH_VU[may.dich_vu ?? ""] ?? may.dich_vu ?? "—"} />
            <O ten="gói" gia_tri={may.goi ?? "—"} />
            <O ten="kỳ cước" gia_tri={may.ky_dau ? `${may.ky_dau} → ${may.ky_cuoi}` : "chưa có kỳ nào"} />
            <O ten="phải thu" gia_tri={n(may.phai_thu)} />
            <O ten="đã thu" gia_tri={n(may.da_thu)} />
            <O ten="chưa thu">
              <span className={Number(may.chua_thu) > 0 ? "bad" : undefined}>{n(may.chua_thu)}</span>
            </O>
          </dl>

          {may.chua_ra_cuoc && (
            <p className="stale">
              Máy chưa trả mà không ra kỳ cước nào — hoặc chưa gắn thuê bao, hoặc gắn rồi mà
              không ai xuất cước. Cọc {n(may.coc)} yên đang giữ.
            </p>
          )}

          <h2>Lịch sử thu cước</h2>
          {ky.length === 0 ? (
            <p className="empty">Máy này chưa có kỳ cước nào.</p>
          ) : (
            <div className="scroller">
              <table>
                <thead>
                  <tr>
                    <th>Kỳ</th>
                    <th>Thuê bao</th>
                    <th className="num">Tiền</th>
                    <th>Hoá đơn</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {ky.map((k) => (
                    <tr key={k.fee_line_id}>
                      <td className="mono">{k.ky}</td>
                      <td className="mono muted">{k.subscription_id}</td>
                      <td className="num mono">{n(k.tien)}</td>
                      <td>
                        <Chip ma={k.trang_thai_hd} nhan={HOA_DON} />
                        {k.so_hoa_don && <div className="mono muted">{k.so_hoa_don}</div>}
                      </td>
                      <td className="khong-xuong-dong">
                        <Link href={`/cam-tay/khach?q=${encodeURIComponent(k.subscription_id)}`}>
                          khách
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="muted khoi-ghi-chu">
            Chỉ tính kỳ cước nằm trong khoảng máy ở với thuê bao đó. Một máy đi qua nhiều thuê
            bao và một thuê bao có thể đổi máy giữa chừng, nên kỳ ngoài khoảng là cước của máy
            khác, không cộng vào đây.
          </p>

          {may.link_cms && (
            <div className="actions">
              <a href={may.link_cms} target="_blank" rel="noreferrer">
                <button type="button">Mở thuê bao bên CMS →</button>
              </a>
            </div>
          )}
        </>
      )}
    </NganKeo>
  );
}
