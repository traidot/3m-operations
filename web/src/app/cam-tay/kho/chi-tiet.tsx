import Link from "next/link";
import { NganKeo } from "../../ngan-keo";
import { LOAI_KHACH, MAU_LOAI_KHACH, MAU_MAY_CUOC, MAY_CUOC, PHIEU_KHO } from "@/lib/nhan";

const KHONG_RO = "khong-ro";

/** Thứ tự cố định để nút lọc không nhảy chỗ giữa hai lần tải. */
const LOAI = ["CUSTOMER", "COLLABORATOR", "AGENCY", KHONG_RO];
import type { KhoMa } from "@/lib/queries";

const n = (v: string | number | null) =>
  v === null ? "—" : Number(v).toLocaleString("vi-VN");

/**
 * Ngăn kéo cho một nhóm mã — một bước của phễu hoặc một việc cần xử lý. Chỉ
 * dựng bảng của đúng nhóm đang xem chứ không phải cả 8.272 mã, nên nặng theo
 * số dòng của nhóm đó thôi.
 */
/** Một chiều để gom số khi nhóm quá đông để liệt kê. */
export type Chieu = { ten: string; lay: (r: KhoMa) => string };

/** Bảng đếm theo một chiều, xếp nhiều trước. */
function BangGom({ ten, lay, rows }: Chieu & { rows: KhoMa[] }) {
  const gom = new Map<string, number>();
  for (const r of rows) {
    const k = lay(r);
    gom.set(k, (gom.get(k) ?? 0) + 1);
  }
  const hang = [...gom.entries()].sort((a, b) => b[1] - a[1]);
  return (
    <>
      <h2>{ten}</h2>
      <table>
        <tbody>
          {hang.map(([k, v]) => (
            <tr key={k}>
              <td>{k}</td>
              <td className="num mono">{n(v)}</td>
              <td className="num muted mono">
                {((v / Math.max(rows.length, 1)) * 100).toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export function ChiTietNhom({
  ten,
  mo_ta,
  canh_bao,
  rows,
  dongLai,
  themLink,
  tomTat,
  chiFile,
  kemDanhSach,
  baseHref,
  lk,
}: {
  ten: string;
  mo_ta: string;
  canh_bao?: string;
  rows: KhoMa[];
  dongLai: string;
  themLink?: string;
  /** Có thì gom số theo mấy chiều này thay vì liệt kê từng mã. */
  tomTat?: Chieu[];
  /** Nhóm mà phần mềm không có mã nào: bỏ cột phần mềm vì chắc chắn rỗng. */
  chiFile?: boolean;
  /** Có tóm tắt rồi mà vẫn muốn liệt kê tiếp bên dưới. */
  kemDanhSach?: boolean;
  /** Đường dẫn của chính ngăn kéo này, để nút lọc giữ nguyên nhóm đang xem. */
  baseHref?: string;
  /** Loại khách đang lọc: mã thô, "khong-ro" cho máy chưa phân loại, rỗng là không lọc. */
  lk?: string;
}) {
  // Lọc ngay trong ngăn kéo: nhóm nào cũng đông và cùng một việc thì đại lý với
  // khách lẻ là hai cách xử lý khác nhau.
  //
  // Máy chưa phân loại phải có mã riêng chứ không dùng chuỗi rỗng: rỗng đã là mã
  // của "tất cả", nên nút "không rõ loại" đọc ra đúng bằng tổng và bấm vào thì
  // không lọc gì.
  const ma = (r: KhoMa) => r.loai_khach ?? KHONG_RO;
  const dem = (k: string) => rows.filter((r) => ma(r) === k).length;
  const hien = lk ? rows.filter((r) => ma(r) === lk) : rows;
  const nut = (k: string, nhan: string) => {
    const p = new URLSearchParams(baseHref?.split("?")[1] ?? "");
    if (k) p.set("lk", k);
    else p.delete("lk");
    return (
      <Link key={k || "tat-ca"} href={`${baseHref?.split("?")[0]}?${p.toString()}`}>
        <button type="button" className={lk === k ? "primary" : undefined}>
          {nhan} · {n(k ? dem(k) : rows.length)}
        </button>
      </Link>
    );
  };
  return (
    <NganKeo dongLai={dongLai}>
      <h1>{ten}</h1>
      <p className="muted">
        {mo_ta}. {n(hien.length)} mã
        {hien.length !== rows.length && ` trên tổng ${n(rows.length)}`}.
      </p>

      {canh_bao && <p className="stale">{canh_bao}</p>}

      {baseHref && rows.some((r) => r.loai_khach) && (
        <p className="actions">
          {nut("", "tất cả")}
          {LOAI.filter((k) => dem(k) > 0).map((k) =>
            nut(k, k === KHONG_RO ? "không rõ loại" : (LOAI_KHACH[k] ?? k)),
          )}
        </p>
      )}

      {tomTat && (
        <>
          {!kemDanhSach && (
            <p className="muted">
              Nhóm này quá đông để liệt kê từng mã — {n(hien.length)} dòng dựng ra vừa nặng
              vừa không đọc được gì. Gom số theo mấy chiều dưới đây; cần từng mã thì mở màn
              hình danh sách.
            </p>
          )}
          {tomTat.map((c) => (
            <BangGom key={c.ten} {...c} rows={hien} />
          ))}
          {kemDanhSach && <h2>Từng mã</h2>}
        </>
      )}

      {tomTat && !kemDanhSach ? null : hien.length === 0 ? (
        <p className="empty">Không còn mã nào.</p>
      ) : chiFile ? (
        <div className="scroller">
          <table>
            <thead>
              <tr>
                <th>Mã</th>
                <th>Nhóm hàng</th>
                <th>Kết luận ở file</th>
                <th>Vị trí theo sổ / kiểm kho</th>
                <th>Người giữ theo sổ</th>
              </tr>
            </thead>
            <tbody>
              {hien.map((r) => (
                <tr key={r.ma_chuan}>
                  <td className="mono">{r.ma}</td>
                  <td className="muted">{r.file_nhom_hang ?? "—"}</td>
                  <td className="muted">{r.file_ket_luan ?? "—"}</td>
                  <td className="muted">
                    {r.file_vi_tri_so ?? "không có trong sổ"}
                    {r.file_kiem_kho && <div>kiểm kho: {r.file_kiem_kho}</div>}
                  </td>
                  <td className="muted">{r.file_nguoi_giu ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="scroller">
          <table>
            <thead>
              <tr>
                <th>Mã</th>
                <th>Đời máy</th>
                <th>Khách</th>
                <th />
                <th>Phần mềm ghi</th>
                <th>File ghi</th>
              </tr>
            </thead>
            <tbody>
              {hien.map((r) => (
                <tr key={r.ma_chuan}>
                  <td className="mono">{r.ma}</td>
                  <td className="muted">{r.doi_may ?? "—"}</td>
                  <td className="muted">
                    {r.khach ?? "—"}
                    {r.ma_khach && <div className="mono">{r.ma_khach}</div>}
                    {r.loai_khach ? (
                      <div>
                        <span className={`chip ${MAU_LOAI_KHACH[r.loai_khach] ?? "tat"}`}>
                          {LOAI_KHACH[r.loai_khach] ?? r.loai_khach}
                        </span>
                      </div>
                    ) : (
                      r.khach && <div>chưa phân loại</div>
                    )}
                    {r.nguon_khach && <div className="mono">{r.nguon_khach}</div>}
                  </td>
                  <td className="khong-xuong-dong">
                    {r.link_cms && (
                      <a href={r.link_cms} target="_blank" rel="noreferrer">
                        CMS →
                      </a>
                    )}
                  </td>
                  <td className="muted">
                    {r.doc_type && (
                      <div className="mono">
                        {PHIEU_KHO[r.doc_type] ?? r.doc_type} {r.doc_date} ·{" "}
                        {r.warehouse_name ?? "không ghi kho"}
                      </div>
                    )}
                    {r.tinh_trang_cuoc && (
                      <div>
                        <span className={`chip ${MAU_MAY_CUOC[r.tinh_trang_cuoc] ?? "tat"}`}>
                          {MAY_CUOC[r.tinh_trang_cuoc] ?? r.tinh_trang_cuoc}
                        </span>
                        {r.ky_cuoi && <span className="mono"> kỳ cuối {r.ky_cuoi}</span>}
                      </div>
                    )}
                    {!r.doc_type && !r.tinh_trang_cuoc && "không có gì"}
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
