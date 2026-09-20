import Link from "next/link";
import { NganKeo } from "../../ngan-keo";
import { getKyCuocThang } from "@/lib/queries";
import { HOA_DON, HOP_DONG, LOAI_KHACH, MAU_HOP_DONG, MAU_LOAI_KHACH } from "@/lib/nhan";

const n = (v: string | number | null) =>
  v === null ? "—" : Math.round(Number(v)).toLocaleString("vi-VN");

const MAU_HD: Record<string, string> = {
  PAID: "ok",
  ISSUED: "cho",
  UNPAYABLE: "do",
  VOID: "tat",
};

/** Ngăn kéo một đợt thu: từng kỳ cước của tháng đó. */
export async function ChiTietDot({
  ky,
  lk,
  hd,
  dongLai,
}: {
  ky: string;
  lk: string;
  hd: string;
  dongLai: string;
}) {
  const tatCa = await getKyCuocThang(ky);
  const theoLk = lk ? tatCa.filter((r) => (r.loai_khach ?? "khong-ro") === lk) : tatCa;
  const theoHd = hd ? tatCa.filter((r) => r.trang_thai_hd === hd) : tatCa;
  const rows = theoHd.filter((r) => !lk || (r.loai_khach ?? "khong-ro") === lk);

  const tien = rows.reduce((t, r) => t + Number(r.tien), 0);
  const nut = (khoa: "lk" | "hd", k: string, nhan: string, dang: string, so: number) => {
    const p = new URLSearchParams({ ky });
    if (k) p.set(khoa, k);
    if (khoa === "lk" && hd) p.set("hd", hd);
    if (khoa === "hd" && lk) p.set("lk", lk);
    return (
      <Link key={khoa + k} href={`/cam-tay/dot-thu?${p.toString()}`}>
        <button type="button" className={dang === k ? "primary" : undefined}>
          {nhan} · {n(so)}
        </button>
      </Link>
    );
  };

  return (
    <NganKeo dongLai={dongLai}>
      <h1>Đợt thu cước {ky}</h1>
      <p className="muted">
        {n(rows.length)} kỳ cước
        {rows.length !== tatCa.length && ` trên tổng ${n(tatCa.length)}`} · {n(tien)} yên.
      </p>

      <p className="actions">
        {nut("hd", "", "mọi kết quả", hd, theoLk.length)}
        {["PAID", "ISSUED", "UNPAYABLE", "VOID"].map((k) => {
          const so = theoLk.filter((r) => r.trang_thai_hd === k).length;
          return so === 0 ? null : nut("hd", k, HOA_DON[k] ?? k, hd, so);
        })}
      </p>

      <p className="actions">
        {nut("lk", "", "mọi loại khách", lk, theoHd.length)}
        {["CUSTOMER", "COLLABORATOR", "AGENCY", "khong-ro"].map((k) => {
          const so = theoHd.filter((r) => (r.loai_khach ?? "khong-ro") === k).length;
          return so === 0
            ? null
            : nut("lk", k, k === "khong-ro" ? "không rõ loại" : (LOAI_KHACH[k] ?? k), lk, so);
        })}
      </p>

      {rows.length === 0 ? (
        <p className="empty">Không có kỳ nào khớp.</p>
      ) : (
        <div className="scroller">
          <table>
            <thead>
              <tr>
                <th>Thuê bao</th>
                <th>Khách</th>
                <th>Máy</th>
                <th className="num">Tiền</th>
                <th>Kết quả thu</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.fee_line_id}>
                  <td className="mono">
                    {r.subscription_id}
                    {r.tb_da_xoa && (
                      <div>
                        <span className="chip do">đã xoá ở nguồn</span>
                      </div>
                    )}
                    {r.trang_thai_tb && (
                      <div>
                        <span className={`chip ${MAU_HOP_DONG[r.trang_thai_tb] ?? "tat"}`}>
                          {HOP_DONG[r.trang_thai_tb] ?? r.trang_thai_tb}
                        </span>
                      </div>
                    )}
                    {r.goi && <div className="muted">{r.goi}</div>}
                  </td>
                  <td className="muted">
                    {r.khach}
                    {r.ma_khach && <div className="mono">{r.ma_khach}</div>}
                    {r.loai_khach && (
                      <div>
                        <span className={`chip ${MAU_LOAI_KHACH[r.loai_khach] ?? "tat"}`}>
                          {LOAI_KHACH[r.loai_khach] ?? r.loai_khach}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="mono muted">{r.ma_thiet_bi ?? "—"}</td>
                  <td className="num mono">{n(r.tien)}</td>
                  <td>
                    <span className={`chip ${MAU_HD[r.trang_thai_hd ?? ""] ?? "tat"}`}>
                      {HOA_DON[r.trang_thai_hd ?? ""] ?? r.trang_thai_hd ?? "—"}
                    </span>
                    {r.tra_mot_phan && (
                      <div className="chip cho">đã nhận {n(r.tien_da_nhan)}</div>
                    )}
                    {r.so_hoa_don && <div className="mono muted">{r.so_hoa_don}</div>}
                    {r.han_tra && <div className="mono muted">hạn {r.han_tra}</div>}
                  </td>
                  <td className="khong-xuong-dong">
                    {r.link_cms && (
                      <a href={r.link_cms} target="_blank" rel="noreferrer">
                        CMS →
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </NganKeo>
  );
}
