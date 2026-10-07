import Link from "next/link";
import { NganKeo } from "../ngan-keo";
import type { ViecHomNay } from "@/lib/queries";
import { VIEC_HOM_NAY } from "@/lib/nhan";
import { them } from "../duong-dan";

const n = (v: string | number | null) =>
  v === null ? "—" : Math.round(Number(v)).toLocaleString("vi-VN");

/** Hiện sẵn ngần này việc già nhất; phần còn lại mở ngăn kéo mới thấy. */
const HIEN_SAN = 15;
/** Ngăn kéo cũng phải có trần, không thì một hàng đợi nghìn dòng làm treo trang. */
const TRAN_NGAN_KEO = 300;
/** Quá ngần này ngày thì tô đỏ: không còn là "đang xử lý" nữa. */
const QUA_LAU = 60;

/** Các hàng đợi của một mảng, theo thứ tự cứu được trước. */
export const viecCua = (he: string) =>
  Object.keys(VIEC_HOM_NAY)
    .filter((v) => VIEC_HOM_NAY[v]!.he === he)
    .sort((a, b) => VIEC_HOM_NAY[a]!.thu_tu - VIEC_HOM_NAY[b]!.thu_tu);

function Bang({
  viec,
  ds,
  het,
}: {
  viec: string;
  ds: ViecHomNay[];
  /** true khi đang hiện toàn bộ hàng đợi, không phải vài cái đầu. */
  het?: boolean;
}) {
  const b = VIEC_HOM_NAY[viec]!;
  const coNguoi = ds.some((r) => r.nguoi !== null);

  return (
    <table>
      <thead>
        <tr>
          <th className="num">Chờ</th>
          <th>{b.cot_ma}</th>
          <th>{b.cot_ai}</th>
          {b.cot_tien !== null && <th className="num">{b.cot_tien}</th>}
          {coNguoi && <th>Người nhập</th>}
          <th />
        </tr>
      </thead>
      <tbody>
        {ds.map((r) => (
          <tr key={r.id}>
            <td className={`num mono${r.tuoi_ngay >= QUA_LAU ? " bad" : ""}`}>
              <b>{n(r.tuoi_ngay)}</b> <span className="muted">ngày</span>
            </td>
            <td className="mono">{r.ma ?? "—"}</td>
            <td className="muted">{r.ai ?? "—"}</td>
            {b.cot_tien !== null && <td className="num mono">{n(r.tien)}</td>}
            {coNguoi && <td className="muted">{r.nguoi ?? "—"}</td>}
            <td className="khong-xuong-dong">
              {r.url !== null && (
                <a href={r.url} target="_blank" rel="noreferrer">
                  làm →
                </a>
              )}
            </td>
          </tr>
        ))}
      </tbody>
      {het && ds.length === TRAN_NGAN_KEO && (
        <tfoot>
          <tr>
            <td colSpan={9} className="muted">
              Dừng ở {TRAN_NGAN_KEO} việc già nhất. Làm hết chỗ này rồi mở lại sẽ
              thấy tiếp.
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}

/** Một hàng đợi: mô tả, vài con số, bảng việc già nhất, nút xem hết. */
export function MucHangDoi({
  viec,
  ds,
  moTai,
}: {
  viec: string;
  ds: ViecHomNay[];
  /** Đường dẫn trang chứa mục, để dựng liên kết mở ngăn kéo. */
  moTai: string;
}) {
  const b = VIEC_HOM_NAY[viec]!;
  const tien = ds.reduce((t, r) => t + Number(r.tien ?? 0), 0);
  const lau = ds.filter((r) => r.tuoi_ngay >= QUA_LAU).length;

  return (
    <section>
      <h2>{b.ten}</h2>
      <p className="muted">{b.lam_gi}</p>

      {ds.length === 0 ? (
        <p className="muted">
          <b>Không còn việc nào.</b>
        </p>
      ) : (
        <>
          <p className="muted">
            <b>{n(ds.length)} việc</b>, già nhất <b>{n(ds[0]!.tuoi_ngay)} ngày</b>
            {lau > 0 && (
              <>
                , {n(lau)} cái đã quá {QUA_LAU} ngày
              </>
            )}
            {b.cot_tien !== null && tien > 0 && (
              <>
                , đang kẹt <b>{n(tien)}</b> yên
              </>
            )}
            .
          </p>
          <Bang viec={viec} ds={ds.slice(0, HIEN_SAN)} />
          {ds.length > HIEN_SAN && (
            <p className="actions">
              <Link href={them(moTai, `mo=${viec}`)} scroll={false}>
                <button type="button">Xem tất cả {n(ds.length)} việc →</button>
              </Link>
            </p>
          )}
        </>
      )}
    </section>
  );
}

/** Ngăn kéo xem hết một hàng đợi. */
export function NganKeoHangDoi({
  viec,
  ds,
  dongLai,
}: {
  viec: string;
  ds: ViecHomNay[];
  dongLai: string;
}) {
  return (
    <NganKeo dongLai={dongLai}>
      <h1>{VIEC_HOM_NAY[viec]!.ten}</h1>
      <p className="muted">{VIEC_HOM_NAY[viec]!.lam_gi}</p>
      <Bang viec={viec} ds={ds.slice(0, TRAN_NGAN_KEO)} het />
    </NganKeo>
  );
}

/**
 * Đoạn mở đầu dùng chung cho cả hai màn — ba điều kiện đọc số này phải biết,
 * nói ở một chỗ để hai màn không trôi khác nhau.
 */
export function LuatDocSo({ khac }: { khac: string }) {
  return (
    <p className="muted">
      Chỉ hiện việc đã <b>quá ngưỡng chờ</b> — cái mới phát sinh hôm qua đang được
      xử lý bình thường, không phải việc tồn. Ngưỡng nằm ở bảng{" "}
      <code>threshold</code>, sửa được. Không tính đại lý. Một {khac} có thể nằm ở
      nhiều hàng đợi cùng lúc, nên đừng cộng số của các hàng đợi lại.
    </p>
  );
}
