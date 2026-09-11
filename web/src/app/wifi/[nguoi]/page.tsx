import { notFound } from "next/navigation";
import Link from "next/link";
import { getWifiFunnelByPerson } from "@/lib/queries";
import { Bars } from "../bars";
import { Funnel } from "../funnel";

export const dynamic = "force-dynamic";

/** Mỗi người chạy ads một Google Sheet riêng, sheet_owner là khoá trong kho. */
const NGUOI: Record<string, { ten: string; key: string }> = {
  viet: { ten: "Đình Việt", key: "dinh_viet" },
  hoang: { ten: "Việt Hoàng", key: "viet_hoang" },
};

const n = (v: string | null) => (v === null ? "—" : Number(v).toLocaleString("vi-VN"));
const so = (v: string | null) => (v === null ? null : Number(v));
const cong = (rows: Record<string, string | null>[], k: string) => {
  const co = rows.some((r) => r[k] !== null && r[k] !== undefined);
  return co ? rows.reduce((t, r) => t + Number(r[k] ?? 0), 0) : null;
};

export default async function Page({ params }: { params: Promise<{ nguoi: string }> }) {
  const { nguoi } = await params;
  const ai = NGUOI[nguoi];
  if (!ai) notFound();

  const rows = await getWifiFunnelByPerson(ai.key);
  const nhan = rows.map((r) => r.thang);
  const ky = rows.length > 0 ? `${rows[0]!.thang} → ${rows[rows.length - 1]!.thang}` : "";
  const bang = rows as unknown as Record<string, string | null>[];

  return (
    <main>
      <h1>{ai.ten}</h1>
      <p className="muted">
        Quảng cáo mảng wifi do {ai.ten} chạy, đọc từ sheet riêng của {ai.ten}. Phễu dừng
        ở lắp đặt: hợp đồng trong hệ thống và cước thu được không ghi ai là người kéo
        khách về, nên không chia được cho từng người. Hai bậc đó chỉ có ở{" "}
        <Link href="/wifi">trang chung</Link>.
      </p>

      <h2>Phễu cộng dồn {ky}</h2>
      <Funnel
        bac={[
          { ten: "Tiếp cận", gia_tri: cong(bang, "tiep_can"), ghi_chu: "người thấy quảng cáo" },
          { ten: "Click", gia_tri: cong(bang, "click") },
          { ten: "Tin nhắn", gia_tri: cong(bang, "mess") },
          { ten: "Đơn khai", gia_tri: cong(bang, "don_khai") },
          { ten: "Lắp xong", gia_tri: cong(bang, "lap_xong"), ghi_chu: "chỉ wifi cố định" },
        ]}
      />

      <h2>Tin nhắn và đơn theo tháng</h2>
      <Bars
        nhan={nhan}
        chuoi={[
          { ten: "Tin nhắn", mau: "var(--muted)", gia_tri: rows.map((r) => so(r.mess)) },
          { ten: "Đơn khai", mau: "var(--ok)", gia_tri: rows.map((r) => so(r.don_khai)) },
          { ten: "Đơn huỷ", mau: "var(--bad)", gia_tri: rows.map((r) => so(r.don_huy)) },
        ]}
      />

      <h2>Chi phí quảng cáo theo sản phẩm (đồng)</h2>
      <Bars
        nhan={nhan}
        cao={150}
        chuoi={[
          { ten: "Wifi cố định", mau: "var(--line-strong)", gia_tri: rows.map((r) => so(r.chi_phi_co_dinh)) },
          { ten: "Wifi cầm tay", mau: "var(--ok)", gia_tri: rows.map((r) => so(r.chi_phi_cam_tay)) },
          { ten: "Wimax", mau: "var(--bad)", gia_tri: rows.map((r) => so(r.chi_phi_wimax)) },
        ]}
      />

      <h2>Số chi tiết</h2>
      <div className="scroller">
        <table>
          <thead>
            <tr>
              <th>Tháng</th>
              <th className="num">Chi phí</th>
              <th className="num">Tiếp cận</th>
              <th className="num">Click</th>
              <th className="num">Mess</th>
              <th className="num">Giá mess</th>
              <th className="num">Đơn khai</th>
              <th className="num">Đơn huỷ</th>
              <th className="num">Đơn cố định</th>
              <th className="num">Đơn cầm tay</th>
              <th className="num">Đơn wimax</th>
              <th className="num">Lịch lắp</th>
              <th className="num">Lắp xong</th>
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((r) => (
              <tr key={r.thang}>
                <td className="mono">{r.thang}</td>
                <td className="num mono">{n(r.chi_phi)}</td>
                <td className="num mono">{n(r.tiep_can)}</td>
                <td className="num mono">{n(r.click)}</td>
                <td className="num mono">{n(r.mess)}</td>
                <td className="num mono">{n(r.gia_mess)}</td>
                <td className="num mono">{n(r.don_khai)}</td>
                <td className="num mono">{n(r.don_huy)}</td>
                <td className="num mono">{n(r.don_co_dinh)}</td>
                <td className="num mono">{n(r.don_cam_tay)}</td>
                <td className="num mono">{n(r.don_wimax)}</td>
                <td className="num mono">{n(r.lich_lap)}</td>
                <td className="num mono">{n(r.lap_xong)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
