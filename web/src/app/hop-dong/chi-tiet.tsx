import { NganKeo } from "./ngan-keo";
import { getContract, getContractPeriods, getContractUrl } from "@/lib/queries";
import {
  CANH_BAO,
  CANH_BAO_NANG,
  HOP_DONG,
  KY_CUOC,
  LAP_DAT,
  TINH_TRANG_CUOC,
} from "@/lib/nhan";

const n = (v: string | null) =>
  v === null ? "—" : Number(v).toLocaleString("vi-VN");

/** Kỳ chưa thu và kỳ mới chỉ ghi chú đều là việc còn dang dở, tô đỏ. */
const DO = new Set(["NO", "CHO_DUYET", "GHI_CHU"]);

function O({
  ten,
  gia_tri,
  do: tomau,
}: {
  ten: string;
  gia_tri: string;
  do?: boolean;
}) {
  return (
    <div>
      <dt>{ten}</dt>
      <dd className={tomau ? "bad" : undefined}>{gia_tri}</dd>
    </div>
  );
}

/** Chi tiết một hợp đồng, hiện trong ngăn kéo bên phải danh sách. */
export async function ChiTiet({
  id,
  dongLai,
}: {
  id: string;
  dongLai: string;
}) {
  const [hd, ky, url] = await Promise.all([
    getContract(id),
    getContractPeriods(id),
    getContractUrl(id),
  ]);

  return (
    <NganKeo dongLai={dongLai}>
      <h1 className="mono">{hd?.contract_code ?? id}</h1>

      {!hd ? (
        <p className="empty">Không tìm thấy hợp đồng này.</p>
      ) : (
        <>
          <p className="muted">{hd.dia_chi ?? "chưa có địa chỉ lắp"}</p>

          {hd.canh_bao.length > 0 && (
            <p className="actions">
              {hd.canh_bao.map((cb) => (
                <span
                  key={cb}
                  className={`tag ${CANH_BAO_NANG.has(cb) ? "critical" : "warn"}`}
                >
                  {CANH_BAO[cb] ?? cb}
                </span>
              ))}
            </p>
          )}

          <dl className="chung-cu">
            <O
              ten="hợp đồng"
              gia_tri={
                HOP_DONG[hd.trang_thai_hop_dong] ?? hd.trang_thai_hop_dong
              }
            />
            <O
              ten="lắp đặt"
              gia_tri={
                hd.trang_thai_lap_dat
                  ? (LAP_DAT[hd.trang_thai_lap_dat] ?? hd.trang_thai_lap_dat)
                  : "—"
              }
            />
            <O
              ten="cước"
              gia_tri={
                TINH_TRANG_CUOC[hd.tinh_trang_cuoc] ?? hd.tinh_trang_cuoc
              }
              do={hd.tinh_trang_cuoc === "NO"}
            />
            {hd.goi_cuoc && <O ten="gói" gia_tri={hd.goi_cuoc} />}
            <O ten="cước/tháng" gia_tri={n(hd.cuoc_thang)} />
            <O ten="bắt đầu thu" gia_tri={hd.fee_start_on ?? "—"} />
            <O ten="ngày ký" gia_tri={hd.ngay_ky ?? "—"} />
            <O ten="lắp xong" gia_tri={hd.ngay_lap_xong ?? "—"} />
            <O
              ten="tổng kỳ"
              gia_tri={
                hd.tinh_trang_cuoc === "CHUA_TINH_DUOC" ? "—" : n(hd.so_ky)
              }
            />
            <O ten="đã thu" gia_tri={n(hd.tong_da_thu)} />
            <O ten="còn nợ" gia_tri={n(hd.con_no)} do={Number(hd.con_no) > 0} />
          </dl>

          {hd.tinh_trang_cuoc === "CHUA_TINH_DUOC" && (
            <p className="stale">
              Hợp đồng này thiếu{" "}
              {hd.cuoc_thang === null ? "giá cước" : "ngày bắt đầu thu"} nên hệ
              thống không sinh được kỳ nào. Các kỳ dưới đây chỉ là những dòng đã
              có trong sổ, không biết còn thiếu tháng nào.
            </p>
          )}

          <h2>Cước từng tháng</h2>
          {ky.length === 0 ? (
            <p className="empty">Chưa có kỳ cước nào.</p>
          ) : (
            <div className="scroller">
              <table>
                <thead>
                  <tr>
                    <th>Kỳ</th>
                    <th>Trạng thái</th>
                    <th className="num">Phải thu</th>
                    <th className="num">Đã thu</th>
                    <th>Kênh</th>
                    <th>Thu lúc</th>
                    <th>Người nhập</th>
                  </tr>
                </thead>
                <tbody>
                  {ky.map((k) => (
                    <tr key={k.ky}>
                      <td className="mono">
                        {k.ky}
                        {k.ngoai_ky_tinh && (
                          <span className="tag warn"> ngoài kỳ</span>
                        )}
                      </td>
                      <td className={DO.has(k.trang_thai) ? "bad" : undefined}>
                        {KY_CUOC[k.trang_thai] ?? k.trang_thai}
                      </td>
                      <td className="num mono">{n(k.phai_thu)}</td>
                      <td
                        className={`num mono${
                          k.phai_thu !== null &&
                          k.tien !== null &&
                          Number(k.tien) < Number(k.phai_thu)
                            ? " bad"
                            : ""
                        }`}
                      >
                        {n(k.tien)}
                      </td>
                      <td>{k.kenh || "—"}</td>
                      <td className="mono">{k.thu_luc?.slice(0, 10) ?? "—"}</td>
                      <td>{k.nguoi_nhap || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="muted">
            “Ngoài kỳ” là dòng trong sổ ứng với tháng nằm ngoài khoảng hệ thống
            tính được — trả trước, hoặc nhập nhầm năm. “Chỉ ghi chú” và “chờ
            duyệt” chưa tính là đã thu.
          </p>

          {url && (
            <div className="actions">
              <a href={url} target="_blank" rel="noreferrer">
                <button type="button">Mở bên CMS →</button>
              </a>
            </div>
          )}
        </>
      )}
    </NganKeo>
  );
}
