import Link from "next/link";
import { ThanBam } from "../../../than-bam";
import { getKhoMa, type KhoMa } from "@/lib/queries";
import { KHO_PM, LOAI_MA, MAY_CUOC, PHIEU_KHO } from "@/lib/nhan";
import { VIEC } from "../viec";

export const dynamic = "force-dynamic";

const n = (v: string | number | null) =>
  v === null ? "—" : Number(v).toLocaleString("vi-VN");

type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const CHO_DUNG: Record<string, string> = { ...KHO_PM, PM_KHONG_CO: "phần mềm không có mã" };

const MAU_CHIP: Record<string, string> = {
  O_KHACH: "ok",
  TRONG_KHO: "ok",
  TRA_NCC: "tat",
  CHI_NHA_MANG: "cho",
  PM_KHONG_CO: "do",
};

/** Mỗi bộ lọc là một câu hỏi người dùng thật sự hỏi, không phải một cột của view. */
const LOC: { ma: string; ten: string; lay: (r: KhoMa) => string }[] = [
  { ma: "lm", ten: "Loại định danh", lay: (r) => LOAI_MA[r.loai_ma] ?? r.loai_ma },
  { ma: "may", ten: "Đời máy", lay: (r) => r.doi_may ?? "(không rõ)" },
  { ma: "kho", ten: "Kho theo phiếu", lay: (r) => r.warehouse_name ?? "(chưa có phiếu)" },
  { ma: "cuoc", ten: "Tình trạng cước", lay: (r) => r.tinh_trang_cuoc ?? "(không có hồ sơ thuê)" },
  { ma: "nh", ten: "Nhóm hàng ở file", lay: (r) => r.file_nhom_hang ?? "(file không có)" },
  { ma: "vt", ten: "Vị trí theo sổ", lay: (r) => r.file_vi_tri_so ?? "(không có trong sổ)" },
  { ma: "nm", ten: "Nhà mạng", lay: (r) => r.nha_mang ?? "(không có)" },
];

