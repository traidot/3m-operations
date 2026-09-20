import Link from "next/link";
import { NganKeo } from "../../ngan-keo";
import { MAY_CUOC, PHIEU_KHO } from "@/lib/nhan";
import type { KhoMa } from "@/lib/queries";

const n = (v: string | number | null) =>
  v === null ? "—" : Number(v).toLocaleString("vi-VN");

/**
 * Ngăn kéo cho một nhóm mã — một bước của phễu hoặc một việc cần xử lý. Chỉ
 * dựng bảng của đúng nhóm đang xem chứ không phải cả 8.272 mã, nên nặng theo
 * số dòng của nhóm đó thôi.
 */
export function ChiTietNhom({
  ten,
  mo_ta,
  canh_bao,
  rows,
  dongLai,
  themLink,
}: {
  ten: string;
  mo_ta: string;
  canh_bao?: string;
  rows: KhoMa[];
  dongLai: string;
  themLink?: string;
}) {
  return (
    <NganKeo dongLai={dongLai}>
      <h1>{ten}</h1>
      <p className="muted">
        {mo_ta}. {n(rows.length)} mã.
      </p>

      {canh_bao && <p className="stale">{canh_bao}</p>}

      {rows.length === 0 ? (
        <p className="empty">Không còn mã nào.</p>
      ) : (
        <div className="scroller">
          <table>
            <thead>
              <tr>
                <th>Mã</th>
                <th>Đời máy</th>
                <th>Phần mềm ghi</th>
                <th>File ghi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.ma_chuan}>
                  <td className="mono">{r.ma}</td>
                  <td className="muted">{r.doi_may ?? "—"}</td>
                  <td className="muted">
                    {r.doc_type && (
                      <div className="mono">
                        {PHIEU_KHO[r.doc_type] ?? r.doc_type} {r.doc_date} ·{" "}
                        {r.warehouse_name ?? "không ghi kho"}
                      </div>
                    )}
                    {r.khach && (
                      <div>
                        {r.khach}
                        {r.ma_khach && ` · ${r.ma_khach}`}
                      </div>
                    )}
                    {r.tinh_trang_cuoc && (
                      <div>
                        {MAY_CUOC[r.tinh_trang_cuoc] ?? r.tinh_trang_cuoc}
                        {r.ky_cuoi && ` · kỳ cuối ${r.ky_cuoi}`}
                      </div>
                    )}
                    {!r.doc_type && !r.khach && !r.tinh_trang_cuoc && "không có gì"}
                  </td>
                  <td className="muted">
                    {r.file_co ? (
                      <>
                        <div>{r.file_ket_luan}</div>
                        <div>{r.file_vi_tri_so ?? "không có trong sổ"}</div>
                        {r.file_kiem_kho && <div>kiểm kho: {r.file_kiem_kho}</div>}
                        {r.file_nguoi_giu && <div>{r.file_nguoi_giu}</div>}
                      </>
                    ) : (
                      "file không nhắc tới"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {themLink && (
        <div className="actions">
          <Link href={themLink}>
            <button type="button">Mở trong màn hình danh sách →</button>
          </Link>
        </div>
      )}
    </NganKeo>
  );
}
