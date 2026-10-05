import Link from "next/link";
import { NganKeo } from "../ngan-keo";
import { getDotThuChotLuc, getDotThuCoDinh, getThangCoSoLieu, type DotThuCoDinh } from "@/lib/queries";
import {
  CHUA_GHI, TEN_TK, TRU_COC, cacMoc, khoang, mocCua, nhanCot, nhanKhoang, nhip, nhipCua,
  tapNeo, tong, xepTaiKhoan, type GocNhin, type PhamVi,
} from "./pham-vi";
import { lopNgay, nhanNgay } from "../hom-nay/bang-ngay";
import { ChiTietKyHut, ChiTietThuNgoai, LoHong } from "./lo-hong";

export const dynamic = "force-dynamic";

const n = (v: string | number | null) =>
  v === null ? "—" : Number(v).toLocaleString("vi-VN");

type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Số tháng cho người dùng bấm chọn; xa hơn thì đổi phạm vi sang năm. */
const SO_THANG_HIEN = 14;

const PV: PhamVi[] = ["thang", "nam"];
const NHAN_PV: Record<PhamVi, string> = {
  nam: "Cả năm",
  thang: "Một tháng",
};

/** Một câu nói rõ vì sao CMS bỏ nhóm đó, để người đọc không phải tra code. */
const GIAI_THICH: Record<string, string> = {
  "đợt chưa ghi tài khoản thu": "báo cáo lọc collectionAccount IS NOT NULL nên loại thẳng",
  "đợt chưa duyệt": "chỉ tính đợt đã duyệt, hoặc phiếu cha đánh dấu tất toán tay",
  "tháng miễn phí": "kỳ được miễn phí thì không phải tiền thu",
  "đợt tiền bằng 0": "báo cáo lọc amount > 0",
  "phiếu cha đã bị xoá ở nguồn": "đợt còn sống mà phiếu cha đã bị xoá bên CMS",
  "phiếu cha chưa duyệt": "chỉ tính phiếu cha đã duyệt",
  "hợp đồng chưa lắp xong": "báo cáo chỉ tính hợp đồng INSTALLATION_COMPLETED",
  "hợp đồng chưa có giá cước": "báo cáo chỉ tính hợp đồng có cước tháng > 0",
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
    return `/tien?${p}`;
  };

  // Đối chiếu: tập đầy đủ trong phạm vi (chưa lọc theo luật CMS), rồi trừ dần
  // từng lý do để ra đúng con số bên đó.
  const trongPhamVi =
    gn === "ky"
      ? tatCa.filter((r) => (!tu || r.ky >= tu) && r.ky <= den)
      : tatCa.filter((r) => (!tu || r.thang_tien_ve >= tu) && r.thang_tien_ve <= den);
  const layLyDo = (r: (typeof trongPhamVi)[number]) =>
    gn === "ky" ? r.ly_do_ngoai_cuoc : r.ly_do_ngoai_tai_khoan;
  const khopRows = trongPhamVi.filter((r) => !layLyDo(r));
  const biCap =
    gn === "tien-ve"
      ? khopRows.reduce((t, r) => t + Number(r.tien_bi_cap), 0)
      : 0;
  const doiChieu = {
    tatCaRows: trongPhamVi,
    khopRows,
    bi_cap: biCap,
    khop: tong(khopRows) - biCap,
    ten_bao_cao:
      gn === "ky" ? "Báo cáo thống kê cước phí (CMS)" : "Báo cáo tài khoản thu (CMS)",
    ly_do: [...new Set(trongPhamVi.map(layLyDo).filter((v): v is string => !!v))]
      .map((ten) => [ten, trongPhamVi.filter((r) => layLyDo(r) === ten)] as const)
      .sort((a, b) => tong(b[1]) - tong(a[1])),
  };

  const xuatHref = `/tien/xuat?pv=${pv}&gn=${gn}&thang=${thang}`;

  // Ngăn kéo mở theo tài khoản, hoặc theo lý do bị CMS loại — cùng một vỏ.
  const moTk = mot(sp.tk);
  const moLd = mot(sp.ld);
  const mo = moTk || moLd;
  const moRows = moTk
    ? rows.filter((r) => r.tai_khoan === moTk)
    : moLd
      ? trongPhamVi.filter((r) => layLyDo(r) === moLd)
      : [];
  const thangGan = danhSachThang.slice(0, SO_THANG_HIEN).reverse();
  const cacNam = [...new Set(danhSachThang.map((t) => t.thang.slice(0, 4)))].sort();

  const co = (hop: (r: DotThuCoDinh) => boolean) => rows.filter(hop);

  // Trục diễn biến. Gom một lần rồi tra, đừng lọc lại trong mỗi ô: tháng đông
  // có hơn nghìn đợt, nhân với 31 ngày × 7 tài khoản là quét thừa hai trăm lần.
  const moc = cacMoc(pv, thang);
  const theoMoc = new Map<string, DotThuCoDinh[]>();
  const ngoaiMoc: DotThuCoDinh[] = [];
  for (const r of rows) {
    const m = mocCua(r, pv, gn, thang);
    if (m === null) ngoaiMoc.push(r);
    else (theoMoc.get(m) ?? theoMoc.set(m, []).get(m)!).push(r);
  }
  const homNay = new Date().toISOString().slice(0, 10);

  return (
    <main>
      <h1>Tiền · wifi cố định · {khung}</h1>
      <p className="muted">
        Cùng một dòng tiền nhưng <b>hai trục khác nhau</b> — kỳ cước (tiền này
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
            <Link key={g} href={lk({ gn: g, tk: undefined, ld: undefined })}>
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
            <Link
              key={p}
              href={lk({
                pv: p,
                // Cả năm thì chốt tháng về cuối năm: giữ tháng cũ thì URL và tên
                // file Excel đọc ra như đang xem một tháng.
                thang: p === "nam" ? `${thang.slice(0, 4)}-12` : thang,
                tk: undefined,
                ld: undefined,
              })}
            >
              <button type="button" className={pv === p ? "primary" : undefined}>
                {NHAN_PV[p]}
              </button>
            </Link>
          ))}
        </p>
        <p className="actions">
          {pv === "nam"
            ? cacNam.map((y) => (
                <Link key={y} href={lk({ thang: `${y}-12`, tk: undefined, ld: undefined })}>
                  <button
                    type="button"
                    className={thang.slice(0, 4) === y ? "primary" : undefined}
                  >
                    {y}
                  </button>
                </Link>
              ))
            : thangGan.map((t) => (
                <Link key={t.thang} href={lk({ thang: t.thang, tk: undefined, ld: undefined })}>
                  <button type="button" className={t.thang === thang ? "primary" : undefined}>
                    {t.thang}
                  </button>
                </Link>
              ))}
        </p>
      </div>

      <p className="actions">
        <a href={xuatHref}>
          <button type="button" className="primary">
            Xuất Excel {khung}
          </button>
        </a>
      </p>

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

      <h2>
        Diễn biến {pv === "thang" ? "theo ngày" : "theo tháng"} · {khung}
      </h2>
      <p className="muted">
        {pv === "thang" ? (
          <>
            Bảng trên cho biết tiền về <b>đâu</b>, bảng này cho biết tiền về{" "}
            <b>ngày nào</b>. Mốc ngày lấy theo <b>ngày tiền về</b> kể cả khi đang
            neo vào kỳ cước — kỳ cước chỉ tới tháng, không có ngày. Thứ Bảy và
            Chủ nhật tô nền khác.
          </>
        ) : (
          <>
            Mười hai tháng của năm, cắt theo đúng trục đang neo (
            <b>{gn === "ky" ? "kỳ cước" : "ngày tiền về"}</b>). Tháng trống là
            tháng thật sự không có đồng nào, không phải thiếu dữ liệu.
          </>
        )}
      </p>
      <div className="scroller">
        <table className="bang-thang">
          <thead>
            <tr>
              <th>{pv === "thang" ? "Ngày" : "Tháng"}</th>
              {taiKhoan.map((tk) => (
                <th key={tk} className="num">
                  {TEN_TK[tk] ?? tk}
                </th>
              ))}
              <th className="num">Số đợt</th>
              <th className="num">Tổng</th>
            </tr>
          </thead>
          <tbody>
            {moc.map((m) => {
              const d = theoMoc.get(m) ?? [];
              return (
                <tr
                  key={m}
                  className={pv === "thang" ? lopNgay(m, homNay) : undefined}
                >
                  <td className="mono">
                    {pv === "thang" ? nhanNgay(m, homNay) : m}
                  </td>
                  {taiKhoan.map((tk) => {
                    const v = tong(d.filter((r) => r.tai_khoan === tk));
                    return (
                      <td key={tk} className={`num mono${v === 0 ? " muted" : ""}`}>
                        {v === 0 ? "—" : n(v)}
                      </td>
                    );
                  })}
                  <td className="num mono muted">{d.length === 0 ? "—" : n(d.length)}</td>
                  <td className="num mono">
                    {d.length === 0 ? <span className="muted">—</span> : <b>{n(tong(d))}</b>}
                  </td>
                </tr>
              );
            })}
            {ngoaiMoc.length > 0 && (
              <tr>
                <td>
                  <b>Về ngoài {khung}</b>
                  <div className="muted">
                    cước của {khung} nhưng tiền về tháng khác — vẫn nằm trong tổng ở
                    bảng trên, chỉ không có chỗ trên trục ngày
                  </div>
                </td>
                {taiKhoan.map((tk) => {
                  const v = tong(ngoaiMoc.filter((r) => r.tai_khoan === tk));
                  return (
                    <td key={tk} className={`num mono${v === 0 ? " muted" : ""}`}>
                      {v === 0 ? "—" : n(v)}
                    </td>
                  );
                })}
                <td className="num mono muted">{n(ngoaiMoc.length)}</td>
                <td className="num mono">
                  <b>{n(tong(ngoaiMoc))}</b>
                </td>
              </tr>
            )}
            <tr className="hang-tong">
              <td>
                <b>Tổng</b>
              </td>
              {taiKhoan.map((tk) => (
                <td key={tk} className="num mono">
                  {n(tong(rows.filter((r) => r.tai_khoan === tk)))}
                </td>
              ))}
              <td className="num mono">{n(rows.length)}</td>
              <td className="num mono">{n(tongRows)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <LoHong moTai="/tien" />

      <h2>Đối chiếu với báo cáo của CMS</h2>
      <p className="muted">
        Màn hình này <b>không bỏ rơi đợt nào</b>, còn báo cáo bên CMS lọc bớt. Trừ từng lý do
        ra thì về đúng con số bên đó — nếu lệch thì là bên em tính sai, không phải &ldquo;hai
        báo cáo khác nhau&rdquo;.
      </p>
      <div className="scroller">
        <table className="bang-thang">
          <thead>
            <tr>
              <th>Mục</th>
              <th className="num">Số đợt</th>
              <th className="num">Số tiền</th>
              <th>Vì sao CMS loại</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <b>Tổng đầy đủ — màn hình này</b>
              </td>
              <td className="num mono">{n(doiChieu.tatCaRows.length)}</td>
              <td className="num mono">{n(tong(doiChieu.tatCaRows))}</td>
              <td className="muted">mọi đợt trong phạm vi, không lọc gì</td>
            </tr>
            {doiChieu.ly_do.map(([ten, d]) => (
              <tr key={ten}>
                <td>
                  − <Link href={lk({ ld: ten, tk: undefined })}>{ten}</Link>
                </td>
                <td className="num mono muted">{n(d.length)}</td>
                <td className="num mono bad">−{n(tong(d))}</td>
                <td className="muted">
                  {GIAI_THICH[ten] ?? "bộ lọc của báo cáo bên CMS"}
                  {" · "}
                  <Link href={lk({ ld: ten, tk: undefined })}>xem danh sách →</Link>
                </td>
              </tr>
            ))}
            {doiChieu.bi_cap > 0 && (
              <tr>
                <td>− Phần vượt cước tháng bị cắt</td>
                <td className="num mono muted">—</td>
                <td className="num mono bad">−{n(doiChieu.bi_cap)}</td>
                <td className="muted">
                  báo cáo tài khoản thu cap mỗi đợt ở mức cước tháng của hợp đồng
                </td>
              </tr>
            )}
            <tr className="hang-tong">
              <td>
                <b>= {doiChieu.ten_bao_cao}</b>
              </td>
              <td className="num mono">{n(doiChieu.khopRows.length)}</td>
              <td className="num mono">{n(doiChieu.khop)}</td>
              <td className="muted">phải bằng đúng số hiện trên CMS</td>
            </tr>
          </tbody>
        </table>
      </div>

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
        <a href={xuatHref}>
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
        <NganKeo dongLai={lk({ tk: undefined, ld: undefined })}>
          <h1>{moTk ? (TEN_TK[moTk] ?? moTk) : moLd}</h1>
          <p className="muted">
            {moTk ? (
              <>
                {gn === "ky" ? "Cước" : "Tiền về"} {khung} qua tài khoản này:{" "}
                {n(tong(moRows))} yên, {n(moRows.length)} đợt.
              </>
            ) : (
              <>
                {n(moRows.length)} đợt · {n(tong(moRows))} yên bị{" "}
                <b>{doiChieu.ten_bao_cao}</b> loại khỏi thống kê.{" "}
                {GIAI_THICH[moLd] ?? "bộ lọc của báo cáo bên CMS"}. Tiền vẫn có thật, chỉ là
                bên đó không đếm.
              </>
            )}
          </p>
          <p className="actions">
            <a
              href={`/tien/xuat?pv=${pv}&gn=${gn}&thang=${thang}&${
                moTk ? `tk=${encodeURIComponent(moTk)}` : `ld=${encodeURIComponent(moLd)}`
              }`}
            >
              <button type="button" className="primary">
                Xuất Excel {n(moRows.length)} đợt
              </button>
            </a>
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
      {mot(sp.lo) === "ky-hut" && <ChiTietKyHut dongLai="/tien" />}
      {mot(sp.lo) === "thu-ngoai" && <ChiTietThuNgoai dongLai="/tien" />}
    </main>
  );
}
