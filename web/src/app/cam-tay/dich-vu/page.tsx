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

  const tyLe = (r: ThangDichVu[]) => {
    const pt = cong(r, "phai_thu");
    return pt === 0 ? null : Math.round((1000 * cong(r, "da_thu")) / pt) / 10;
  };

  return (
    <main>
      <h1>Cước theo dịch vụ</h1>
      <p className="muted">
        Cùng cách tính với bảng “Thống kê cước dịch vụ theo tháng” bên CMS, nhưng gom
        theo dịch vụ thay vì theo khách. Kỳ lấy từ <b>dòng cước</b> chứ không phải ngày
        trên hoá đơn — một hoá đơn năm rải đều ra 12 tháng. Tiền đã thu chia theo tỉ lệ
        từng dòng trên tổng hoá đơn. Hoá đơn đã huỷ và phiếu hoàn tiền không tính.
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
          <div className="the-ten">Dịch vụ chạy mà không ra cước</div>
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
                <th className="num" title="Số thuê bao của dịch vụ đó còn chạy trong tháng, suy từ ngày kích hoạt và ngày ngừng hiện tại; tháng đã qua chỉ là ước lượng vì nguồn không lưu lịch sử trạng thái">
                  Dịch vụ đang chạy
                </th>
                <th className="num" title="Số thuê bao của dịch vụ đó có phát sinh cước trong tháng">
                  Dịch vụ có cước
                </th>
                <th className="num" title="Đang chạy trừ có cước. Dương là chạy mà không ra cước; âm là ra cước cho thuê bao đã ngừng. Tháng chưa tới thì để trống.">
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
                  <tr>
                    <td className="mono">{ky}</td>
                    <td className="num mono">{cong(cua, "thue_bao_chay").toLocaleString("vi-VN")}</td>
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
                  </tr>
                  {cua.map((r) => (
                    <tr key={`${r.ky}-${r.dich_vu}`} className="sub">
                      <td>
                        <span className="chip tat">{TEN_DICH_VU[r.dich_vu] ?? r.dich_vu}</span>
                      </td>
                      <td className="num mono muted">{n(r.thue_bao_chay)}</td>
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
                    </tr>
                  ))}
                </tbody>
              );
            })}
          </table>
        </div>
      )}

      <p className="muted khoi-ghi-chu">
        Tổng từng tháng khớp với báo cáo bên CMS. Khác biệt duy nhất: bảng này tách thêm
        theo dịch vụ, và đếm cả thuê bao chứ không chỉ đếm khách — một khách dùng ba dịch
        vụ sẽ được đếm một lần ở cột khách, ba lần ở cột thuê bao.
      </p>
    </main>
  );
}