export default async function Page({ searchParams }: { searchParams: Promise<Tham> }) {
  const sp = await searchParams;
  const tatCa = await getKhoMa();

  const cd = mot(sp.cd);
  const tim = mot(sp.q).trim().toLowerCase();
  const chon = Object.fromEntries(LOC.map((l) => [l.ma, mot(sp[l.ma])]));
  const viec = VIEC.find((v) => v.ma === mot(sp.viec));

  let rows = tatCa;
  if (viec) rows = rows.filter(viec.hop);
  if (cd) rows = rows.filter((r) => r.cho_dung === cd);
  for (const l of LOC) {
    const v = chon[l.ma];
    if (v) rows = rows.filter((r) => l.lay(r) === v);
  }
  if (tim) {
    rows = rows.filter((r) =>
      [r.ma, r.khach, r.ma_khach, r.file_nguoi_giu, r.file_vi_tri_so]
        .some((v) => v?.toLowerCase().includes(tim)),
    );
  }

  const giu = { ...chon, q: mot(sp.q) || undefined, cd: cd || undefined, viec: viec?.ma };
  const link = (t: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...giu, ...t })) if (v) p.set(k, v);
    const duoi = p.toString();
    return duoi ? `/cam-tay/kho/danh-sach?${duoi}` : "/cam-tay/kho/danh-sach";
  };

  const dem = (ma: string) => tatCa.filter((r) => r.cho_dung === ma).length;

  return (
    <main>
      <h1>Kho — từng mã</h1>
      <p className="muted">
        <Link href="/cam-tay/kho">← Về tổng quan</Link> · {n(tatCa.length)} mã, hợp của hai
        phía: {n(tatCa.filter((r) => r.pm_co).length)} mã phần mềm biết và{" "}
        {n(tatCa.filter((r) => r.file_co).length)} mã trong bản đối chiếu làm tay. Cột “chỗ
        đứng” là kết luận suy từ <b>phiếu kho gần nhất của phần mềm</b>, không phải một cột
        có sẵn bên nguồn.
      </p>

      <form method="get">
        <div className="formgrid">
          <label>
            Mã máy, khách, người giữ hoặc vị trí theo sổ
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
                      {MAY_CUOC[v] ?? v} · {tatCa.filter((r) => l.lay(r) === v).length}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
          <label>
            Việc cần xử lý
            <select name="viec" defaultValue={viec?.ma ?? ""}>
              <option value="">tất cả</option>
              {VIEC.map((v) => (
                <option key={v.ma} value={v.ma}>
                  {v.ten} · {tatCa.filter(v.hop).length}
                </option>
              ))}
            </select>
          </label>
          <input type="hidden" name="cd" value={cd} />
          <div className="actions">
            <button className="primary" type="submit">
              Lọc
            </button>
            <Link href="/cam-tay/kho/danh-sach">
              <button type="button">Bỏ hết lọc</button>
            </Link>
          </div>
        </div>
      </form>

      <p className="actions">
        <Link href={link({ cd: undefined })}>
          <button type="button" className={cd === "" ? "primary" : undefined}>
            Mọi chỗ đứng · {n(tatCa.length)}
          </button>
        </Link>
        {Object.keys(CHO_DUNG)
          .filter((k) => dem(k) > 0)
          .map((k) => (
            <Link key={k} href={link({ cd: k })}>
              <button type="button" className={cd === k ? "primary" : undefined}>
                {CHO_DUNG[k]} · {n(dem(k))}
              </button>
            </Link>
          ))}
      </p>

      <p className="muted">
        {n(rows.length)} mã
        {viec && ` · ${viec.ten}`}
        {cd && ` · ${CHO_DUNG[cd]}`}
        {LOC.map((l) =>
          chon[l.ma] ? (
            <span key={l.ma}>
              {" · "}
              {l.ten.toLowerCase()}: {MAY_CUOC[chon[l.ma]!] ?? chon[l.ma]}
            </span>
          ) : null,
        )}
        {tim && ` · tìm “${mot(sp.q)}”`}
      </p>

      {rows.length === 0 ? (
        <p className="empty">Không có mã nào khớp.</p>
      ) : (
        <div className="scroller">
          <table className="bang-thang">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Đời máy</th>
                <th>Phần mềm: chỗ đứng</th>
                <th>Phần mềm: phiếu gần nhất</th>
                <th>Phần mềm: khách và cước</th>
                <th>File nói gì</th>
              </tr>
            </thead>
            <ThanBam>
              {rows.map((r) => (
                <tr key={r.ma_chuan}>
                  <td className="mono">
                    {r.ma}
                    <div className="muted">{LOAI_MA[r.loai_ma] ?? r.loai_ma}</div>
                  </td>
                  <td className="muted">{r.doi_may ?? "—"}</td>
                  <td>
                    <span className={`chip ${MAU_CHIP[r.cho_dung] ?? "tat"}`}>
                      {CHO_DUNG[r.cho_dung] ?? r.cho_dung}
                    </span>
                    {r.nha_mang && (
                      <div className="muted">
                        nhà mạng: {r.nha_mang} · {r.vendor}
                      </div>
                    )}
                  </td>
                  <td className="muted">
                    {r.doc_type ? (
                      <>
                        {PHIEU_KHO[r.doc_type] ?? r.doc_type}
                        <div className="mono">
                          {r.doc_date} · {r.warehouse_name ?? "không ghi kho"}
                        </div>
                        <div>{r.reason_type}</div>
                      </>
                    ) : (
                      "chưa có phiếu nào"
                    )}
                  </td>
                  <td className="muted">
                    {r.khach ?? "—"}
                    {r.ma_khach && ` · ${r.ma_khach}`}
                    {r.nguon_khach && <div className="mono">{r.nguon_khach}</div>}
                    {r.tinh_trang_cuoc && (
                      <div>
                        {MAY_CUOC[r.tinh_trang_cuoc] ?? r.tinh_trang_cuoc}
                        {r.ky_cuoi && ` · kỳ cuối ${r.ky_cuoi}`}
                      </div>
                    )}
                  </td>
                  <td className="muted">
                    {r.file_co ? (
                      <>
                        {r.file_ket_luan}
                        <div>{r.file_vi_tri_so ?? "không có trong sổ"}</div>
                        {r.file_kiem_kho && <div>kiểm kho: {r.file_kiem_kho}</div>}
                        {r.file_nguoi_giu && <div>{r.file_nguoi_giu}</div>}
                      </>
                    ) : (
                      <span className="chip cho">file không nhắc tới</span>
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
