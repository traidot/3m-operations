import Link from "next/link";
import { ThanBam } from "../../than-bam";
import { ChongNgang, type Phan } from "../../chong-ngang";
import {
  getKhoDoiChieu,
  getKhoLanNhap,
  getKhoThieuOFile,
  type KhoDoiChieu,
} from "@/lib/queries";
import { KHO_PM, PHIEU_KHO } from "@/lib/nhan";

export const dynamic = "force-dynamic";

const n = (v: string | number | null) =>
  v === null ? "—" : Number(v).toLocaleString("vi-VN");

type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Số thứ tự đầu mỗi kết luận trong file ("03. Không có trong sổ…"). */
const maKetLuan = (s: string | null) => (s ?? "").slice(0, 2);

const PHAN: Phan[] = [
  { ma: "O_KHACH", ten: "ở khách", mau: "var(--lam)" },
  { ma: "TRONG_KHO", ten: "trong kho", mau: "var(--ok)" },
  { ma: "TRA_NCC", ten: "trả nhà cung cấp", mau: "var(--tim)" },
  { ma: "CHI_NHA_MANG", ten: "chỉ thấy ở nhà mạng", mau: "var(--warn)" },
  { ma: "PM_KHONG_BIET", ten: "phần mềm không có", mau: "var(--do)" },
];

const MAU_CHIP: Record<string, string> = {
  O_KHACH: "ok",
  TRONG_KHO: "ok",
  TRA_NCC: "tat",
  CHI_NHA_MANG: "cho",
  PM_KHONG_BIET: "do",
};

/** Mỗi bộ lọc là một câu hỏi người dùng thật sự hỏi, không phải một cột của view. */
const LOC: { ma: string; ten: string; lay: (r: KhoDoiChieu) => string }[] = [
  { ma: "nh", ten: "Nhóm hàng ở file", lay: (r) => r.nhom_hang ?? "(trống)" },
  { ma: "kl", ten: "Kết luận ở file", lay: (r) => maKetLuan(r.ket_luan) },
  { ma: "kho", ten: "Kho theo phiếu", lay: (r) => r.pm_kho ?? "(chưa có phiếu)" },
  { ma: "may", ten: "Đời máy phần mềm ghi", lay: (r) => r.pm_doi_may ?? "(không có)" },
  {
    ma: "so",
    ten: "Có trong sổ quản lý",
    lay: (r) => (Number(r.so_dong_so ?? 0) > 0 ? "có" : "không"),
  },
  { ma: "nm", ten: "Nhà mạng", lay: (r) => r.pm_nha_mang ?? "(không có)" },
];

/**
 * Phần ngoài phần mềm không phải một đống đồng nhất mà là ba khối khác hẳn nhau
 * về việc phải làm, nên tách theo số thứ tự kết luận của file.
 */
const KHOI_NGOAI: { ma: string; ten: string; giai_thich: string; hop: (k: string) => boolean }[] = [
  {
    ma: "da_ra_khoi",
    ten: "Đã ra khỏi công ty",
    giai_thich: "trả lại nhà cung cấp — về rồi trả luôn, không qua phần mềm đầu nào",
    hop: (k) => k === "01",
  },
  {
    ma: "sim_dung",
    ten: "SIM đã dừng",
    giai_thich: "đã huỷ hoặc đã trả lại nhà mạng theo rà soát, phần mềm chưa từng có",
    hop: (k) => k === "05" || k === "06",
  },
  {
    ma: "con_lai",
    ten: "Còn lại, phải xử lý",
    giai_thich: "có trong sổ hoặc thấy khi kiểm kho mà phần mềm không có mã",
    hop: (k) => !["01", "05", "06"].includes(k),
  },
];

/** Nhãn cho bộ lọc kết luận: hiện cả câu chứ không phải mỗi số thứ tự. */
const nhanKetLuan = (rows: KhoDoiChieu[], gia: string) =>
  rows.find((r) => maKetLuan(r.ket_luan) === gia)?.ket_luan ?? gia;

