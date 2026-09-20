import Link from "next/link";
import { ThanBam } from "../../than-bam";
import { getThuChuaCanTru, type ThuChuaCanTru } from "@/lib/queries";
import { KENH_THU, LOAI_KHACH, MAU_LOAI_KHACH } from "@/lib/nhan";

export const dynamic = "force-dynamic";

const n = (v: string | number | null) =>
  v === null ? "—" : Math.round(Number(v)).toLocaleString("vi-VN");

type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/**
 * Hai lý do khác hẳn nhau về việc phải làm: chưa cấn trừ thì đi cấn trừ, còn
 * cấn trừ rồi mà hoá đơn bị xoá thì phải hỏi vì sao xoá.
 */
const LY_DO: Record<string, string> = {
  CHUA_CAN_TRU: "chưa cấn trừ, hoặc cấn trừ đã bị huỷ",
  CAN_TRU_HOA_DON_XOA: "cấn trừ còn hiệu lực nhưng hoá đơn đã xoá",
};

/** Treo bao lâu thì đáng lo. Một tháng là còn kịp, quá quý là quên hẳn. */
const NGUONG_CU = 90;

const LOC: { ma: string; ten: string; lay: (r: ThuChuaCanTru) => string }[] = [
  { ma: "ld", ten: "Lý do", lay: (r) => LY_DO[r.ly_do] ?? r.ly_do },
  { ma: "kenh", ten: "Kênh thu", lay: (r) => KENH_THU[r.channel ?? ""] ?? r.channel ?? "(không rõ)" },
  {
    ma: "lk",
    ten: "Loại khách",
    lay: (r) => (r.loai_khach ? (LOAI_KHACH[r.loai_khach] ?? r.loai_khach) : "(không rõ loại)"),
  },
  { ma: "thang", ten: "Tháng thu", lay: (r) => r.thang },
];

export default async function Page({ searchParams }: { searchParams: Promise<Tham> }) {
  const sp = await searchParams;
  const tatCa = await getThuChuaCanTru();

  const chon = Object.fromEntries(LOC.map((l) => [l.ma, mot(sp[l.ma])]));
  const tim = mot(sp.q).trim().toLowerCase();

  let rows = tatCa;
  for (const l of LOC) {
    const v = chon[l.ma];
    if (v) rows = rows.filter((r) => l.lay(r) === v);
  }
  if (tim) {
    rows = rows.filter((r) =>
      [r.khach, r.ma_khach, r.reference, r.payment_id]
        .some((v) => v?.toLowerCase().includes(tim)),
    );
  }

  const cong = (d: ThuChuaCanTru[]) => d.reduce((t, r) => t + Number(r.amount), 0);
  const cu = tatCa.filter((r) => Number(r.so_ngay_treo) > NGUONG_CU);

  const link = (t: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...chon, q: mot(sp.q) || undefined, ...t })) {
      if (v) p.set(k, v);
    }
    const duoi = p.toString();
    return duoi ? `/cam-tay/chua-can-tru?${duoi}` : "/cam-tay/chua-can-tru";
  };

  return (
    <main>
      <h1>Tiền thu chưa gán vào hoá đơn</h1>
      <p className="muted">
        Khách đã trả tiền, tiền đã vào két, nhưng lượt thu đó chưa được cấn trừ vào hoá đơn
        nào còn hiệu lực — nên không kỳ cước nào ghi nhận là đã thu. Cấn trừ xong thì số này
        mới về đúng kỳ của nó. Danh sách đọc thẳng từ bảng cấn trừ bên nguồn, không suy đoán.
      </p>

      <div className="the-hang gon">
        <div className="the-so">
          <div className="the-ten">Tiền treo</div>
          <div className="the-gia-tri mono bad">{n(cong(tatCa))}</div>
          <div className="the-phu">{n(tatCa.length)} lượt thu</div>
        </div>
        <div className="the-so">
          <div className="the-ten">Treo quá {NGUONG_CU} ngày</div>
          <div className="the-gia-tri mono bad">{n(cong(cu))}</div>
          <div className="the-phu">{n(cu.length)} lượt</div>
        </div>
        <div className="the-so">
          <div className="the-ten">Treo lâu nhất</div>
          <div className="the-gia-tri mono">
            {n(Math.max(...tatCa.map((r) => Number(r.so_ngay_treo)), 0))}
          </div>
          <div className="the-phu">ngày</div>
        </div>
        <div className="the-so">
          <div className="the-ten">Khách khác nhau</div>
          <div className="the-gia-tri mono">
            {n(new Set(tatCa.map((r) => r.khach)).size)}
          </div>
          <div className="the-phu">đang có tiền treo</div>
        </div>
      </div>

      {LOC.map((l) => {
        const gia = [...new Set(tatCa.map(l.lay))].sort();
        if (gia.length < 2) return null;
        return (
          <p key={l.ma} className="actions">
            <Link href={link({ [l.ma]: undefined })}>
              <button type="button" className={chon[l.ma] === "" ? "primary" : undefined}>
                mọi {l.ten.toLowerCase()} · {n(tatCa.length)}
              </button>
            </Link>
            {gia.map((v) => (
              <Link key={v} href={link({ [l.ma]: v })}>
                <button type="button" className={chon[l.ma] === v ? "primary" : undefined}>
                  {v} · {n(tatCa.filter((r) => l.lay(r) === v).length)}
                </button>
              </Link>
            ))}
          </p>
        );
      })}

      <form method="get">
        <div className="formgrid">
          <label>
            Khách, mã khách, mã giao dịch
            <input type="text" name="q" defaultValue={mot(sp.q)} placeholder="tên, KH…" />
          </label>
          {LOC.map((l) => (
            <input key={l.ma} type="hidden" name={l.ma} value={chon[l.ma]} />
          ))}
          <div className="actions">
            <button className="primary" type="submit">
              Tìm
            </button>
            <Link href="/cam-tay/chua-can-tru">
              <button type="button">Bỏ hết lọc</button>
            </Link>
          </div>
        </div>
      </form>

      <p className="muted">
        {n(rows.length)} lượt · {n(cong(rows))} yên
      </p>

      {rows.length === 0 ? (
        <p className="empty">Không có lượt thu nào khớp.</p>
      ) : (
        <div className="scroller">
          <table className="bang-thang">
            <thead>
              <tr>
                <th>Ngày thu</th>
                <th>Khách</th>
                <th className="num">Số tiền</th>
                <th>Kênh</th>
                <th>Mã giao dịch</th>
                <th className="num">Treo</th>
                <th>Lý do</th>
                <th />
              </tr>
            </thead>
            <ThanBam>
              {rows.map((r) => (
                <tr key={r.payment_id}>
                  <td className="mono">{r.paid_at.slice(0, 10)}</td>
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
                  <td className="num mono">{n(r.amount)}</td>
                  <td className="muted">{KENH_THU[r.channel ?? ""] ?? r.channel ?? "—"}</td>
                  <td className="mono muted">{r.reference ?? "—"}</td>
                  <td
                    className={`num mono${Number(r.so_ngay_treo) > NGUONG_CU ? " bad" : " muted"}`}
                  >
                    {n(r.so_ngay_treo)} ngày
                  </td>
                  <td>
                    <span
                      className={`chip ${r.ly_do === "CHUA_CAN_TRU" ? "cho" : "do"}`}
                    >
                      {LY_DO[r.ly_do] ?? r.ly_do}
                    </span>
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
            </ThanBam>
          </table>
        </div>
      )}
    </main>
  );
}
