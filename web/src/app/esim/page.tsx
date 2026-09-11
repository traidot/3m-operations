import { getEsimFunnel } from "@/lib/queries";
import { Bars } from "../wifi/bars";
import { Funnel } from "../wifi/funnel";

export const dynamic = "force-dynamic";

const n = (v: string | null) => (v === null ? "—" : Number(v).toLocaleString("vi-VN"));
const so = (v: string | null) => (v === null ? null : Number(v));
const cong = (rows: Record<string, string | null>[], k: string) => {
  const co = rows.some((r) => r[k] !== null && r[k] !== undefined);
  return co ? rows.reduce((t, r) => t + Number(r[k] ?? 0), 0) : null;
};

export default async function Page() {
  const rows = await getEsimFunnel();
  const bang = rows as unknown as Record<string, string | null>[];
  const nhan = rows.map((r) => r.thang);
  const ky = rows.length > 0 ? `${rows[0]!.thang} → ${rows[rows.length - 1]!.thang}` : "";

  const donHuy = cong(bang, "don_huy");

  return (
    <main>
      <h1>eSIM</h1>
      <p className="muted">
        Bán đứt, không có cước hàng tháng. Quảng cáo do TECHNO chạy. Phễu dừng ở đơn hàng.
      </p>

      <div className="stale">
        Chưa có doanh thu. Sheet quảng cáo chỉ ghi chi phí, tin nhắn và số đơn — không có
        dòng tiền bán, nên chưa tính được lãi hay chi phí trên doanh thu.
      </div>

      <h2>Phễu cộng dồn {ky}</h2>
      <Funnel
        bac={[
          { ten: "Tiếp cận", gia_tri: cong(bang, "tiep_can") },
          { ten: "Click", gia_tri: cong(bang, "click") },
          { ten: "Tin nhắn", gia_tri: cong(bang, "mess") },
          { ten: "Đơn hàng", gia_tri: cong(bang, "don"), ghi_chu: "marketing tự khai" },
        ]}
      />
      {donHuy !== null && donHuy > 0 && (
        <p className="muted">Trong đó {n(String(donHuy))} đơn huỷ.</p>
      )}

      <h2>Chi phí và đơn theo tháng</h2>
      <Bars
        nhan={nhan}
        chuoi={[{ ten: "Tin nhắn", mau: "var(--muted)", gia_tri: rows.map((r) => so(r.mess)) },
                { ten: "Đơn hàng", mau: "var(--ok)", gia_tri: rows.map((r) => so(r.don)) }]}
      />
      <Bars
        nhan={nhan}
        cao={150}
        chuoi={[{ ten: "Chi phí quảng cáo (đồng)", mau: "var(--bad)", gia_tri: rows.map((r) => so(r.chi_phi)) }]}
      />

      <h2>Số chi tiết</h2>
      <div className="scroller">
        <table>
          <thead>
            <tr>
              <th>Tháng</th>
              <th className="num">Chi phí</th>
              <th className="num">Tin nhắn</th>
              <th className="num">Đơn</th>
              <th className="num">Đơn huỷ</th>
              <th className="num">Giá mỗi tin nhắn</th>
              <th className="num">Chi phí mỗi đơn</th>
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((r) => (
              <tr key={r.thang}>
                <td className="mono">{r.thang}</td>
                <td className="num mono">{n(r.chi_phi)}</td>
                <td className="num mono">{n(r.mess)}</td>
                <td className="num mono">{n(r.don)}</td>
                <td className="num mono">{n(r.don_huy)}</td>
                <td className="num mono">{n(r.gia_mess)}</td>
                <td className="num mono">{n(r.chi_phi_moi_don)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