export default async function Page({ searchParams }: { searchParams: Promise<Tham> }) {
  const sp = await searchParams;
  const [tatCa, thieu, lan] = await Promise.all([
    getKhoDoiChieu(),
    getKhoThieuOFile(),
    getKhoLanNhap(),
  ]);

  const pm = mot(sp.pm);
  const tim = mot(sp.q).trim().toLowerCase();
  const chon = Object.fromEntries(LOC.map((l) => [l.ma, mot(sp[l.ma])]));

  const trong = tatCa.filter((r) => r.pm_ket_luan !== "PM_KHONG_BIET");
  const ngoai = tatCa.filter((r) => r.pm_ket_luan === "PM_KHONG_BIET");
  const phan = mot(sp.phan);

  let rows = tatCa;
  if (phan === "trong") rows = trong;
  if (phan === "ngoai") rows = ngoai;
  if (pm) rows = rows.filter((r) => r.pm_ket_luan === pm);
  for (const l of LOC) {
    const v = chon[l.ma];
    if (v) rows = rows.filter((r) => l.lay(r) === v);
  }
  if (tim) {
    rows = rows.filter((r) =>
      [r.ma, r.pm_khach, r.pm_ma_khach, r.nguoi_giu, r.vi_tri_so]
        .some((v) => v?.toLowerCase().includes(tim)),
    );
  }

  const dem = (ma: string) => tatCa.filter((r) => r.pm_ket_luan === ma).length;
  const coLoc = pm !== "" || tim !== "" || phan !== "" || LOC.some((l) => chon[l.ma]);

  // Giữ nguyên các bộ lọc khác khi bấm vào một bộ lọc.
  const giu = {
    ...chon,
    q: mot(sp.q) || undefined,
    pm: pm || undefined,
    phan: phan || undefined,
  };
  const link = (t: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...giu, ...t })) if (v) p.set(k, v);
    const duoi = p.toString();
    return duoi ? `/cam-tay/kho?${duoi}` : "/cam-tay/kho";
  };

  /** Gom theo một chiều rồi đếm cơ cấu kết luận phần mềm bên trong. */
  const coCau = (lay: (r: KhoDoiChieu) => string) => {
    const m = new Map<string, Record<string, number>>();
    for (const r of tatCa) {
      const k = lay(r);
      const o = m.get(k) ?? {};
      o[r.pm_ket_luan] = (o[r.pm_ket_luan] ?? 0) + 1;
      m.set(k, o);
    }
    return [...m.entries()]
      .map(([ten, d]) => ({ ten, dem: d }))
      .sort(
        (a, b) =>
          Object.values(b.dem).reduce((x, y) => x + y, 0) -
          Object.values(a.dem).reduce((x, y) => x + y, 0),
      );
  };

  const dongKl = [...new Set(tatCa.map((r) => r.ket_luan ?? "(trống)"))].sort();
  const o = (k: string, p: string) =>
    tatCa.filter((r) => (r.ket_luan ?? "(trống)") === k && r.pm_ket_luan === p).length;

  return (
    <main>
      <h1>Đối chiếu kho</h1>

      {lan ? (
        <p className="khop">
          Số trên trang này là của file <b>{lan.ten_file}</b>, sửa lần cuối{" "}
          <b>{lan.sua_luc?.slice(0, 16).replace("T", " ") ?? "không rõ"}</b>, nhập vào lúc{" "}
          {lan.nhap_luc.slice(0, 16).replace("T", " ")} — {n(lan.so_ma)} mã nhập về và{" "}
          {n(lan.so_dong_so)} dòng sổ quản lý
          {Number(lan.so_ma_trung) > 0 &&
            `, bỏ ${n(lan.so_ma_trung)} mã trùng trong chính file`}
          . Bản đối chiếu kho chỉ đúng tại thời điểm chốt, để lâu là lệch.
        </p>
      ) : (
        <p className="stale">
          Chưa nhập file đối chiếu nào. Chạy <code>npm run kho:nhap -- &lt;file.xlsx&gt;</code>{" "}
          trong thư mục <code>agent</code>.
        </p>
      )}

      <p className="muted">
        Phần mềm có module kho riêng — 4 kho, 13.327 dòng phiếu trên 5.706 mã — mà bản đối
        chiếu này đang dựng lại bằng tay. Cột “phần mềm” là kết luận <b>suy ra từ phiếu kho
        gần nhất</b>, không phải một cột có sẵn bên nguồn: phiếu xuất gần nhất thì máy đang
        ở khách, phiếu nhập gần nhất thì máy đã về kho. Mọi chỗ nối hai bên đều bỏ số 0 đầu
        của mã, vì kho có 68 mã SIM để số 0 còn file thì không.
      </p>

      <div className="the-hang gon">
        {PHAN.map((p) => (
          <Link key={p.ma} className="the-so" href={link({ pm: p.ma })}>
            <div className="the-ten">{KHO_PM[p.ma]}</div>
            <div className={`the-gia-tri mono${p.ma === "PM_KHONG_BIET" ? " bad" : ""}`}>
              {n(dem(p.ma))}
            </div>
            <div className="the-phu">
              {((dem(p.ma) / Math.max(tatCa.length, 1)) * 100).toFixed(1)}% số mã ở file
            </div>
          </Link>
        ))}
        <div className="the-so">
          <div className="the-ten">File không nhắc tới</div>
          <div className="the-gia-tri mono bad">{n(thieu.length)}</div>
          <div className="the-phu">mã phần mềm có phiếu kho mà file bỏ sót</div>
        </div>
      </div>

      <h2>Hai phần</h2>
      <div className="the-hang gon">
        <Link className="the-so" href={link({ phan: "trong", pm: undefined })}>
          <div className="the-ten">Trong phần mềm</div>
          <div className="the-gia-tri mono">{n(trong.length)}</div>
          <div className="the-phu">
            {((trong.length / Math.max(tatCa.length, 1)) * 100).toFixed(0)}% — phần mềm nói
            được mã này đang ở đâu
          </div>
        </Link>
        <Link className="the-so" href={link({ phan: "ngoai", pm: undefined })}>
          <div className="the-ten">Ngoài phần mềm</div>
          <div className="the-gia-tri mono bad">{n(ngoai.length)}</div>
          <div className="the-phu">
            {((ngoai.length / Math.max(tatCa.length, 1)) * 100).toFixed(0)}% — không có ở bất
            kỳ bảng nào bên nguồn
          </div>
        </Link>
      </div>

      <h3>Phần ngoài phần mềm gồm những gì</h3>
      <div className="scroller">
        <table className="bang-thang">
          <thead>
            <tr>
              <th>Khối</th>
              <th className="num">Số mã</th>
              <th>Nhóm hàng</th>
              <th className="num">Có trong sổ</th>
              <th className="num">Thấy khi kiểm kho</th>
              <th className="num">Có ghi người giữ</th>
            </tr>
          </thead>
          <tbody>
            {KHOI_NGOAI.map((k) => {
              const d = ngoai.filter((r) => k.hop(maKetLuan(r.ket_luan)));
              const hang = [...new Set(d.map((r) => r.nhom_hang ?? "?"))].sort();
              return (
                <tr key={k.ma}>
                  <td>
                    {k.ten}
                    <div className="muted">{k.giai_thich}</div>
                  </td>
                  <td className="num mono">{n(d.length)}</td>
                  <td className="muted">{hang.join(", ") || "—"}</td>
                  <td className="num mono">
                    {n(d.filter((r) => r.vi_tri_so !== null).length)}
                  </td>
                  <td className="num mono">
                    {n(d.filter((r) => r.vi_tri_kiem_kho !== null).length)}
                  </td>
                  <td className="num mono">
                    {n(d.filter((r) => r.nguoi_giu !== null).length)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>Cơ cấu theo kết luận ở file</h2>
      <p className="muted">
        Mỗi hàng vẽ theo tỉ lệ trong chính hàng đó, tổng in ở cuối hàng — nhóm to nhỏ chênh
        nhau hàng nghìn lần nên vẽ theo số tuyệt đối thì nhóm nhỏ mất hút.
      </p>
      <ChongNgang nhom={coCau((r) => r.ket_luan ?? "(trống)")} phan={PHAN} rongNhan={290} />

      <h2>Cơ cấu theo nhóm hàng</h2>
      <ChongNgang nhom={coCau((r) => r.nhom_hang ?? "(trống)")} phan={PHAN} rongNhan={140} />

      <h2>Cơ cấu theo đời máy phần mềm ghi</h2>
      <p className="muted">
        Đời máy lấy từ hồ sơ cho thuê; máy chưa từng cho thuê thì lấy sản phẩm ghi trên
        dòng phiếu kho. Nhờ vậy biết được đời máy của{" "}
        <b>{n(tatCa.filter((r) => r.pm_doi_may !== null).length)}</b> trên{" "}
        {n(tatCa.filter((r) => r.pm_ket_luan !== "PM_KHONG_BIET").length)} mã phần mềm có —
        trước đây chỉ 2.052 vì kho đầy máy chưa xuất bao giờ nên không có hồ sơ thuê nào.
      </p>
      <ChongNgang
        nhom={coCau((r) => r.pm_doi_may ?? "(phần mềm không có mã)")}
        phan={PHAN}
        rongNhan={200}
      />

      <h2>Cơ cấu theo kho ghi trên phiếu gần nhất</h2>
      <ChongNgang nhom={coCau((r) => r.pm_kho ?? "(chưa có phiếu nào)")} phan={PHAN} rongNhan={200} />

      <details className="doi-chieu">
        <summary>Bảng chéo đầy đủ: kết luận ở file × kết luận của phần mềm</summary>
        <p className="muted">
          Trang này <b>không tự chấm khớp hay không khớp</b>. Hai bên trả lời hai câu hỏi
          khác nhau — file hỏi “mã này ở đâu theo sổ và theo lần kiểm kho”, phần mềm trả lời
          “phiếu gần nhất của mã này là phiếu gì”. Tự đặt luật khớp thì thành mình chấm bài
          mình. Bấm vào một ô để lọc đúng nhóm đó.
        </p>
        <div className="scroller">
          <table className="bang-thang">
            <thead>
              <tr>
                <th>Kết luận ở file</th>
                {PHAN.map((p) => (
                  <th key={p.ma} className="num">
                    {p.ten}
                  </th>
                ))}
                <th className="num">Cộng</th>
              </tr>
            </thead>
            <tbody>
              {dongKl.map((k) => (
                <tr key={k}>
                  <td>{k}</td>
                  {PHAN.map((p) => {
                    const v = o(k, p.ma);
                    return (
                      <td key={p.ma} className={`num mono${v === 0 ? " muted" : ""}`}>
                        {v === 0 ? (
                          "—"
                        ) : (
                          <Link href={link({ kl: maKetLuan(k), pm: p.ma })}>{n(v)}</Link>
                        )}
                      </td>
                    );
                  })}
                  <td className="num mono">
                    {n(tatCa.filter((r) => (r.ket_luan ?? "(trống)") === k).length)}
                  </td>
                </tr>
              ))}
              <tr>
                <td>
                  <b>Cộng</b>
                </td>
                {PHAN.map((p) => (
                  <td key={p.ma} className="num mono">
                    <b>{n(dem(p.ma))}</b>
                  </td>
                ))}
                <td className="num mono">
                  <b>{n(tatCa.length)}</b>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>

      <h2>Từng mã</h2>

      <form method="get">
        <div className="formgrid">
          <label>
            Mã máy, tên khách, người giữ hoặc vị trí theo sổ
            <input type="text" name="q" defaultValue={mot(sp.q)} placeholder="IMEI, tên…" />
          </label>
          {LOC.map((l) => {
            const gia = [...new Set(tatCa.map(l.lay))].sort();
            return (
              <label key={l.ma}>
                {l.ten}
                <select name={l.ma} defaultValue={chon[l.ma]}>
                  <option value="">tất cả</option>
                  {gia.map((v) => (
                    <option key={v} value={v}>
                      {(l.ma === "kl" ? nhanKetLuan(tatCa, v) : v)} ·{" "}
                      {tatCa.filter((r) => l.lay(r) === v).length}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
          <input type="hidden" name="pm" value={pm} />
          <input type="hidden" name="phan" value={phan} />
          <div className="actions">
            <button className="primary" type="submit">
              Lọc
            </button>
            <Link href="/cam-tay/kho">
              <button type="button">Bỏ hết lọc</button>
            </Link>
          </div>
        </div>
      </form>

      <p className="actions">
        <Link href={link({ pm: undefined, phan: undefined })}>
          <button type="button" className={pm === "" && phan === "" ? "primary" : undefined}>
            Tất cả · {n(tatCa.length)}
          </button>
        </Link>
        <Link href={link({ phan: "ngoai", pm: undefined })}>
          <button type="button" className={phan === "ngoai" ? "primary" : undefined}>
            ngoài phần mềm · {n(ngoai.length)}
          </button>
        </Link>
        {PHAN.map((p) => (
          <Link key={p.ma} href={link({ pm: p.ma })}>
            <button type="button" className={pm === p.ma ? "primary" : undefined}>
              {p.ten} · {n(dem(p.ma))}
            </button>
          </Link>
        ))}
      </p>

      <p className="muted">
        {n(rows.length)} mã
        {phan === "trong" && " · trong phần mềm"}
        {phan === "ngoai" && " · ngoài phần mềm"}
        {pm && ` · ${KHO_PM[pm]}`}
        {LOC.map((l) =>
          chon[l.ma] ? (
            <span key={l.ma}>
              {" · "}
              {l.ten.toLowerCase()}: {l.ma === "kl" ? nhanKetLuan(tatCa, chon[l.ma]!) : chon[l.ma]}
            </span>
          ) : null,
        )}
        {tim && ` · tìm “${mot(sp.q)}”`}
        {!coLoc && " · chưa lọc gì"}
      </p>

      {rows.length === 0 ? (
        <p className="empty">Không có mã nào khớp.</p>
      ) : (
        <div className="scroller">
          <table className="bang-thang">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Nhóm ở file</th>
                <th>Kết luận ở file</th>
                <th>Vị trí theo sổ / kiểm kho</th>
                <th>Phần mềm</th>
                <th>Phiếu kho gần nhất</th>
                <th>Đời máy / khách theo phần mềm</th>
              </tr>
            </thead>
            <ThanBam>
              {rows.map((r) => (
                <tr key={r.ma}>
                  <td className="mono">{r.ma}</td>
                  <td className="muted">{r.nhom_hang ?? "—"}</td>
                  <td>{r.ket_luan ?? "—"}</td>
                  <td className="muted">
                    {r.vi_tri_so ?? "không có trong sổ"}
                    {r.vi_tri_kiem_kho && <div>kho 15/09: {r.vi_tri_kiem_kho}</div>}
                    {r.nguoi_giu && <div>{r.nguoi_giu}</div>}
                  </td>
                  <td>
                    <span className={`chip ${MAU_CHIP[r.pm_ket_luan] ?? "tat"}`}>
                      {KHO_PM[r.pm_ket_luan] ?? r.pm_ket_luan}
                    </span>
                    {r.pm_nha_mang && (
                      <div className="muted">
                        nhà mạng: {r.pm_nha_mang} · {r.pm_vendor}
                      </div>
                    )}
                  </td>
                  <td className="muted">
                    {r.pm_phieu ? (
                      <>
                        {PHIEU_KHO[r.pm_phieu] ?? r.pm_phieu}
                        <div className="mono">
                          {r.pm_ngay_phieu} · {r.pm_kho ?? "không ghi kho"}
                        </div>
                        <div>{r.pm_ly_do}</div>
                      </>
                    ) : (
                      "chưa có phiếu nào"
                    )}
                  </td>
                  <td className="muted">
                    {r.pm_doi_may ?? "—"}
                    {r.doi_may_tu_phieu && <div className="chip cho">theo phiếu kho</div>}
                    {r.pm_khach && (
                      <div>
                        {r.pm_khach}
                        {r.pm_ma_khach && ` · ${r.pm_ma_khach}`}
                      </div>
                    )}
                    {r.nguon_khach && <div className="mono">{r.nguon_khach}</div>}
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
