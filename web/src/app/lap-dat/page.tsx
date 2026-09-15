import Link from "next/link";
import { Dong } from "../hop-dong/dong";
import { ChiTietThangKy, NHOM_LAP, type NhomLap } from "./chi-tiet";
import {
  getInstallMonths,
  getInstallPending,
  type InstallMonth,
  type InstallPending,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

const n = (v: string | null) => (v === null ? "—" : Number(v).toLocaleString("vi-VN"));

type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const cong = (rows: { [k: string]: unknown }[], cot: string) =>
  rows.reduce((s, r) => s + Number(r[cot] ?? 0), 0);

const PHU_TRACH_LOC: Record<string, string> = {
  CONG_TY: "công ty",
  DAI_LY: "đại lý",
};

export default async function Page({ searchParams }: { searchParams: Promise<Tham> }) {
  const sp = await searchParams;
  const [thangAll, choAll] = await Promise.all([getInstallMonths(), getInstallPending()]);

  const pt = mot(sp.pt) in PHU_TRACH_LOC ? mot(sp.pt) : "";
  const hop = <T extends { do_cong_ty: boolean }>(rows: T[]) =>
    pt === "" ? rows : rows.filter((r) => r.do_cong_ty === (pt === "CONG_TY"));
  const thang = hop(thangAll);
  const cho = hop(choAll);

  const moThang = /^\d{4}-\d{2}$/.test(mot(sp.thang)) ? mot(sp.thang) : "";
  const moNhom: NhomLap = Object.hasOwn(NHOM_LAP, mot(sp.nhom))
    ? (mot(sp.nhom) as NhomLap)
    : "cho_lap";

  const link = (t: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(t)) if (v) p.set(k, v);
    const duoi = p.toString();
    return duoi ? `/lap-dat?${duoi}` : "/lap-dat";
  };

  const cacKy = [...new Set(thang.map((r) => r.ky_ky))];
  const nhomCho = [...new Set(cho.map((r) => r.nhom_cho))].sort();
  const choQuaHan = cong(cho.filter((r) => r.nhom_cho.startsWith("4.")), "so_don");

  // Trung vị của toàn hệ thống chứ không phải trung bình các trung vị: lấy tháng
  // gần nhất có đủ dữ liệu để khỏi bị tháng mới ký kéo lệch.
  const thangDu = thang.filter((r) => Number(r.lap_xong) >= 20 && r.ngay_trung_vi !== null);
  const ngayTieuBieu = thangDu.length
    ? Math.round(cong(thangDu, "ngay_trung_vi") / thangDu.length)
    : null;

  const tong = (cot: keyof InstallMonth) => cong(thang, cot);

  return (
    <main>
      <h1>Lắp đặt wifi cố định</h1>
      <p className="muted">
        Gom theo <b>tháng ký</b> chứ không theo tháng lắp — chỉ vậy mới thấy được trong số đơn bán
        ra tháng đó, bao nhiêu thành công, bao nhiêu rơi, và chờ bao lâu. Bấm vào một tháng để xem
        danh sách đơn.
      </p>

      <p className="actions">
        <Link href={link({ thang: moThang || undefined, nhom: moThang ? moNhom : undefined })}>
          <button type="button" className={pt === "" ? "primary" : undefined}>
            Cả hai
          </button>
        </Link>
        {Object.entries(PHU_TRACH_LOC).map(([ma, ten]) => (
          <Link
            key={ma}
            href={link({ pt: ma, thang: moThang || undefined, nhom: moThang ? moNhom : undefined })}
          >
            <button type="button" className={pt === ma ? "primary" : undefined}>
              {ten}
            </button>
          </Link>
        ))}
      </p>

      <div className="the-hang">
        <div className="the-so">
          <div className="the-ten">Đang chờ lắp</div>
          <div className="the-gia-tri">{cong(cho, "so_don").toLocaleString("vi-VN")}</div>
          <div className="the-phu">{choQuaHan.toLocaleString("vi-VN")} đơn quá 2 tháng</div>
        </div>
        <div className="the-so">
          <div className="the-ten">Đã lắp xong</div>
          <div className="the-gia-tri">{tong("lap_xong").toLocaleString("vi-VN")}</div>
          <div className="the-phu">
            {Math.round((1000 * tong("lap_xong")) / (tong("so_don") || 1)) / 10}% số đơn đã ký
          </div>
        </div>
        <div className="the-so">
          <div className="the-ten">Huỷ trước khi lắp</div>
          <div className="the-gia-tri">{tong("huy_truoc_lap").toLocaleString("vi-VN")}</div>
          <div className="the-phu">
            {Math.round((1000 * tong("huy_truoc_lap")) / (tong("so_don") || 1)) / 10}% số đơn đã ký
          </div>
        </div>
        <div className="the-so">
          <div className="the-ten">Ký đến lắp xong</div>
          <div className="the-gia-tri">{ngayTieuBieu ?? "—"}</div>
          <div className="the-phu">ngày, trung vị các tháng đã xong</div>
        </div>
      </div>

      <h2>Đơn đang chờ lắp</h2>
      <div className="scroller">
        <table>
          <thead>
            <tr>
              <th>Đã chờ</th>
              <th className="num">Số đơn</th>
              <th>Đơn cũ nhất ký ngày</th>
            </tr>
          </thead>
          <tbody>
            {nhomCho.map((nh) => {
              const r = cho.filter((x) => x.nhom_cho === nh);
              const qua = nh.startsWith("4.");
              return (
                <tr key={nh}>
                  <td>{nh.slice(3)}</td>
                  <td className={`num mono${qua ? " bad" : ""}`}>
                    {cong(r, "so_don").toLocaleString("vi-VN")}
                  </td>
                  <td className="mono muted">
                    {r.map((x) => x.ky_som_nhat).filter(Boolean).sort()[0] ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>Theo tháng ký</h2>
      <div className="scroller">
        <table className="bang-thang">
          <thead>
            <tr>
              <th>Tháng ký</th>
              <th className="num">Đơn ký</th>
              <th className="num">Đã lắp</th>
              <th className="num">Còn chờ</th>
              <th className="num">Huỷ trước lắp</th>
              <th className="num" title="Lắp xong rồi hợp đồng mới huỷ">Lắp rồi huỷ</th>
              <th className="num">Lắp hỏng</th>
              <th className="num" title="Số ngày từ ký tới lắp xong, lấy trung vị">Ngày chờ</th>
              <th>Tỉ lệ lắp</th>
            </tr>
          </thead>
          <tbody>
            {cacKy.map((ky) => {
              const r = thang.filter((x) => x.ky_ky === ky);
              const ty = Math.round((1000 * cong(r, "lap_xong")) / (cong(r, "so_don") || 1)) / 10;
              const ngay = r
                .map((x) => x.ngay_trung_vi)
                .filter((v): v is string => v !== null)
                .map(Number);
              return (
                <Dong key={ky} href={link({ pt: pt || undefined, thang: ky })} dangMo={moThang === ky}>
                  <td className="mono">{ky}</td>
                  <td className="num mono">{cong(r, "so_don").toLocaleString("vi-VN")}</td>
                  <td className="num mono">{cong(r, "lap_xong").toLocaleString("vi-VN")}</td>
                  <td className="num mono">{cong(r, "cho_lap").toLocaleString("vi-VN")}</td>
                  <td className="num mono">{cong(r, "huy_truoc_lap").toLocaleString("vi-VN")}</td>
                  <td className="num mono muted">{cong(r, "lap_roi_huy").toLocaleString("vi-VN")}</td>
                  <td className="num mono muted">{cong(r, "lap_hong").toLocaleString("vi-VN")}</td>
                  <td className="num mono">
                    {ngay.length ? Math.round(ngay.reduce((a, b) => a + b, 0) / ngay.length) : "—"}
                  </td>
                  <td>
                    <span className="bar">
                      <span className="bar-fill" style={{ width: `${Math.min(ty, 100)}%` }} />
                      <span className="bar-label mono">{ty}%</span>
                    </span>
                  </td>
                </Dong>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="muted khoi-ghi-chu">
        Tháng ký gần đây luôn có tỉ lệ lắp thấp và “còn chờ” cao — đơn mới ký chưa kịp lắp, không
        phải hỏng. Đọc tỉ lệ lắp từ những tháng đã đủ thời gian, và so cột “còn chờ” với số ngày chờ
        trung vị của chính tháng đó.
      </p>

      {moThang && (
        <ChiTietThangKy
          ky={moThang}
          nhom={moNhom}
          dongLai={link({ pt: pt || undefined })}
          linkNhom={(k) => link({ pt: pt || undefined, thang: moThang, nhom: k })}
        />
      )}
    </main>
  );
}
