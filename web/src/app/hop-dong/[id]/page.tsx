import { notFound } from "next/navigation";
import { getContract, getContractPeriods, getContractUrl } from "@/lib/queries";
import { HOP_DONG, KY_CUOC, LAP_DAT, TINH_TRANG_CUOC } from "@/lib/nhan";

export const dynamic = "force-dynamic";

const n = (v: string | null) => (v === null ? "—" : Number(v).toLocaleString("vi-VN"));

/** Kỳ chưa thu và kỳ mới chỉ ghi chú đều là việc còn dang dở, tô đỏ. */
const DO = new Set(["NO", "CHO_DUYET", "GHI_CHU"]);

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [hd, ky, url] = await Promise.all([
    getContract(id),
    getContractPeriods(id),
    getContractUrl(id),
  ]);
  if (!hd) notFound();

  return (
    <main>
      <h1 className="mono">{hd.contract_code ?? id}</h1>
      <p className="muted">{hd.dia_chi ?? "chưa có địa chỉ lắp"}</p>

      <dl className="chung-cu">
        <div>
          <dt>hợp đồng</dt>
          <dd>{HOP_DONG[hd.trang_thai_hop_dong] ?? hd.trang_thai_hop_dong}</dd>
        </div>
        <div>
          <dt>lắp đặt</dt>
          <dd>
            {hd.trang_thai_lap_dat
              ? (LAP_DAT[hd.trang_thai_lap_dat] ?? hd.trang_thai_lap_dat)
              : "—"}
          </dd>
        </div>
        <div>
          <dt>cước</dt>
          <dd>{TINH_TRANG_CUOC[hd.tinh_trang_cuoc] ?? hd.tinh_trang_cuoc}</dd>
        </div>
        {hd.goi_cuoc && (
          <div>
            <dt>gói</dt>
            <dd>{hd.goi_cuoc}</dd>
          </div>
        )}
        <div>
          <dt>cước/tháng</dt>
          <dd>{n(hd.cuoc_thang)}</dd>
        </div>
        <div>
          <dt>bắt đầu thu</dt>
          <dd>{hd.fee_start_on ?? "—"}</dd>
        </div>
        <div>
          <dt>ngày ký</dt>
          <dd>{hd.ngay_ky ?? "—"}</dd>
        </div>
        <div>
          <dt>lắp xong</dt>
          <dd>{hd.ngay_lap_xong ?? "—"}</dd>
        </div>
        <div>
          <dt>tổng kỳ</dt>
          <dd>{hd.tinh_trang_cuoc === "CHUA_TINH_DUOC" ? "—" : n(hd.so_ky)}</dd>
        </div>
        <div>
          <dt>đã thu</dt>
          <dd>{n(hd.tong_da_thu)}</dd>
        </div>
        <div>
          <dt>còn nợ</dt>
          <dd className={Number(hd.con_no) > 0 ? "bad" : undefined}>{n(hd.con_no)}</dd>
        </div>
      </dl>

      {hd.tinh_trang_cuoc === "CHUA_TINH_DUOC" && (
        <p className="stale">
          Hợp đồng này thiếu {hd.cuoc_thang === null ? "giá cước" : "ngày bắt đầu thu"} nên
          hệ thống không sinh được kỳ nào. Các kỳ dưới đây chỉ là những dòng đã có trong sổ,
          không biết còn thiếu tháng nào.
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
                    {k.ngoai_ky_tinh && <span className="tag warn"> ngoài kỳ</span>}
                  </td>
                  <td className={DO.has(k.trang_thai) ? "bad" : undefined}>
                    {KY_CUOC[k.trang_thai] ?? k.trang_thai}
                  </td>
                  <td className="num mono">{n(k.phai_thu)}</td>
                  <td className="num mono">{n(k.tien)}</td>
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
        “Ngoài kỳ” là dòng trong sổ ứng với tháng nằm ngoài khoảng hệ thống tính được —
        trả trước, hoặc nhập nhầm năm. “Chỉ ghi chú” và “chờ duyệt” chưa tính là đã thu.
      </p>

      <div className="actions">
        <a href="/hop-dong">
          <button type="button">← Danh sách</button>
        </a>
        {url && (
          <a href={url} target="_blank" rel="noreferrer">
            <button type="button">Mở bên CMS →</button>
          </a>
        )}
      </div>
    </main>
  );
}
