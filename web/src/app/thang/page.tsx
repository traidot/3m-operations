import Link from "next/link";
import { Bars } from "../wifi/bars";
import { LocKhoang, docKhoang, type Tham } from "./khoang";
import {
  getCancelReasons,
  getRegisterReport,
  type RegisterReport,
} from "@/lib/queries";
import { LY_DO_HUY } from "@/lib/nhan";

export const dynamic = "force-dynamic";

const n = (v: string | null) => (v === null ? "—" : Number(v).toLocaleString("vi-VN"));
const so = (v: string | null) => (v === null ? null : Number(v));
const loc = (tham: Record<string, string>) => `/hop-dong?${new URLSearchParams(tham)}`;

function cong(rows: RegisterReport[], k: keyof RegisterReport) {
  return rows.reduce((t, r) => t + Number(r[k] ?? 0), 0);
}

function The({ ten, gia_tri, phu }: { ten: string; gia_tri: number; phu?: string }) {
  return (
    <div className="the-so">
      <div className="the-ten">{ten}</div>
      <div className="the-gia-tri mono">{gia_tri.toLocaleString("vi-VN")}</div>
      {phu && <div className="the-phu mono">{phu}</div>}
    </div>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<Tham> }) {
  const sp = await searchParams;
  const { donVi, tu, den } = docKhoang(sp);

  const [dk, lyDo] = await Promise.all([
    getRegisterReport(donVi, tu, den),
    getCancelReasons(tu, den),
  ]);

  const tongDangKy = cong(dk, "dang_ky");
  const tongHuy = cong(dk, "huy");
  const nguoc = [...dk].reverse();

  return (
    <main>
      <h1>Hợp đồng theo tháng</h1>
      <p className="muted">
        Xếp theo <b>ngày ký</b>: hợp đồng ký tháng 3 huỷ tháng 7 vẫn nằm ở dòng tháng 3.
        Đây là báo cáo theo lứa đăng ký, không phải theo ngày xảy ra sự việc. Cách chia
        giống báo cáo tổng hợp bên CMS nên đối chiếu được. Tiền thu được tách sang{" "}
        <Link href="/thang/tien">Tiền cước theo tháng</Link> vì nó xếp theo trục khác —
        ngày tiền về, không phải ngày ký.
      </p>

      <LocKhoang donVi={donVi} tu={tu} den={den} veMacDinh="/thang" />

      <div className="the-hang">
        <The ten="Đăng ký lần đầu" gia_tri={cong(dk, "dang_ky_lan_dau")} />
        <The ten="Đăng ký lại" gia_tri={cong(dk, "dang_ky_lai")} />
        <The
          ten="Tổng huỷ"
          gia_tri={tongHuy}
          phu={tongDangKy > 0 ? `${((100 * tongHuy) / tongDangKy).toFixed(2)}%` : undefined}
        />
        <The ten="Lắp đặt thành công" gia_tri={cong(dk, "lap_xong")} />
        <The ten="Có lịch chưa lắp" gia_tri={cong(dk, "co_lich_lap")} />
        <The ten="Lắp đặt thất bại" gia_tri={cong(dk, "lap_that_bai")} />
        <The ten="Còn lại" gia_tri={cong(dk, "con_lai")} />
      </div>

      {/* Theo ngày thì cột quá dày, đọc bảng nhanh hơn nhìn đồ thị. */}
      {donVi === "thang" && (
        <>
          <h2>Đăng ký và huỷ theo tháng</h2>
          <Bars
            nhan={dk.map((r) => r.ky)}
            chuoi={[
              { ten: "Đăng ký", mau: "var(--line-strong)", gia_tri: dk.map((r) => so(r.dang_ky)) },
              { ten: "Lắp xong", mau: "var(--ok)", gia_tri: dk.map((r) => so(r.lap_xong)) },
              { ten: "Huỷ", mau: "var(--bad)", gia_tri: dk.map((r) => so(r.huy)) },
            ]}
          />
        </>
      )}

      <div className="scroller">
        <table>
          <thead>
            <tr>
              <th rowSpan={2}>{donVi === "ngay" ? "Ngày" : "Tháng"}</th>
              <th colSpan={3} className="nhom">Đăng ký</th>
              <th colSpan={4} className="nhom">Huỷ</th>
              <th rowSpan={2} className="num">Còn lại</th>
              <th colSpan={2} className="nhom">Lịch lắp của địa chỉ chưa huỷ</th>
              <th rowSpan={2} className="num">Lắp xong</th>
              <th rowSpan={2} className="num">Lắp thất bại</th>
            </tr>
            <tr>
              <th className="num">Lần đầu</th>
              <th className="num">Đăng ký lại</th>
              <th className="num">Tổng</th>
              <th className="num">Trước lịch</th>
              <th className="num">Sau lịch</th>
              <th className="num">Sau lắp xong</th>
              <th className="num">Tỷ lệ</th>
              <th className="num">Có lịch</th>
              <th className="num">Chưa có lịch</th>
            </tr>
          </thead>
          <tbody>
            {nguoc.map((r) => {
              const ty = r.ty_le_huy === null ? null : Number(r.ty_le_huy);
              return (
                <tr key={r.ky}>
                  <td className="mono">
                    {donVi === "ngay" ? r.ky : <Link href={loc({ thang_ky: r.ky })}>{r.ky}</Link>}
                  </td>
                  <td className="num mono">{n(r.dang_ky_lan_dau)}</td>
                  <td className="num mono muted">{n(r.dang_ky_lai)}</td>
                  <td className="num mono">{n(r.dang_ky)}</td>
                  <td className="num mono">{n(r.huy_truoc_lich)}</td>
                  <td className="num mono">{n(r.huy_sau_lich)}</td>
                  <td className="num mono">{n(r.huy_sau_lap)}</td>
                  <td className={`num mono${ty !== null && ty >= 40 ? " bad" : ""}`}>
                    {ty === null ? "—" : `${ty}%`}
                  </td>
                  <td className="num mono">{n(r.con_lai)}</td>
                  <td className="num mono">{n(r.co_lich_lap)}</td>
                  <td className="num mono">{n(r.chua_co_lich)}</td>
                  <td className="num mono">{n(r.lap_xong)}</td>
                  <td className={`num mono${Number(r.lap_that_bai) > 0 ? " bad" : ""}`}>
                    {n(r.lap_that_bai)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>Vì sao huỷ</h2>
      <p className="muted">
        Lý do bên nguồn là ô chữ tự do — 582 cách viết cho cùng vài ý, lẫn tiếng Nhật và
        lỗi chính tả — nên phải gom nhóm theo từ khoá. Bấm vào nhóm để ra danh sách.
      </p>
      <div className="scroller">
        <table>
          <thead>
            <tr>
              <th>Nhóm lý do</th>
              <th className="num">Hợp đồng</th>
              <th className="num">Trước lịch</th>
              <th className="num">Sau lịch</th>
              <th className="num">Sau lắp xong</th>
              <th>Tỉ trọng</th>
            </tr>
          </thead>
          <tbody>
            {lyDo.map((r) => {
              const ty = tongHuy > 0 ? (100 * Number(r.so_hop_dong)) / tongHuy : 0;
              return (
                <tr key={r.nhom}>
                  <td>
                    <Link href={loc({ ly_do: r.nhom })}>{LY_DO_HUY[r.nhom] ?? r.nhom}</Link>
                  </td>
                  <td className="num mono">{n(r.so_hop_dong)}</td>
                  <td className="num mono">{n(r.truoc_lich)}</td>
                  <td className="num mono">{n(r.sau_lich)}</td>
                  <td className={`num mono${Number(r.sau_lap) > 0 ? " bad" : ""}`}>
                    {n(r.sau_lap)}
                  </td>
                  <td>
                    <span className="bar">
                      <span className="bar-fill" style={{ width: `${Math.min(ty, 100)}%` }} />
                      <span className="bar-label mono">{ty.toFixed(1)}%</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted">
        Cột “sau lắp xong” là mất khách sau khi đã tốn tiền thi công — đắt nhất trong ba
        mốc.
      </p>

    </main>
  );
}
