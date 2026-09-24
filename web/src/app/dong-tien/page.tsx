import Link from "next/link";
import { NganKeo } from "../ngan-keo";
import { getDotThuChotLuc, getDotThuCoDinh, getThangCoSoLieu, type DotThuCoDinh } from "@/lib/queries";
import {
  CHUA_GHI, TEN_TK, TRU_COC, khoang, nhanCot, nhanKhoang, nhip, nhipCua, tapNeo, tong,
  xepTaiKhoan, type GocNhin, type PhamVi,
} from "./pham-vi";

export const dynamic = "force-dynamic";

const n = (v: string | number | null) =>
  v === null ? "—" : Number(v).toLocaleString("vi-VN");

type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Số tháng cho người dùng bấm chọn; xa hơn thì đổi phạm vi sang năm. */
const SO_THANG_HIEN = 14;

const PV: PhamVi[] = ["tat-ca", "nam", "thang"];
const NHAN_PV: Record<PhamVi, string> = {
  "tat-ca": "Từ đầu đến hết một tháng",
  nam: "Cả năm",
  thang: "Một tháng",
};

const NHAN_NHIP: Record<string, string> = { truoc: "trước", dung: "trong", sau: "sau" };

const GN: GocNhin[] = ["ky", "tien-ve"];
const NHAN_GN: Record<GocNhin, string> = {
  ky: "Theo kỳ cước",
  "tien-ve": "Theo tiền về tài khoản",
};

const TEN_NHIP: Record<GocNhin, Record<string, string>> = {
  ky: {
    truoc: "Khách trả trước — tiền về sớm hơn kỳ",
    dung: "Đúng nhịp — tiền về trong khoảng",
    sau: "Thu muộn — tiền về sau khoảng",
  },
  "tien-ve": {
    truoc: "Trả nợ kỳ cũ",
    dung: "Đúng kỳ",
    sau: "Nộp trước cho kỳ sau",
  },
};

