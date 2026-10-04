import Link from "next/link";
import { NganKeo } from "../ngan-keo";
import { getViecHomNay, type ViecHomNay } from "@/lib/queries";
import { TEN_HE, VIEC_HOM_NAY } from "@/lib/nhan";

export const dynamic = "force-dynamic";

const n = (v: string | number | null) =>
  v === null ? "—" : Math.round(Number(v)).toLocaleString("vi-VN");

type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? "";

const DUONG_DAN = "/viec-hom-nay";

/** Hiện sẵn ngần này việc già nhất; phần còn lại mở ngăn kéo mới thấy. */
const HIEN_SAN = 15;
/** Ngăn kéo cũng phải có trần, không thì một hàng đợi nghìn dòng làm treo trang. */
const TRAN_NGAN_KEO = 300;

/** Quá ngần này ngày thì tô đỏ: không còn là "đang xử lý" nữa. */
const QUA_LAU = 60;

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
              Dừng ở {TRAN_NGAN_KEO} việc già nhất. Làm hết chỗ này rồi mở lại
              sẽ thấy tiếp.
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}

/**
 * Hàng đợi việc phải làm hôm nay, cả hai mảng.
 *
 * Màn này cố tình KHÔNG phải báo cáo: không biểu đồ, không so tháng trước. Mở
 * ra là thấy danh sách tên, già nhất lên đầu, mỗi dòng bấm sang CMS làm được
 * ngay. Làm xong thì danh sách ngắn lại — đó là toàn bộ cách dùng.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Tham>;
}) {
  const [rows, sp] = await Promise.all([getViecHomNay(), searchParams]);

  const theoHe = (he: string) => rows.filter((r) => r.he === he);
  const cua = (viec: string) => rows.filter((r) => r.viec === viec);
  const viecCua = (he: string) =>
    Object.keys(VIEC_HOM_NAY)
      .filter((v) => VIEC_HOM_NAY[v]!.he === he)
      .sort((a, b) => VIEC_HOM_NAY[a]!.thu_tu - VIEC_HOM_NAY[b]!.thu_tu);

  // Mảng nào nhiều việc hơn thì lên trước. Xếp cứng cố định lên đầu thì bên
  // cầm tay — đang gấp bốn lần số việc — nằm khuất dưới đáy trang, người xem
  // cuộn một đoạn rồi tưởng màn này chỉ có wifi cố định.
  const cacHe = ["co_dinh", "cam_tay"].sort(
    (a, b) => theoHe(b).length - theoHe(a).length,
  );

  // Loại việc có trong view mà chưa khai nhãn thì vẫn phải lộ ra, kẻo thêm
  // hàng đợi bên SQL rồi tưởng đã lên màn hình.
  const laDu = [...new Set(rows.map((r) => r.viec))].filter(
    (v) => VIEC_HOM_NAY[v] === undefined,
  );

  const moViec = mot(sp.mo);

  return (
    <main>
      <h1>Việc hôm nay</h1>
      <p className="muted">
        <b>{n(rows.length)} việc</b> đang chờ người làm —{" "}
        {n(theoHe("co_dinh").length)} bên cố định, {n(theoHe("cam_tay").length)}{" "}
        bên cầm tay. Đây không phải báo cáo để đọc: mỗi dòng là một việc đóng
        được, già nhất lên đầu, bấm <b>làm →</b> là sang thẳng CMS. Làm xong thì
        danh sách ngắn lại.
      </p>
      <p className="muted">
        Chỉ hiện việc đã <b>quá ngưỡng chờ</b> — cái mới phát sinh hôm qua đang
        được xử lý bình thường, không phải việc tồn. Ngưỡng nằm ở bảng{" "}
        <code>threshold</code>, sửa được. Không tính đại lý. Một hợp đồng có thể
        nằm ở nhiều hàng đợi cùng lúc, nên đừng cộng số của các hàng đợi lại.
        Đòi nợ không có ở đây vì <Link href="/thu-cuoc">màn Thu cước</Link> đã
        làm đầy đủ hơn.
      </p>

      {laDu.length > 0 && (
        <p className="tag critical">
          {laDu.length} loại việc chưa có nhãn ở nhan.ts: {laDu.join(", ")}
        </p>
      )}

      {cacHe.map((he) => (
        <section key={he}>
          <h2 className="dau-he">
            {TEN_HE[he] ?? he}{" "}
            <span className="muted">
              — {n(theoHe(he).length)} việc trên {viecCua(he).length} hàng đợi
            </span>
          </h2>
          {viecCua(he).map((viec) => {
            const ds = cua(viec);
            const b = VIEC_HOM_NAY[viec]!;
            const tien = ds.reduce((t, r) => t + Number(r.tien ?? 0), 0);
            const lau = ds.filter((r) => r.tuoi_ngay >= QUA_LAU).length;

            return (
              <section key={viec}>
                <h3>{b.ten}</h3>
                <p className="muted">{b.lam_gi}</p>

                {ds.length === 0 ? (
                  <p className="muted">
                    <b>Không còn việc nào.</b>
                  </p>
                ) : (
                  <>
                    <p className="muted">
                      <b>{n(ds.length)} việc</b>, già nhất{" "}
                      <b>{n(ds[0]!.tuoi_ngay)} ngày</b>
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
                        <Link href={`${DUONG_DAN}?mo=${viec}`} scroll={false}>
                          <button type="button">
                            Xem tất cả {n(ds.length)} việc →
                          </button>
                        </Link>
                      </p>
                    )}
                  </>
                )}
              </section>
            );
          })}
        </section>
      ))}

      {VIEC_HOM_NAY[moViec] !== undefined && (
        <NganKeo dongLai={DUONG_DAN}>
          <h1>{VIEC_HOM_NAY[moViec]!.ten}</h1>
          <p className="muted">{VIEC_HOM_NAY[moViec]!.lam_gi}</p>
          <Bang viec={moViec} ds={cua(moViec).slice(0, TRAN_NGAN_KEO)} het />
        </NganKeo>
      )}
    </main>
  );
}
