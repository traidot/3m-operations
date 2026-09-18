import Link from "next/link";
import { Dong } from "../hop-dong/dong";
import { DoiChieuCms } from "./doi-chieu";
import { ChiTietThangCoDinh, NHOM_CD, type NhomCd } from "./chi-tiet";
import {
  getArrears,
  getFixedThangChay,
  getCoverage,
  getMonthlyByStatus,
  getMonthlyTotal,
  getPendingPeriods,
  type FixedThangChay,
  type MonthlyBilling,
  type MonthlyByStatus,
} from "@/lib/queries";
import { HOP_DONG, LAP_DAT } from "@/lib/nhan";

export const dynamic = "force-dynamic";

const n = (v: string | null) => (v === null ? "—" : Number(v).toLocaleString("vi-VN"));


type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function Page({ searchParams }: { searchParams: Promise<Tham> }) {
  const sp = await searchParams;
  const [total, byStatus, [coverage], arrears, pending, chay] = await Promise.all([
    getMonthlyTotal(),
    getMonthlyByStatus(),
    getCoverage(),
    getArrears(),
    getPendingPeriods(),
    getFixedThangChay(),
  ]);

  const theoThang = new Map(chay.map((c) => [c.ky, c]));
  const moThang = /^\d{4}-\d{2}$/.test(mot(sp.thang)) ? mot(sp.thang) : "";
  const moNhom: NhomCd = Object.hasOwn(NHOM_CD, mot(sp.nhom))
    ? (mot(sp.nhom) as NhomCd)
    : "chua_ky";
  const link = (t: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(t)) if (v) p.set(k, v);
    const duoi = p.toString();
    return duoi ? `/cuoc?${duoi}` : "/cuoc";
  };

  const theoKy = new Map<string, MonthlyByStatus[]>();
  for (const r of byStatus) {
    theoKy.set(r.ky, [...(theoKy.get(r.ky) ?? []), r]);
  }

  const phu = Number(coverage?.ty_le_tinh_duoc ?? 0);

  // Đối chiếu với sổ cước bên CMS. "Phải ra kỳ" và "có kỳ cước" đều suy ra từ
  // cùng một luật của mình nên khớp nhau là đương nhiên — không đem so. Bên độc
  // lập là fee_period_snapshot: kỳ nào sổ CMS có mà luật mình bảo không nên có
  // thì mới là chuyện phải xem.
  const ngoaiKy = chay
    .filter((c) => Number(c.ngoai_ky) > 0)
    .map((c) => ({ ky: c.ky, so: Number(c.ngoai_ky) }))
    .sort((a, b) => b.ky.localeCompare(a.ky));

  return (
    <main>
      <h1>Cước wifi cố định</h1>

      {/* Độ phủ đứng trên cùng: không biết nó thì mọi số dưới đều đọc sai. */}
      <div className={phu < 80 ? "stale" : "muted"}>
        Chỉ tính được cước cho <b>{n(coverage?.tinh_duoc ?? null)}</b> trên{" "}
        <b>{n(coverage?.hop_dong_dang_chay ?? null)}</b> hợp đồng đang chạy do công ty phụ
        trách ({phu}%). {n(coverage?.hop_dong_dai_ly ?? null)} hợp đồng của đại lý không
        tính ở đây vì đại lý tự thu.
        {Number(coverage?.thieu_gia_cuoc ?? 0) > 0 && (
          <> {n(coverage!.thieu_gia_cuoc)} hợp đồng thiếu giá cước nên không sinh được kỳ.</>
        )}{" "}
        Mọi con số bên dưới là phần tính được, không phải toàn bộ.
      </div>

      <h2>Theo tháng</h2>
      {/* Luôn bày kết quả đối chiếu, kể cả khi sạch: không thấy gì thì không biết
          là đã kiểm hay chưa kiểm. */}
      {ngoaiKy.length > 0 ? (
        <p className="stale">
          ⚠ Sổ cước bên CMS thu tiền ở kỳ mà luật của mình bảo lẽ ra không có, ở{" "}
          {ngoaiKy.length} tháng: {ngoaiKy.map((l) => `${l.ky} (${l.so})`).join(", ")}. Hầu
          hết là hợp đồng đã qua ngày kết thúc thu mà vẫn thu tiếp —{" "}
          <Link href="/thu-ngoai">xem danh sách từng kỳ</Link>.
        </p>
      ) : (
        <p className="khop">
          ✓ Đối chiếu với sổ cước bên CMS: không tháng nào thu tiền ở kỳ nằm ngoài luật
          tính của mình.
        </p>
      )}
      <p className="muted">
        Ghép theo kỳ cước, không theo ngày thu — tiền một kỳ có thể được thu ở tháng khác.
        Cột “công ty” là hợp đồng do công ty phụ trách, đã lắp xong và chưa huỷ trong tháng —
        chênh với “có kỳ cước” là phần không ra được kỳ nào. Hợp đồng của đại lý để riêng vì
        đại lý tự thu. Cột “đã huỷ” là hợp đồng đã huỷ nhưng kỳ cước tháng đó vẫn còn hiệu lực,
        nên tiền còn thiếu ở cột đó khó đòi hơn. Bấm vào một tháng để xem danh sách hợp đồng.
      </p>
      <div className="scroller">
        <table className="bang-thang">
          <thead>
            {/* Ba tầng: nhóm lớn, nhóm nhỏ, rồi cột. Mười tám cột mà không gom
                thì mắt không biết cột nào thuộc chuyện gì. */}
            <tr>
              <th rowSpan={3}>Kỳ</th>
              <th colSpan={8} className="nhom nhom-lon">Hợp đồng</th>
              <th colSpan={10} className="nhom nhom-lon">Tiền</th>
            </tr>
            <tr>
              <th colSpan={2} className="nhom">Đang chạy</th>
              <th colSpan={2} className="nhom" title="Hợp đồng công ty chưa thiết lập đủ bên CMS nên không sinh được kỳ nào. Thiếu cả hai thì đếm ở cả hai cột.">
                Chưa đặt cước
              </th>
              <th colSpan={4} className="nhom" title="Hợp đồng công ty có kỳ cước của tháng đó, và bao nhiêu trong số đó thật sự có dòng thu tiền bên CMS">
                Có kỳ cước
              </th>
              <th rowSpan={2} className="num">Phải thu</th>
              <th rowSpan={2} className="num">Miễn phí</th>
              <th rowSpan={2} className="num">Đã thu</th>
              <th rowSpan={2} className="num" title="Kỳ bên CMS bật ô “tuỳ chỉnh số tiền thu” hoặc “không thu cước”: thu ít hơn giá cước nhưng là có chủ ý, không phải nợ.">
                Giảm trừ
              </th>
              <th rowSpan={2} className="num" title="Kỳ đã duyệt, không miễn phí, không đánh dấu tuỳ chỉnh, mà tiền trong sổ vẫn ít hơn giá cước. Số âm là thu dư.">
                Thu thiếu
              </th>
              <th colSpan={2} className="nhom" title="Kỳ đã có dòng trong sổ nhưng chưa quyết là thu hay miễn. Đong bằng giá cước của hợp đồng để hàng ngang cộng lại đúng, nên có thể lệch với số tiền ghi trên phiếu.">
                Chưa chốt
              </th>
              <th colSpan={2} className="nhom" title="Kỳ không có một dòng nào trong sổ cước">
                Còn thiếu
              </th>
              <th rowSpan={2}>Tỉ lệ thu</th>
            </tr>
            <tr>
              <th className="num" title="Hợp đồng do công ty phụ trách, đã lắp xong và chưa huỷ trong tháng đó">
                Công ty
              </th>
              <th className="num" title="Hợp đồng do đại lý mở — đại lý tự thu nên không đặt giá cước bên nguồn">
                Đại lý
              </th>
              <th className="num" title="Chưa điền giá cước bên CMS">Thiếu giá</th>
              <th className="num" title="Chưa điền ngày bắt đầu thu bên CMS">Thiếu ngày</th>
              <th className="num" title="Hợp đồng công ty đủ điều kiện sinh kỳ cước trong tháng: có giá, có ngày bắt đầu thu, và tháng đó nằm trong khoảng thu.">
                Phải ra
              </th>
              <th className="num">Đang chạy</th>
              <th className="num" title="Hợp đồng đã huỷ nhưng kỳ cước tháng đó vẫn còn hiệu lực">
                Đã huỷ
              </th>
              <th className="num" title="Hợp đồng công ty có dòng THU TIỀN THẬT trong sổ cước bên CMS (đã duyệt, không miễn phí). Đây là bên độc lập duy nhất. Số sau dấu ⚠ là số kỳ đã thu nằm ngoài khoảng thu của hợp đồng, đếm thẳng từ danh sách Thu ngoài hợp đồng.">
                Sổ CMS
              </th>
              <th className="num" title="Đã có phiếu thu, chưa ai duyệt — tiền cầm rồi, thiếu chữ ký">
                Chờ duyệt
              </th>
              <th className="num" title="Chỉ có dòng ghi chú, chưa quyết thu hay miễn">
                Ghi chú
              </th>
              <th className="num">Đang chạy</th>
              <th className="num" title="Tiền còn thiếu nằm trên hợp đồng đã huỷ — khó đòi hơn">
                Đã huỷ
              </th>
            </tr>
          </thead>
          <tbody>
            {total.map((r) => (
              <TableRows
                key={r.ky}
                row={r}
                chiTiet={theoKy.get(r.ky) ?? []}
                chay={theoThang.get(r.ky)}
                href={link({ thang: r.ky })}
                dangMo={moThang === r.ky}
              />
            ))}
          </tbody>
        </table>
      </div>

      {pending.length > 0 && (
        <p className="muted">
          Chưa chốt:{" "}
          {pending
            .map((p) => `${n(p.so_ky)} kỳ ${p.status}${Number(p.tien) > 0 ? ` (${n(p.tien)})` : ""}`)
            .join(", ")}
. Đây là số tiền ghi trên phiếu bên sổ, nên lệch với hai cột “chưa chốt” trong
          bảng — hai cột đó đong bằng giá cước hợp đồng để hàng ngang cộng lại đúng.
        </p>
      )}

      <DoiChieuCms />

      <h2>Nợ từ ba kỳ trở lên ({arrears.length >= 20 ? "20 nặng nhất" : arrears.length})</h2>
      {arrears.length === 0 ? (
        <p className="empty">Không có hợp đồng nào nợ quá ngưỡng.</p>
      ) : (
        <div className="scroller">
          <table>
            <thead>
              <tr>
                <th>Hợp đồng</th>
                <th>Trạng thái</th>
                <th>Thu tới kỳ</th>
                <th className="num">Tổng kỳ</th>
                <th className="num">Miễn phí</th>
                <th className="num">Kỳ nợ</th>
                <th className="num">Đã thu</th>
                <th className="num">Còn nợ</th>
              </tr>
            </thead>
            <tbody>
              {arrears.map((a) => (
                <tr key={a.subscription_id}>
                  <td className="mono">
                    {/* Lớp giám sát chỉ đọc, muốn sửa phải sang hệ thống nguồn. */}
                    {a.lien_ket ? (
                      <a href={a.lien_ket} target="_blank" rel="noreferrer">
                        {a.contract_code}
                      </a>
                    ) : (
                      a.contract_code
                    )}
                  </td>
                  <td>
                    <span className="mono">{HOP_DONG[a.trang_thai_hop_dong] ?? a.trang_thai_hop_dong}</span>
                    <br />
                    <span className="mono muted">
                      {a.trang_thai_lap_dat ? (LAP_DAT[a.trang_thai_lap_dat] ?? a.trang_thai_lap_dat) : "—"}
                    </span>
                  </td>
                  <td>
                    <span className="mono">{a.ky_da_thu_gan_nhat ?? "chưa thu kỳ nào"}</span>
                    {(a.ky_cho_duyet > 0 || a.ky_ghi_chu > 0) && (
                      <>
                        <br />
                        <span className="mono muted">
                          {a.ky_cho_duyet > 0 && `${a.ky_cho_duyet} kỳ chờ duyệt`}
                          {a.ky_cho_duyet > 0 && a.ky_ghi_chu > 0 && " · "}
                          {a.ky_ghi_chu > 0 && `${a.ky_ghi_chu} kỳ ghi chú`}
                        </span>
                      </>
                    )}
                  </td>
                  <td className="num mono muted">{a.so_ky}</td>
                  <td className="num mono muted">{a.so_ky_mien_phi || "—"}</td>
                  <td className={`num mono ${a.so_ky_no >= 6 ? "bad" : ""}`}>{a.so_ky_no}</td>
                  <td className="num mono">{n(a.tong_da_thu)}</td>
                  <td className="num mono bad">{n(a.con_no)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {moThang && (
        <ChiTietThangCoDinh
          ky={moThang}
          nhom={moNhom}
          dongLai={link({})}
          linkNhom={(k) => link({ thang: moThang, nhom: k })}
        />
      )}
    </main>
  );
}

function TableRows({
  row,
  chiTiet,
  chay,
  href,
  dangMo,
}: {
  row: MonthlyBilling;
  chiTiet: MonthlyByStatus[];
  chay: FixedThangChay | undefined;
  href: string;
  dangMo: boolean;
}) {
  const ty = row.ty_le_thu === null ? null : Number(row.ty_le_thu);
  // Sổ cước chỉ có đúng hai trạng thái, nên tách thành cột chứ không đẻ dòng con.
  const theo = (ma: string) => chiTiet.find((c) => c.trang_thai === ma) ?? null;
  const chay_ = theo("ACTIVE");
  const huy = theo("TERMINATED");
  // Kỳ có trong sổ CMS mà luật tính của mình bảo lẽ ra không có.
  const ngoai = Number(chay?.ngoai_ky ?? 0);

  return (
    <Dong href={href} dangMo={dangMo}>
      <td className="mono">{row.ky}</td>
      <td className="num mono">{chay ? n(chay.cong_ty) : "—"}</td>
      <td className="num mono muted">{chay ? n(chay.dai_ly) : "—"}</td>
      <td className={`num mono${Number(chay?.thieu_gia_cuoc ?? 0) > 0 ? " bad" : ""}`}>
        {chay ? n(chay.thieu_gia_cuoc) : "—"}
      </td>
      <td className={`num mono${Number(chay?.thieu_ngay_thu ?? 0) > 0 ? " bad" : ""}`}>
        {chay ? n(chay.thieu_ngay_thu) : "—"}
      </td>
      <td className="num mono">{chay ? n(chay.phai_ra_ky) : "—"}</td>
      <td className="num mono">{chay_ ? n(chay_.so_hop_dong) : "—"}</td>
      <td className="num mono muted">{huy ? n(huy.so_hop_dong) : "—"}</td>
      <td
        className={`num mono${ngoai > 0 ? " bad" : ""}`}
        title={
          ngoai > 0
            ? `${ngoai} kỳ đã thu nằm ngoài khoảng thu của hợp đồng — xem danh sách Thu ngoài hợp đồng`
            : "Không có kỳ nào thu ngoài khoảng hợp đồng"
        }
      >
        {chay ? n(chay.so_cms) : "—"}
        {chay &&
          (ngoai > 0 ? (
            <>
              {" "}
              {/* Link thật để bấm được vào đúng chip; Dong bỏ qua click rơi vào <a>. */}
              <Link href={`/thu-ngoai?ky=${row.ky}`} className="chip xau">
                ⚠ {ngoai}
              </Link>
            </>
          ) : (
            <span className="dau-khop"> ✓</span>
          ))}
      </td>
      <td className="num mono">{n(row.phai_thu)}</td>
      <td className="num mono muted">{n(row.tien_mien_phi)}</td>
      <td className="num mono">{n(row.da_thu)}</td>
      <td className="num mono muted" title="Giảm trừ có chủ ý bên CMS">
        {Number(row.giam_tru ?? 0) === 0 ? "—" : n(row.giam_tru)}
      </td>
      <td
        className={`num mono${Number(row.thu_thieu ?? 0) > 0 ? " bad" : " muted"}`}
        title={Number(row.thu_thieu ?? 0) < 0 ? "Số âm: thu dư so với giá cước" : undefined}
      >
        {Number(row.thu_thieu ?? 0) === 0 ? "—" : n(row.thu_thieu)}
      </td>
      <td className="num mono muted">{Number(row.cho_duyet ?? 0) === 0 ? "—" : n(row.cho_duyet)}</td>
      <td className="num mono muted">{Number(row.ghi_chu ?? 0) === 0 ? "—" : n(row.ghi_chu)}</td>
      <td className="num mono">{chay_ ? n(chay_.con_thieu) : "—"}</td>
      <td className={`num mono${Number(huy?.con_thieu ?? 0) > 0 ? " bad" : " muted"}`}>
        {huy ? n(huy.con_thieu) : "—"}
      </td>
      <td>
        {ty === null ? (
          <span className="muted">—</span>
        ) : (
          <span className="bar">
            <span className="bar-fill" style={{ width: `${Math.min(ty, 100)}%` }} />
            <span className="bar-label mono">{ty}%</span>
          </span>
        )}
      </td>
    </Dong>
  );
}
