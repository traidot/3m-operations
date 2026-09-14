import Link from "next/link";
import { getNamCoSoLieu, getThangDichVu, type ThangDichVu } from "@/lib/queries";
import { DICH_VU } from "@/lib/nhan";
import { Dong } from "../../hop-dong/dong";
import { ChiTietThang, NHOM, type Nhom } from "./chi-tiet";

export const dynamic = "force-dynamic";

const n = (v: string | null) => (v === null ? "—" : Number(v).toLocaleString("vi-VN"));

type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Hoá đơn không gắn thuê bao không có dịch vụ, xếp theo loại hoá đơn. */
const TEN_DICH_VU: Record<string, string> = {
  ...DICH_VU,
  DON_HANG: "đơn hàng",
  THU_KHAC: "thu khác",
};

const cong = (rows: ThangDichVu[], cot: keyof ThangDichVu) =>
  rows.reduce((s, r) => s + Number(r[cot] ?? 0), 0);

export default async function Page({ searchParams }: { searchParams: Promise<Tham> }) {
  const sp = await searchParams;
  const cacNam = await getNamCoSoLieu();
  // Mặc định là năm nay chứ không phải năm mới nhất có số liệu: nguồn đã sinh
  // sẵn dòng cước cho 2027, mở trang ra thấy một bảng gần như trống.
  const namNay = String(new Date().getFullYear());
  const nam = cacNam.some((x) => x.nam === mot(sp.nam))
    ? mot(sp.nam)
    : cacNam.some((x) => x.nam === namNay)
      ? namNay
      : (cacNam[0]?.nam ?? namNay);
  const rows = await getThangDichVu(nam);

  const dichVu = [...new Set(rows.map((r) => r.dich_vu))];
  const locDv = dichVu.includes(mot(sp.dv)) ? mot(sp.dv) : "";
  const hien = locDv ? rows.filter((r) => r.dich_vu === locDv) : rows;

  // Gom theo tháng: mỗi tháng một tbody, dòng đầu là tổng rồi tới từng dịch vụ.
  const thang = [...new Set(hien.map((r) => r.ky))];
  const link = (t: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(t)) if (v) p.set(k, v);
    const duoi = p.toString();
    return duoi ? `/cam-tay/dich-vu?${duoi}` : "/cam-tay/dich-vu";
  };

  // Ngăn kéo: bấm dòng tháng thì mở danh sách thuê bao của tháng đó, bấm dòng
  // dịch vụ thì lọc sẵn theo dịch vụ.
  // Tháng chưa tới thì "đang chạy" chỉ là trạng thái hôm nay, không so được.
  const thangNay = new Date().toLocaleDateString("sv-SE").slice(0, 7);
  const moThang = /^\d{4}-\d{2}$/.test(mot(sp.thang)) ? mot(sp.thang) : "";
  const moTdv = dichVu.includes(mot(sp.tdv)) ? mot(sp.tdv) : "";
  const moNhom: Nhom = Object.hasOwn(NHOM, mot(sp.nhom)) ? (mot(sp.nhom) as Nhom) : "thieu";

  const tyLe = (r: ThangDichVu[]) => {
    const pt = cong(r, "phai_thu");
    return pt === 0 ? null : Math.round((1000 * cong(r, "da_thu")) / pt) / 10;
  };

  return (
    <main>
      <h1>Cước theo dịch vụ</h1>
      <p className="muted">
        Cước wifi cầm tay theo tháng, chia theo dịch vụ. Tiền khớp báo cáo cước theo tháng
        bên CMS. Bấm vào một tháng hoặc một dịch vụ để xem danh sách thuê bao.
      </p>

      <p className="actions">
        {cacNam.map((x) => (
          <Link key={x.nam} href={link({ nam: x.nam, dv: locDv || undefined })}>
            <button type="button" className={nam === x.nam ? "primary" : undefined}>
              {x.nam}
            </button>
          </Link>
        ))}
      </p>
      <p className="actions">
        <Link href={link({ nam })}>
          <button type="button" className={locDv === "" ? "primary" : undefined}>
            Tất cả dịch vụ
          </button>
        </Link>
        {dichVu.map((d) => (
          <Link key={d} href={link({ nam, dv: d })}>
            <button type="button" className={locDv === d ? "primary" : undefined}>
              {TEN_DICH_VU[d] ?? d}
            </button>
          </Link>
        ))}
      </p>

      <div className="the-hang">
        <div className="the-so">
          <div className="the-ten">Phải thu {nam}</div>
          <div className="the-gia-tri">{cong(hien, "phai_thu").toLocaleString("vi-VN")}</div>
        </div>
        <div className="the-so">
          <div className="the-ten">Đã thu</div>
          <div className="the-gia-tri">{cong(hien, "da_thu").toLocaleString("vi-VN")}</div>
          <div className="the-phu">{tyLe(hien) ?? "—"}%</div>
        </div>
        <div className="the-so">
          <div className="the-ten">Đang dùng mà chưa có phiếu thu</div>
          <div className="the-gia-tri">{cong(hien, "chenh").toLocaleString("vi-VN")}</div>
          <div className="the-phu">lượt thuê bao · tháng</div>
        </div>
        <div className="the-so">
          <div className="the-ten">Chưa thu</div>
          <div className="the-gia-tri">{cong(hien, "chua_thu").toLocaleString("vi-VN")}</div>
        </div>
        <div className="the-so">
          <div className="the-ten">Không đòi được</div>
          <div className="the-gia-tri">{cong(hien, "khong_doi_duoc").toLocaleString("vi-VN")}</div>
        </div>
      </div>

      {hien.length === 0 ? (
        <p className="empty">Chưa có số liệu cho năm này.</p>
      ) : (
        <div className="scroller">
          <table className="bang-nhom">
            <thead>
              <tr>
                <th>Tháng · dịch vụ</th>
                <th className="num" title="Số thuê bao còn dùng dịch vụ trong tháng. Tháng chưa tới thì để trống.">
                  Dịch vụ đang chạy
                </th>
                <th className="num" title="Số thuê bao có phiếu thu cho tháng đó.">
                  Dịch vụ có cước
                </th>
                <th className="num" title="Đang chạy trừ có cước. Số dương: có thuê bao đang dùng mà chưa có phiếu thu. Số âm: có phiếu thu cho thuê bao đã ngừng.">
                  Chênh
                </th>
                <th className="num">Phải thu</th>
                <th className="num">Đã thu</th>
                <th className="num">Chưa thu</th>
                <th className="num">Không đòi được</th>
                <th>Tỉ lệ thu</th>
              </tr>
            </thead>
            {thang.map((ky) => {
              const cua = hien.filter((r) => r.ky === ky);
              const ty = tyLe(cua);
              return (
                <tbody key={ky}>
                  <Dong
                    href={link({ nam, dv: locDv || undefined, thang: ky })}
                    dangMo={moThang === ky && !moTdv}
                  >
                    <td className="mono">{ky}</td>
                    <td className="num mono">
                      {ky > thangNay ? "—" : cong(cua, "thue_bao_chay").toLocaleString("vi-VN")}
                    </td>
                    <td className="num mono">{cong(cua, "thue_bao_co_cuoc").toLocaleString("vi-VN")}</td>
                    <td className={`num mono${cong(cua, "chenh") > 0 ? " bad" : ""}`}>
                      {cua.every((r) => r.chenh === null)
                        ? "—"
                        : cong(cua, "chenh").toLocaleString("vi-VN")}
                    </td>
                    <td className="num mono">{cong(cua, "phai_thu").toLocaleString("vi-VN")}</td>
                    <td className="num mono">{cong(cua, "da_thu").toLocaleString("vi-VN")}</td>
                    <td className="num mono">{cong(cua, "chua_thu").toLocaleString("vi-VN")}</td>
                    <td className="num mono">{cong(cua, "khong_doi_duoc").toLocaleString("vi-VN")}</td>
                    <td>
                      {ty === null ? (
                        <span className="muted">—</span>
                      ) : (
                        <span className="bar">
                          <span
                            className="bar-fill"
                            style={{ width: `${Math.min(ty, 100)}%` }}
                          />
                          <span className="bar-label mono">{ty}%</span>
                        </span>
                      )}
                    </td>
                  </Dong>
                  {cua.map((r) => (
                    <Dong
                      key={`${r.ky}-${r.dich_vu}`}
                      href={link({ nam, dv: locDv || undefined, thang: ky, tdv: r.dich_vu })}
                      dangMo={moThang === ky && moTdv === r.dich_vu}
                      lop="sub"
                    >
                      <td>
                        <span className="chip tat">{TEN_DICH_VU[r.dich_vu] ?? r.dich_vu}</span>
                      </td>
                      <td className="num mono muted">
                        {ky > thangNay ? "—" : n(r.thue_bao_chay)}
                      </td>
                      <td className="num mono muted">{n(r.thue_bao_co_cuoc)}</td>
                      <td className={`num mono${Number(r.chenh) > 0 ? " bad" : " muted"}`}>
                        {n(r.chenh)}
                      </td>
                      <td className="num mono muted">{n(r.phai_thu)}</td>
                      <td className="num mono muted">{n(r.da_thu)}</td>
                      <td className={`num mono${Number(r.chua_thu) > 0 ? " bad" : " muted"}`}>
                        {n(r.chua_thu)}
                      </td>
                      <td className={`num mono${Number(r.khong_doi_duoc) > 0 ? " bad" : " muted"}`}>
                        {n(r.khong_doi_duoc)}
                      </td>
                      <td className="mono muted">
                        {r.ty_le_thu === null ? "—" : `${r.ty_le_thu}%`}
                      </td>
                    </Dong>
                  ))}
                </tbody>
              );
            })}
          </table>
        </div>
      )}

      <p className="muted khoi-ghi-chu">
        Phải thu, đã thu, chưa thu và không đòi được khớp từng tháng với báo cáo cước theo
        tháng bên CMS. Hoá đơn đã huỷ và phiếu hoàn tiền không tính.
      </p>
      {moThang && (
        <ChiTietThang
          ky={moThang}
          dichVu={moTdv || undefined}
          nhom={moNhom}
          dongLai={link({ nam, dv: locDv || undefined })}
          linkNhom={(k) =>
            link({ nam, dv: locDv || undefined, thang: moThang, tdv: moTdv || undefined, nhom: k })
          }
        />
      )}
    </main>
  );
}
