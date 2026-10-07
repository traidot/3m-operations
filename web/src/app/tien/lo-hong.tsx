import Link from "next/link";
import { NganKeo } from "../ngan-keo";
import {
  getKyHut,
  getThuNgoaiHopDong,
  type KyHut,
  type ThuNgoaiHopDong,
} from "@/lib/queries";
import { KY_HUT, KY_HUT_MAT_TIEN, LY_DO_HUY } from "@/lib/nhan";
import { them } from "../duong-dan";

const n = (v: string | number | null) =>
  v === null ? "—" : Math.round(Number(v)).toLocaleString("vi-VN");

const matTien = (r: KyHut) => KY_HUT_MAT_TIEN.has(r.trang_thai_so);
const hut = (r: KyHut) => Number(r.tien_le_ra) - Number(r.tien_da_thu);

/**
 * Hai chỗ sổ cước thủng, gom lại một mục.
 *
 * Khác phần trên của màn ở chỗ: bảng tài khoản đếm tiền ĐÃ VỀ, mục này đếm
 * tiền ĐÁNG LẼ PHẢI CÓ mà sổ không có dòng nào — nên không bao giờ cộng chung
 * hai phần được.
 */
export async function LoHong({ moTai }: { moTai: string }) {
  const [kyHut, thuNgoai] = await Promise.all([
    getKyHut(),
    getThuNgoaiHopDong(),
  ]);

  // Kỳ hụt được miễn hoặc đã thu bằng đường khác thì không phải tiền mất.
  const kyMat = kyHut.filter(matTien);
  const tienKyHut = kyMat.reduce((t, r) => t + hut(r), 0);
  const tienNgoai = thuNgoai.reduce((t, r) => t + Number(r.tien), 0);

  return (
    <section>
      <h2>
        Lỗ hổng{" "}
        <span className="muted">— tiền đáng lẽ phải có mà sổ không có dòng</span>
      </h2>
      <p className="muted">
        Phần trên đếm tiền <b>đã về</b>; mục này đếm tiền <b>lẽ ra phải có</b>.
        Hai thứ khác nhau, đừng cộng chung. Bấm để xem từng dòng.
      </p>
      <table>
        <thead>
          <tr>
            <th>Lỗ hổng</th>
            <th className="num">Số kỳ</th>
            <th className="num">Hợp đồng</th>
            <th className="num">Tiền</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <Link href={them(moTai, "lo=ky-hut")} scroll={false} className="o-mo">
                <b>Tháng chạy mà không ra kỳ cước</b>
              </Link>
              <div className="muted">
                mốc ngừng thu đóng trước ngày huỷ, quãng giữa khách vẫn dùng mà
                luật sinh kỳ không đẻ kỳ nào
                {kyHut.length > kyMat.length && (
                  <>
                    {" "}
                    — {n(kyHut.length - kyMat.length)} kỳ nữa được miễn hoặc đã
                    thu bằng đường khác, không tính vào đây
                  </>
                )}
              </div>
            </td>
            <td className="num mono">
              <b>{n(kyMat.length)}</b>
            </td>
            <td className="num mono muted">
              {n(new Set(kyMat.map((r) => r.subscription_id)).size)}
            </td>
            <td className="num mono">
              <b>{n(tienKyHut)}</b>
            </td>
            <td className="khong-xuong-dong">
              <Link href={them(moTai, "lo=ky-hut")} scroll={false}>
                xem →
              </Link>
            </td>
          </tr>
          <tr>
            <td>
              <Link
                href={them(moTai, "lo=thu-ngoai")}
                scroll={false}
                className="o-mo"
              >
                <b>Tiền thu ngoài khoảng hợp đồng</b>
              </Link>
              <div className="muted">
                đã thu tiền thật nhưng không khoảng thu nào của hợp đồng đó chứa
                ngày thu
              </div>
            </td>
            <td className="num mono">
              <b>{n(thuNgoai.length)}</b>
            </td>
            <td className="num mono muted">
              {n(new Set(thuNgoai.map((r) => r.subscription_id)).size)}
            </td>
            <td className="num mono">
              <b>{n(tienNgoai)}</b>
            </td>
            <td className="khong-xuong-dong">
              <Link href={them(moTai, "lo=thu-ngoai")} scroll={false}>
                xem →
              </Link>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

export async function ChiTietKyHut({ dongLai }: { dongLai: string }) {
  const rows = await getKyHut();
  const mat = rows.filter(matTien);

  return (
    <NganKeo dongLai={dongLai}>
      <h1>Tháng chạy mà không ra kỳ cước</h1>
      <p className="muted">
        Hợp đồng có hai mốc rời nhau: <b>ngày kết thúc thu</b> và{" "}
        <b>ngày huỷ</b>. Khi mốc thu đóng trước, những tháng ở giữa khách vẫn
        dùng dịch vụ nhưng luật sinh kỳ không đẻ kỳ nào — quãng đó không nằm
        trong &ldquo;phải thu&rdquo;, cũng không nằm trong &ldquo;còn
        thiếu&rdquo;. <b>{n(mat.length)}</b> kỳ mất tiền trên tổng{" "}
        {n(rows.length)} kỳ hụt; phần còn lại được miễn hoặc đã thu bằng đường
        khác.
      </p>
      {rows.length === 0 ? (
        <p className="muted">Không có kỳ nào hụt.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Kỳ</th>
              <th>Hợp đồng</th>
              <th>Địa chỉ</th>
              <th className="num">Lẽ ra thu</th>
              <th>Sổ ghi</th>
              <th>Lý do huỷ</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.subscription_id}-${r.ky}`}>
                <td className="mono">{r.ky}</td>
                <td className="mono">{r.ma_hop_dong ?? "—"}</td>
                <td className="muted">{r.dia_chi ?? "—"}</td>
                <td className={`num mono${matTien(r) ? "" : " muted"}`}>
                  {n(hut(r))}
                </td>
                <td>
                  <span className={`tag ${matTien(r) ? "critical" : ""}`}>
                    {KY_HUT[r.trang_thai_so] ?? r.trang_thai_so}
                  </span>
                </td>
                <td className="muted">
                  {r.nhom_ly_do_huy === null
                    ? "—"
                    : (LY_DO_HUY[r.nhom_ly_do_huy] ?? r.nhom_ly_do_huy)}
                </td>
                <td className="khong-xuong-dong">
                  {r.link_cms !== null && (
                    <a href={r.link_cms} target="_blank" rel="noreferrer">
                      mở →
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </NganKeo>
  );
}

export async function ChiTietThuNgoai({ dongLai }: { dongLai: string }) {
  const rows: ThuNgoaiHopDong[] = await getThuNgoaiHopDong();
  const tien = rows.reduce((t, r) => t + Number(r.tien), 0);

  return (
    <NganKeo dongLai={dongLai}>
      <h1>Tiền thu ngoài khoảng hợp đồng</h1>
      <p className="muted">
        Kỳ đã thu tiền thật nhưng rơi ra ngoài khoảng thu ghi trên hợp đồng —
        đối chiếu giữa sổ cước và ngày bắt đầu thu, ngày kết thúc thu, ngày lắp
        xong, ngày huỷ của chính hợp đồng đó. <b>{n(rows.length)}</b> lần,{" "}
        <b>{n(tien)}</b> yên.
      </p>
      {rows.length === 0 ? (
        <p className="muted">Không có khoản nào.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Kỳ</th>
              <th>Hợp đồng</th>
              <th>Địa chỉ</th>
              <th className="num">Tiền</th>
              <th>Ngày thu</th>
              <th>Tình huống</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.subscription_id}-${r.ky}-${r.ngay_thu}`}>
                <td className="mono">{r.ky}</td>
                <td className="mono">{r.ma_hop_dong ?? "—"}</td>
                <td className="muted">{r.dia_chi ?? "—"}</td>
                <td className="num mono">{n(r.tien)}</td>
                <td className="mono muted">{r.ngay_thu ?? "—"}</td>
                <td className="muted">{r.tinh_huong ?? "—"}</td>
                <td className="khong-xuong-dong">
                  {r.link_cms !== null && (
                    <a href={r.link_cms} target="_blank" rel="noreferrer">
                      mở →
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </NganKeo>
  );
}
