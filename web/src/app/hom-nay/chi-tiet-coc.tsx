import { NganKeo } from "../ngan-keo";
import { getCocChoPhanBo, getGmoQuaHan, getLinkCms } from "@/lib/queries";

const n = (v: string | number | null) =>
  v === null ? "—" : Math.round(Number(v)).toLocaleString("vi-VN");

const ngayVn = (iso: string | null) =>
  iso === null ? "—" : `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** Chờ quá ngần này ngày thì không còn là "đang xử lý" nữa. */
const QUA_LAU = 14;

/**
 * Phiếu cọc đã thu tiền mà chưa gán vào tháng cước nào.
 *
 * Tiền đã nằm trong tài khoản 3M nhưng nợ của khách chưa được trừ, nên tới
 * khi có người ngồi phân bổ thì hai bên vẫn nhìn số khác nhau — khách tưởng
 * đã trả, sổ vẫn ghi nợ.
 */
export async function ChiTietCocChoPhanBo({
  dongLai,
  bac,
  nhom,
}: {
  dongLai: string;
  /** Một bậc tuổi chờ, bỏ trống là mọi phiếu. */
  bac?: string;
  nhom?: string;
}) {
  const [rows, linkDuyet] = await Promise.all([
    getCocChoPhanBo(bac),
    getLinkCms("fixed_cms_deposit_url"),
  ]);
  const tien = rows.reduce((t, r) => t + Number(r.tien), 0);
  const lau = rows.filter((r) => Number(r.cho_ngay ?? 0) >= QUA_LAU).length;
  const chuaThang = rows.filter((r) => !r.co_san_thang).length;

  return (
    <NganKeo dongLai={dongLai}>
      <h1>
        Phiếu cọc chờ duyệt
        {nhom !== undefined && <span className="muted"> · {nhom}</span>}
      </h1>
      <p className="muted">
        {n(rows.length)} phiếu, <b>{n(tien)}</b> yên. Khách đã trả tiền, tiền đã vào
        tài khoản, nhưng phiếu chưa được duyệt nên nợ của khách vẫn chưa được trừ.
        {lau > 0 && ` ${n(lau)} phiếu đã chờ từ ${QUA_LAU} ngày trở lên.`}
        {chuaThang > 0 &&
          ` ${n(chuaThang)} phiếu lúc tạo mã không chọn tháng cước, người duyệt phải tự tra — đó là phần nằm lâu nhất.`}
      </p>

      {linkDuyet !== null && (
        <p className="actions">
          <a href={linkDuyet} target="_blank" rel="noreferrer">
            <button type="button">Mở màn duyệt bên CMS →</button>
          </a>
          <span className="muted">
            {" "}
            màn đó không nhận mã hợp đồng trên địa chỉ, nên phải gõ mã vào ô tìm
          </span>
        </p>
      )}

      {rows.length === 0 ? (
        <p className="muted">Không còn phiếu nào chờ.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Hợp đồng</th>
              <th>Địa chỉ</th>
              <th className="num">Tiền</th>
              <th>Khách trả</th>
              <th>Tháng cước</th>
              <th className="num">Chờ</th>
              <th className="num">Đang nợ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.source_id}>
                <td className="mono">
                  {r.url === null ? (
                    (r.ma_hd ?? "—")
                  ) : (
                    <a href={r.url} target="_blank" rel="noreferrer">
                      {r.ma_hd ?? "mở CMS"}
                    </a>
                  )}
                </td>
                <td className="muted">{r.dia_chi ?? "—"}</td>
                <td className="num mono">{n(r.tien)}</td>
                <td className="mono muted">{ngayVn(r.ngay_tra)}</td>
                <td>
                  {r.co_san_thang ? (
                    <span className="muted">đã chọn sẵn</span>
                  ) : (
                    <span className="tag warn">phải tự tra</span>
                  )}
                </td>
                <td
                  className={`num mono${Number(r.cho_ngay ?? 0) >= QUA_LAU ? " bad" : " muted"}`}
                >
                  {r.cho_ngay === null ? "—" : `${n(r.cho_ngay)} ngày`}
                </td>
                <td className="num mono muted">
                  {Number(r.con_no ?? 0) === 0 ? "—" : n(r.con_no)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </NganKeo>
  );
}

/**
 * Mã combini hết hạn mà khách không ra trả.
 *
 * Mã không tự sống lại: muốn thu tiếp phải tạo mã mới. Nên đống này không phải
 * "đang chờ" mà là việc tồn — mỗi dòng là một lần hẹn thu đã hỏng.
 */
export async function ChiTietGmoQuaHan({ dongLai }: { dongLai: string }) {
  const rows = await getGmoQuaHan();
  // KHÔNG cộng cột tiền: một hợp đồng tạo lại mã nhiều lần nên cộng là nhân
  // bản cùng một khoản. Nợ thật lấy một lần cho mỗi hợp đồng.
  const theoHd = new Map(rows.map((r) => [r.ma_hd ?? r.lan, Number(r.con_no ?? 0)]));
  const no = [...theoHd.values()].reduce((t, v) => t + v, 0);
  const conNo = [...theoHd.values()].filter((v) => v > 0).length;

  return (
    <NganKeo dongLai={dongLai}>
      <h1>Mã combini hết hạn</h1>
      <p className="muted">
        {n(rows.length)} lần hẹn thu hỏng trên {n(theoHd.size)} hợp đồng — mã hết
        hạn không tự sống lại, muốn thu phải tạo mã mới, nên một hợp đồng có thể
        xuất hiện nhiều lần ở đây. Cộng cột tiền là cộng trùng cùng một khoản;
        nợ thật của nhóm này là <b>{n(no)}</b> yên ở {n(conNo)} hợp đồng, số còn
        lại đã thu được bằng đường khác.
      </p>

      {rows.length === 0 ? (
        <p className="muted">Không có mã nào hết hạn.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Hợp đồng</th>
              <th>Địa chỉ</th>
              <th className="num">Tiền</th>
              <th>Loại</th>
              <th>Hết hạn</th>
              <th className="num">Quá</th>
              <th className="num">Lần hỏng</th>
              <th className="num">Đang nợ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.lan}>
                <td className="mono">
                  {r.url === null ? (
                    (r.ma_hd ?? "—")
                  ) : (
                    <a href={r.url} target="_blank" rel="noreferrer">
                      {r.ma_hd ?? "mở CMS"}
                    </a>
                  )}
                </td>
                <td className="muted">{r.dia_chi ?? "—"}</td>
                <td className="num mono">{n(r.tien)}</td>
                <td className="muted">{r.loai_ten}</td>
                <td className="mono muted">{ngayVn(r.ngay_het_han)}</td>
                <td className="num mono muted">
                  {r.qua_han_ngay === null ? "—" : `${n(r.qua_han_ngay)} ngày`}
                </td>
                <td className="num mono muted">
                  {Number(r.so_lan_hong) > 1 ? n(r.so_lan_hong) : "—"}
                </td>
                <td className={`num mono${Number(r.con_no ?? 0) > 0 ? " bad" : " muted"}`}>
                  {Number(r.con_no ?? 0) === 0 ? (
                    <span className="muted" title="đã thu được bằng đường khác">
                      đã thu
                    </span>
                  ) : (
                    n(r.con_no)
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
