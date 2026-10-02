import Link from "next/link";
import type { CocNhom } from "@/lib/queries";

const n = (v: string | number) => Math.round(Number(v)).toLocaleString("vi-VN");

/** Quá mốc này thì không còn là đang xử lý — trung bình duyệt xong trong 2,1 ngày. */
const QUA_LAU = 14;

/**
 * Phiếu cọc chờ duyệt, gom theo tuổi chờ.
 *
 * Bản tóm tắt của màn /fee-payments/deposit-allocations bên CMS, vốn đổ ra
 * danh sách dài: nhìn vào chỉ biết là nhiều, không biết cái nào đáng lo trước.
 */
export function BangCocNhom({ ds, moTai }: { ds: CocNhom[]; moTai: string }) {
  if (ds.length === 0) return null;
  const tongPhieu = ds.reduce((t, r) => t + Number(r.so_phieu), 0);
  const tongTien = ds.reduce((t, r) => t + Number(r.tien), 0);
  const tongTuTra = ds.reduce((t, r) => t + Number(r.phai_tu_tra), 0);

  return (
    <section>
      <h2>
        7 · Cọc chờ duyệt{" "}
        <span className="muted">— phiếu khách đã trả mà chưa ai duyệt</span>
      </h2>
      <p className="muted">
        Khách trả tiền ở combini là phiếu cọc tự mở ra ở trạng thái chờ duyệt;
        tới khi có người duyệt và gán vào tháng cước thì nợ của khách mới được
        trừ. Cột <b>phải tự tra</b> là phiếu lúc tạo mã không chọn sẵn tháng
        cước — và đó đúng là phần nằm lại: mọi phiếu chờ quá 8 ngày đều thuộc
        nhóm này.
      </p>
      <div className="scroller">
        <table>
          <thead>
            <tr>
              <th>Chờ bao lâu</th>
              <th className="num">Phiếu</th>
              <th className="num">Tiền</th>
              <th className="num">Phải tự tra</th>
              <th className="num">Lâu nhất</th>
            </tr>
          </thead>
          <tbody>
            <tr className="tong">
              <td>
                <Link className="o-mo" href={`${moTai}?coc=all`} scroll={false}>
                  <b>Tất cả</b>
                </Link>
              </td>
              <td className="num mono">
                <b>{n(tongPhieu)}</b>
              </td>
              <td className="num mono">
                <b>{n(tongTien)}</b>
              </td>
              <td className="num mono">
                <b>{n(tongTuTra)}</b>
              </td>
              <td className="num mono muted">—</td>
            </tr>
            {ds.map((r) => {
              const lau = Number(r.lau_nhat) > QUA_LAU;
              return (
                <tr key={r.nhom}>
                  <td className={lau ? "bad" : undefined}>
                    <Link className="o-mo" href={`${moTai}?coc=${r.bac}`} scroll={false}>
                      {r.nhom}
                    </Link>
                  </td>
                  <td className="num mono">{n(r.so_phieu)}</td>
                  <td className="num mono muted">{n(r.tien)}</td>
                  <td className="num mono muted">{n(r.phai_tu_tra)}</td>
                  <td className={`num mono${lau ? " bad" : " muted"}`}>
                    {n(r.lau_nhat)} ngày
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted">Bấm một dòng để xem từng phiếu của nhóm đó.</p>
    </section>
  );
}
