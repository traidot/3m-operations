import Link from "next/link";
import { getNamCoSoLieu, getThangDichVu, type ThangDichVu } from "@/lib/queries";
import { DICH_VU } from "@/lib/nhan";

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
  const nam = cacNam.some((x) => x.nam === mot(sp.nam))
    ? mot(sp.nam)
    : (cacNam[0]?.nam ?? String(new Date().getFullYear()));
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

  const tyLe = (r: ThangDichVu[]) => {
    const pt = cong(r, "phai_thu");
    return pt === 0 ? null : Math.round((1000 * cong(r, "da_thu")) / pt) / 10;
  };

  return (
    <main>
      <h1>Cước theo dịch vụ</h1>
      <p className="muted">
        Cước wifi cầm tay gom theo tháng và theo dịch vụ. Kỳ lấy theo tháng bắt đầu của
        kỳ cước, hoá đơn không có kỳ thì lấy ngày lập. Hoá đơn không gắn thuê bao xếp
        riêng thành “đơn hàng” và “thu khác” chứ không trộn vào gói nào. Hoá đơn đã huỷ
        và phiếu hoàn tiền không tính.
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
          <div className="the-ten">Còn đòi</div>
          <div className="the-gia-tri">{cong(hien, "con_doi").toLocaleString("vi-VN")}</div>
        </div>
        <div className="the-so">
          <div className="the-ten">Mất trắng</div>
          <div className="the-gia-tri">{cong(hien, "mat_trang").toLocaleString("vi-VN")}</div>
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
                <th className="num">Thuê bao</th>
                <th className="num">Hoá đơn</th>
                <th className="num">Phải thu</th>
                <th className="num">Đã thu</th>
                <th className="num">Còn đòi</th>
                <th className="num">Mất trắng</th>
                <th>Tỉ lệ thu</th>
              </tr>
            </thead>
            {thang.map((ky) => {
              const cua = hien.filter((r) => r.ky === ky);
              const ty = tyLe(cua);
              return (
                <tbody key={ky}>
                  <tr>
                    <td className="mono">{ky}</td>
                    <td className="num mono">{cong(cua, "so_thue_bao").toLocaleString("vi-VN")}</td>
                    <td className="num mono">{cong(cua, "so_hoa_don").toLocaleString("vi-VN")}</td>
                    <td className="num mono">{cong(cua, "phai_thu").toLocaleString("vi-VN")}</td>
                    <td className="num mono">{cong(cua, "da_thu").toLocaleString("vi-VN")}</td>
                    <td className="num mono">{cong(cua, "con_doi").toLocaleString("vi-VN")}</td>
                    <td className="num mono">{cong(cua, "mat_trang").toLocaleString("vi-VN")}</td>
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
                  </tr>
                  {cua.map((r) => (
                    <tr key={`${r.ky}-${r.dich_vu}`} className="sub">
                      <td>
                        <span className="chip tat">{TEN_DICH_VU[r.dich_vu] ?? r.dich_vu}</span>
                      </td>
                      <td className="num mono muted">{n(r.so_thue_bao)}</td>
                      <td className="num mono muted">{n(r.so_hoa_don)}</td>
                      <td className="num mono muted">{n(r.phai_thu)}</td>
                      <td className="num mono muted">{n(r.da_thu)}</td>
                      <td className={`num mono${Number(r.con_doi) > 0 ? " bad" : " muted"}`}>
                        {n(r.con_doi)}
                      </td>
                      <td className={`num mono${Number(r.mat_trang) > 0 ? " bad" : " muted"}`}>
                        {n(r.mat_trang)}
                      </td>
                      <td className="mono muted">
                        {r.ty_le_thu === null ? "—" : `${r.ty_le_thu}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              );
            })}
          </table>
        </div>
      )}

      <p className="muted khoi-ghi-chu">
        Số liệu không khớp bảng “Thống kê cước dịch vụ theo tháng” bên CMS: cột “không
        thanh toán” khớp từng tháng, nhưng “tổng phải thu” bên CMS thấp hơn vì nó lọc bớt
        một số loại hoá đơn theo cách chưa rõ. Bảng này tính hết, chỉ trừ hoá đơn đã huỷ
        và phiếu hoàn tiền.
      </p>
    </main>
  );
}
