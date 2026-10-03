import { Fragment } from "react";
import Link from "next/link";
import type { CocNhom, CocO } from "@/lib/queries";

const n = (v: string | number) => Math.round(Number(v)).toLocaleString("vi-VN");

/** Quá mốc này thì không còn là đang xử lý — trung bình duyệt xong trong 2,1 ngày. */
const QUA_LAU = 14;

/**
 * Phiếu cọc chờ duyệt, cắt đồng thời theo tuổi chờ và thứ đang thu.
 *
 * Một bảng chứ không phải hai: cùng một đống dữ liệu cắt theo hai chiều thì
 * tách ra không trả lời được câu "nhóm chờ 15-30 ngày là tiền cọc hay tiền
 * cước" — mà đó chính là câu quyết định ai phải làm gì.
 */
export function BangCocNhom({
  ds,
  o,
  moTai,
  linkDuyet,
}: {
  ds: CocNhom[];
  o: CocO[];
  moTai: string;
  linkDuyet: string | null;
}) {
  if (ds.length === 0) return null;
  const tong = (k: "so_phieu" | "tien" | "phai_tu_tra") =>
    ds.reduce((t, r) => t + Number(r[k]), 0);

  return (
    <section>
      <h2>
        6 · Cọc chờ duyệt{" "}
        <span className="muted">— phiếu khách đã trả mà chưa ai duyệt</span>
      </h2>
      <p className="muted">
        Khách trả tiền ở combini là phiếu cọc tự mở ra ở trạng thái chờ duyệt;
        tới khi có người duyệt và gán vào tháng cước thì nợ của khách mới được
        trừ. Cột <b>phải tự tra</b> là phiếu lúc tạo mã không chọn sẵn tháng
        cước — nhìn theo loại mới thấy vì sao gần hết phiếu rơi vào đó: tiền cọc
        không thuộc tháng cước nào cả, có muốn chọn sẵn cũng không có gì để
        chọn. Bấm một dòng để xem từng phiếu.
      </p>
      <div className="scroller">
        <table>
          <thead>
            <tr>
              <th>Chờ bao lâu</th>
              <th>Thu cái gì</th>
              <th className="num">Phiếu</th>
              <th className="num">Tiền</th>
              <th className="num">Phải tự tra</th>
              <th className="num">Lâu nhất</th>
            </tr>
          </thead>
          <tbody>
            <tr className="tong">
              <td colSpan={2}>
                <Link className="o-mo" href={`${moTai}?coc=all`} scroll={false}>
                  <b>Tất cả</b>
                </Link>
              </td>
              <td className="num mono">
                <b>{n(tong("so_phieu"))}</b>
              </td>
              <td className="num mono">
                <b>{n(tong("tien"))}</b>
              </td>
              <td className="num mono">
                <b>{n(tong("phai_tu_tra"))}</b>
              </td>
              <td className="num mono muted">—</td>
            </tr>
            {ds.map((bac) => {
              const con = o.filter((r) => r.bac === bac.bac);
              const lau = Number(bac.lau_nhat) > QUA_LAU;
              return (
                <Fragment key={bac.bac}>
                  <tr className="tong">
                    <td rowSpan={con.length + 1} className={lau ? "bad" : undefined}>
                      <Link className="o-mo" href={`${moTai}?coc=${bac.bac}`} scroll={false}>
                        {bac.nhom}
                      </Link>
                    </td>
                    <td className="muted">cả nhóm</td>
                    <td className="num mono">
                      <b>{n(bac.so_phieu)}</b>
                    </td>
                    <td className="num mono muted">{n(bac.tien)}</td>
                    <td className="num mono muted">
                      {Number(bac.phai_tu_tra) === 0 ? "—" : n(bac.phai_tu_tra)}
                    </td>
                    <td className={`num mono${lau ? " bad" : " muted"}`}>
                      {n(bac.lau_nhat)} ngày
                    </td>
                  </tr>
                  {con.map((r) => (
                    <tr key={r.nhom_tien}>
                      <td>
                        <Link
                          className="o-mo"
                          href={`${moTai}?coc=${bac.bac}.${r.nhom_tien}`}
                          scroll={false}
                        >
                          {r.ten}
                        </Link>
                      </td>
                      <td className="num mono muted">{n(r.so_phieu)}</td>
                      <td className="num mono muted">{n(r.tien)}</td>
                      <td className="num mono muted">
                        {Number(r.phai_tu_tra) === 0 ? (
                          "—"
                        ) : r.phai_tu_tra === r.so_phieu ? (
                          <>
                            {n(r.phai_tu_tra)} <span className="muted">· tất cả</span>
                          </>
                        ) : (
                          n(r.phai_tu_tra)
                        )}
                      </td>
                      <td className="num mono muted">
                        {Number(r.lau_nhat) === 0 ? "hôm nay" : `${n(r.lau_nhat)} ngày`}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {linkDuyet !== null && (
        <p className="muted">
          <a href={linkDuyet} target="_blank" rel="noreferrer">
            Mở màn duyệt bên CMS →
          </a>
        </p>
      )}
    </section>
  );
}
