import { NganKeo } from "../../ngan-keo";
import Link from "next/link";
import { ChipLoaiKhach } from "../../chip";
import { getTelecomChurnList } from "@/lib/queries";
import { DICH_VU } from "@/lib/nhan";

const n = (v: string | null) => (v === null ? "—" : Number(v).toLocaleString("vi-VN"));

export async function ChiTietHuy({
  thang,
  loaiKhach,
  dongLai,
}: {
  thang: string;
  /** Mã loại khách đang lọc ở trang ngoài; chuỗi rỗng là xem tất cả. */
  loaiKhach: string;
  dongLai: string;
}) {
  const tatCa = await getTelecomChurnList(thang);
  const rows = loaiKhach
    ? tatCa.filter((r) => (r.loai_khach ?? "CHUA_PHAN_LOAI") === loaiKhach)
    : tatCa;
  const conNo = rows.reduce((t, r) => t + Number(r.con_no), 0);
  const duoi3 = rows.filter((r) => Number(r.so_thang_dung) < 3).length;

  return (
    <NganKeo dongLai={dongLai}>
      <h1>Thuê bao ngừng tháng {thang}</h1>
      <p className="muted">
        {rows.length.toLocaleString("vi-VN")} thuê bao ·{" "}
        {duoi3.toLocaleString("vi-VN")} cái dùng chưa tới 3 tháng
        {conNo > 0 && ` · còn nợ ${conNo.toLocaleString("vi-VN")} yên`}
      </p>

      {rows.length === 0 ? (
        <p className="empty">Không có thuê bao nào ngừng trong tháng này.</p>
      ) : (
        <div className="scroller">
          <table>
            <thead>
              <tr>
                <th>Khách</th>
                <th>Dịch vụ</th>
                <th className="num">Giá</th>
                <th>Dùng từ</th>
                <th className="num" title="Số tháng từ lúc kích hoạt tới lúc ngừng">
                  Số tháng
                </th>
                <th className="num">Còn nợ</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.subscription_id}>
                  <td>
                    <Link href={`/cam-tay/khach?q=${encodeURIComponent(r.ma_khach ?? r.khach)}`}>
                      {r.khach}
                    </Link>
                    <div>
                      <ChipLoaiKhach ma={r.loai_khach} />
                    </div>
                  </td>
                  <td>
                    {DICH_VU[r.service_type ?? ""] ?? r.service_type ?? "—"}
                    <div className="mono muted">{r.goi ?? "—"}</div>
                  </td>
                  <td className="num mono">{n(r.gia_thang)}</td>
                  <td className="mono muted">
                    {r.ngay_kich_hoat ?? "—"}
                    <div>đến {r.ngay_ngung ?? "—"}</div>
                  </td>
                  {/* Dùng chưa tới 3 tháng đã bỏ thì thường là vấn đề chất
                      lượng hoặc bán sai kỳ vọng, không phải hết nhu cầu. */}
                  <td
                    className={`num mono${Number(r.so_thang_dung) < 3 ? " bad" : ""}`}
                  >
                    {n(r.so_thang_dung)}
                  </td>
                  <td className={`num mono${Number(r.con_no) > 0 ? " bad" : " muted"}`}>
                    {Number(r.con_no) > 0 ? n(r.con_no) : "—"}
                  </td>
                  <td>
                    {r.link_cms && (
                      <a href={r.link_cms} target="_blank" rel="noreferrer">
                        CMS ↗
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="muted khoi-ghi-chu">
        Ngày ngừng lấy theo thứ tự: ngày huỷ ghi bên nguồn, không có thì ngày hết hạn, không có
        nữa thì kỳ cước cuối cùng. Nguồn cầm tay không ghi lý do huỷ nên không có cột đó.
      </p>
    </NganKeo>
  );
}