export default async function Page({ searchParams }: { searchParams: Promise<Tham> }) {
  const sp = await searchParams;
  const [danhSachThang, chot] = await Promise.all([getThangCoSoLieu(), getDotThuChotLuc()]);

  const thangNay = new Date().toISOString().slice(0, 7);
  const thang =
    mot(sp.thang) ||
    danhSachThang.find((t) => t.thang <= thangNay)?.thang ||
    danhSachThang[0]?.thang ||
    thangNay;
  const pv: PhamVi = (PV as string[]).includes(mot(sp.pv)) ? (mot(sp.pv) as PhamVi) : "thang";
  const gn: GocNhin = (GN as string[]).includes(mot(sp.gn)) ? (mot(sp.gn) as GocNhin) : "ky";

  const { tu, den } = khoang(pv, thang);
  const nhipHien = nhipCua(pv);
  const tatCa = await getDotThuCoDinh(tu, den);
  const rows = tapNeo(tatCa, gn, tu, den);

  const khung = nhanKhoang(pv, thang);
  const cot = nhanCot(pv, thang);
  // Góc nhìn kỳ cước thì trục suy ra là tháng tiền về, và ngược lại.
  const tenTrucSuy = gn === "ky" ? "tiền về" : "kỳ cước";
  const taiKhoan = xepTaiKhoan(rows);
  const tienNganHang = tong(rows.filter((r) => !r.can_tru_coc));
  const tongRows = tong(rows);

  const lk = (t: Record<string, string | undefined>) => {
    const p = new URLSearchParams({ pv, gn, thang });
    for (const [k, v] of Object.entries(t)) {
      if (v === undefined) p.delete(k);
      else p.set(k, v);
    }
    return `/dong-tien?${p}`;
  };

  const mo = mot(sp.tk);
  const moRows = mo ? rows.filter((r) => r.tai_khoan === mo) : [];
  const thangGan = danhSachThang.slice(0, SO_THANG_HIEN).reverse();
  const cacNam = [...new Set(danhSachThang.map((t) => t.thang.slice(0, 4)))].sort();

  const co = (hop: (r: DotThuCoDinh) => boolean) => rows.filter(hop);

  return (
    <main>
      <h1>Kỳ cước và dòng tiền · {khung}</h1>
      <p className="muted">
        Wifi cố định. Cùng một dòng tiền nhưng <b>hai trục khác nhau</b> — kỳ cước (tiền này
        là cước tháng nào) và ngày tiền về (tiền vào tháng nào). 3M thu trước một tháng nên
        hai trục lệch gần đúng một nhịp. Chọn <b>góc nhìn</b> để neo vào một trục; trục kia
        được suy ra ở ba cột &ldquo;trước / trong / sau&rdquo;.
      </p>
      <p className="muted">
        Số liệu chốt lúc{" "}
        <b>{chot[0]?.chot_luc?.slice(0, 16).replace("T", " ") ?? "chưa rõ"}</b> — bên CMS nhân
        viên vẫn đang nhập phiếu, nên so hai bên phải so cùng thời điểm.
      </p>

      <div className="nhom-loc">
        <div className="muted nhan-nhom">Góc nhìn — neo vào trục nào</div>
        <p className="actions">
          {GN.map((g) => (
            <Link key={g} href={lk({ gn: g, tk: undefined })}>
              <button type="button" className={gn === g ? "primary" : undefined}>
                {NHAN_GN[g]}
              </button>
            </Link>
          ))}
        </p>
      </div>

      <div className="nhom-loc">
        <div className="muted nhan-nhom">Phạm vi thời gian</div>
        <p className="actions">
          {PV.map((p) => (
            <Link key={p} href={lk({ pv: p, tk: undefined })}>
              <button type="button" className={pv === p ? "primary" : undefined}>
                {NHAN_PV[p]}
              </button>
            </Link>
          ))}
        </p>
        <p className="actions">
          {pv === "nam"
            ? cacNam.map((y) => (
                <Link key={y} href={lk({ thang: `${y}-12`, tk: undefined })}>
                  <button
                    type="button"
                    className={thang.slice(0, 4) === y ? "primary" : undefined}
                  >
                    {y}
                  </button>
                </Link>
              ))
            : thangGan.map((t) => (
                <Link key={t.thang} href={lk({ thang: t.thang, tk: undefined })}>
                  <button type="button" className={t.thang === thang ? "primary" : undefined}>
                    {t.thang}
                  </button>
                </Link>
              ))}
        </p>
      </div>

      <h2>
        {gn === "ky"
          ? `Cước ${khung} đã thu ${n(tongRows)} — về những tài khoản nào`
          : `Tiền về ${khung} là ${n(tongRows)} — vào những tài khoản nào`}
      </h2>
      <p className="muted">
        {gn === "ky" ? (
          <>
            Neo vào <b>kỳ cước</b>, dựng đúng bộ lọc của <b>Báo cáo thống kê cước phí</b> bên
            CMS nên khớp từng đồng với ô &ldquo;Tổng đã thu&rdquo;. Khác với báo cáo tài khoản
            thu của CMS, ở đây <b>không đợt nào bị bỏ rơi</b>: đợt chưa ghi tài khoản vẫn có
            dòng riêng. Ba cột giữa cho biết tiền của các kỳ này về <b>lúc nào</b>.
          </>
        ) : (
          <>
            Neo vào <b>ngày tiền về</b> — đây là góc nhìn của báo cáo tài khoản thu bên CMS,
            hợp để đối chiếu sao kê ngân hàng. Ba cột giữa cho biết tiền này là cước của{" "}
            <b>kỳ nào</b>.
          </>
        )}{" "}
        Bấm một tài khoản để xem từng đợt.
      </p>
      <div className="scroller">
        <table className="bang-thang">
          <thead>
            <tr>
              <th>Tài khoản</th>
              <th className="num">Số đợt</th>
              {nhipHien.map((k) => (
                <th key={k} className="num">
                  {tenTrucSuy} {NHAN_NHIP[k]} {cot}
                </th>
              ))}
              <th className="num">Tổng</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {taiKhoan.map((tk) => {
              const d = rows.filter((r) => r.tai_khoan === tk);
              const canh =
                tk === TRU_COC
                  ? "cọc khách nộp trước qua combini, nay trừ sang cước — sao kê ghi ở tháng nộp cọc"
                  : tk === CHUA_GHI
                    ? "báo cáo tài khoản thu của CMS loại thẳng nhóm này"
                    : null;
              return (
                <tr key={tk}>
                  <td>
                    <Link href={lk({ tk })}>{TEN_TK[tk] ?? tk}</Link>
                    {canh && <div className="muted">{canh}</div>}
                  </td>
                  <td className="num mono muted">{n(d.length)}</td>
                  {nhipHien.map((k) => (
                    <td key={k} className="num mono">
                      {n(tong(d.filter((r) => nhip(r, gn, tu, den) === k)))}
                    </td>
                  ))}
                  <td className="num mono">{n(tong(d))}</td>
                  <td className="khong-xuong-dong">
                    <Link href={lk({ tk })}>xem →</Link>
                  </td>
                </tr>
              );
            })}
            <tr className="hang-tong">
              <td>
                <b>Tổng</b>
              </td>
              <td className="num mono">{n(rows.length)}</td>
              {nhipHien.map((k) => (
                <td key={k} className="num mono">
                  {n(tong(rows.filter((r) => nhip(r, gn, tu, den) === k)))}
                </td>
              ))}
              <td className="num mono">{n(tongRows)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      <p className="muted">
        Trong đó <b>{n(tienNganHang)} có giao dịch ngân hàng</b>;{" "}
        {n(tong(rows.filter((r) => r.can_tru_coc)))} còn lại là <b>cấn trừ cọc</b> — tiền thật,
        khách đã nộp trước qua combini, nhưng sao kê ghi ở tháng nộp cọc chứ không phải tháng
        trừ sang cước.
        {gn === "ky" && (
          <>
            {" "}
            Cột &ldquo;sau&rdquo; nghĩa là những kỳ này <b>vẫn đang thu tiếp</b> nên con số
            còn tăng.
          </>
        )}
      </p>

      <h2>Phân rã theo {tenTrucSuy}</h2>
      <div className="scroller">
        <table className="bang-thang">
          <thead>
            <tr>
              <th>Nhóm</th>
              <th className="num">Số đợt</th>
              <th className="num">Số tiền</th>
              <th className="num">Tỉ lệ</th>
            </tr>
          </thead>
          <tbody>
            {nhipHien.map((k) => {
              const d = rows.filter((r) => nhip(r, gn, tu, den) === k);
              return (
                <tr key={k}>
                  <td>{TEN_NHIP[gn][k]}</td>
                  <td className="num mono muted">{n(d.length)}</td>
                  <td className="num mono">{n(tong(d))}</td>
                  <td className="num mono muted">
                    {((tong(d) / Math.max(tongRows, 1)) * 100).toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>Cờ cảnh báo</h2>
      <div className="scroller">
        <table className="bang-thang">
          <thead>
            <tr>
              <th>Cần xử lý</th>
              <th className="num">Số đợt</th>
              <th className="num">Số tiền</th>
              <th>Việc</th>
            </tr>
          </thead>
          <tbody>
            {[
              {
                ten: "Đợt chưa ghi tài khoản thu",
                rows: co((r) => r.tai_khoan === CHUA_GHI),
                viec: "Người thu mở đợt, chọn tài khoản đã nhận tiền",
                nang: true,
              },
              {
                ten: "Đợt hoặc phiếu cha chưa duyệt",
                rows: co((r) => r.cho_duyet),
                viec: "Duyệt nốt; soát các đợt số tiền lẻ trước khi duyệt",
                nang: true,
              },
              {
                ten: "Phiếu cha đã bị xoá ở nguồn",
                rows: co((r) => r.phieu_da_xoa),
                viec: "Đợt còn sống mà phiếu cha mất — kiểm tra trên CMS",
                nang: true,
              },
              {
                ten: "Cấn trừ cọc — sao kê nằm ở tháng nộp cọc",
                rows: co((r) => r.can_tru_coc),
                viec: "Không phải lỗi: tiền thật đã vào qua combini từ trước, chỉ khác tháng",
                nang: false,
              },
            ].map((c) =>
              c.rows.length === 0 ? null : (
                <tr key={c.ten}>
                  <td>{c.ten}</td>
                  <td className="num mono muted">{n(c.rows.length)}</td>
                  <td className={`num mono${c.nang ? " bad" : ""}`}>{n(tong(c.rows))}</td>
                  <td className="muted">{c.viec}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      <p className="actions">
        <a href={`/dong-tien/xuat?pv=${pv}&gn=${gn}&thang=${thang}`}>
          <button type="button" className="primary">
            Xuất Excel {khung}
          </button>
        </a>
      </p>

      <p className="muted khoi-ghi-chu">
        Màn hình này <b>không dựng lại &ldquo;tổng phải thu&rdquo; và &ldquo;chưa thu&rdquo;</b>{" "}
        của CMS. Hai số đó tính theo luật dồn tích riêng bên đó (khoảng thu phí của từng hợp
        đồng, tháng miễn phí, khoản tất toán tay), dựng lại mà lệch một đồng thì hại hơn là
        không có — cần thì xem thẳng ở Báo cáo thống kê cước phí.
      </p>

      {mo && (
        <NganKeo dongLai={lk({ tk: undefined })}>
          <h1>{TEN_TK[mo] ?? mo}</h1>
          <p className="muted">
            {gn === "ky" ? "Cước" : "Tiền về"} {khung} qua tài khoản này: {n(tong(moRows))} yên,{" "}
            {n(moRows.length)} đợt.
          </p>
          <div className="scroller">
            <table>
              <thead>
                <tr>
                  <th>Mã hợp đồng</th>
                  <th>Địa chỉ lắp</th>
                  <th>Kỳ cước</th>
                  <th>Ngày thu</th>
                  <th className="num">Số tiền</th>
                  <th>Nhịp</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {moRows.map((r) => (
                  <tr key={r.source_id}>
                    <td className="mono">{r.ma_hd ?? "—"}</td>
                    <td className="muted">{r.dia_chi ?? "—"}</td>
                    <td className="mono">{r.ky}</td>
                    <td className="mono">{r.ngay_thu ?? "chưa ghi ngày"}</td>
                    <td className="num mono">{n(r.so_tien)}</td>
                    <td className="muted">
                      {tenTrucSuy} {NHAN_NHIP[nhip(r, gn, tu, den)]} {cot}
                    </td>
                    <td className="muted">
                      {r.cho_duyet ? <span className="chip cho">chờ duyệt</span> : r.trang_thai_dot}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </NganKeo>
      )}
    </main>
  );
}
