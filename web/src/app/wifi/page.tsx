import { getWifiFunnel, getWifiPersonTotals } from "@/lib/queries";
import { Bars } from "./bars";
import { Funnel } from "./funnel";

export const dynamic = "force-dynamic";

const n = (v: string | null) => (v === null ? "—" : Number(v).toLocaleString("vi-VN"));
const so = (v: string | null) => (v === null ? null : Number(v));
const cong = (rows: Record<string, string | null>[], k: string) => {
  const co = rows.some((r) => r[k] !== null && r[k] !== undefined);
  return co ? rows.reduce((t, r) => t + Number(r[k] ?? 0), 0) : null;
};

export default async function Page() {
  const [rows, nguoi] = await Promise.all([getWifiFunnel(), getWifiPersonTotals()]);
  const nhan = rows.map((r) => r.thang);
  const ky = rows.length > 0 ? `${rows[0]!.thang} → ${rows[rows.length - 1]!.thang}` : "";
  const bang = rows as unknown as Record<string, string | null>[];

  return (
    <main>
      <h1>Wifi cố định và cầm tay</h1>
      <p className="muted">
        Mảng cho thuê thiết bị, có cước hàng tháng. Quảng cáo do Đình Việt và Việt Hoàng
        chạy. Phễu kéo dài tới lúc thu được tiền.
      </p>

      <h2>Từng người chạy ads, cộng dồn {ky}</h2>
      <div className="scroller">
        <table>
          <thead>
            <tr>
              <th>Người chạy</th>
              <th className="num">Chi phí</th>
              <th className="num">Mess</th>
              <th className="num">Giá mess</th>
              <th className="num">Đơn khai</th>
              <th className="num">Đơn cố định</th>
              <th className="num">Lắp xong</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {nguoi.map((p) => (
              <tr key={p.nguoi_key}>
                <td>{p.nguoi}</td>
                <td className="num mono">{n(p.chi_phi)}</td>
                <td className="num mono">{n(p.mess)}</td>
                <td className="num mono">{n(p.gia_mess)}</td>
                <td className="num mono">{n(p.don_khai)}</td>
                <td className="num mono">{n(p.don_co_dinh)}</td>
                <td className="num mono">{n(p.lap_xong)}</td>
                <td>
                  <a href={`/wifi/${p.nguoi_key === "dinh_viet" ? "viet" : "hoang"}`}>
                    xem riêng
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Phễu cộng dồn {ky}</h2>
      <Funnel
        bac={[
          { ten: "Tiếp cận", gia_tri: cong(bang, "tiep_can"), ghi_chu: "người thấy quảng cáo" },
          { ten: "Click", gia_tri: cong(bang, "click") },
          { ten: "Tin nhắn", gia_tri: cong(bang, "mess_co_dinh"), ghi_chu: "riêng wifi cố định" },
          { ten: "Đơn marketing khai", gia_tri: cong(bang, "don_co_dinh") },
          { ten: "Hợp đồng ký", gia_tri: cong(bang, "hop_dong_moi"), ghi_chu: "từ hệ thống, không từ sheet" },
        ]}
      />
      <p className="muted">
        Bậc cuối rộng hơn bậc trên nên phễu phình ra: hợp đồng ký được nhiều hơn số đơn
        marketing tự khai. Hoặc phần lớn hợp đồng đến từ nguồn khác quảng cáo, hoặc
        marketing khai thiếu — chưa có trường nguồn khách nên chưa phân biệt được.
      </p>

      <h2>Hợp đồng và tin nhắn theo tháng</h2>
      <Bars
        nhan={nhan}
        chuoi={[
          { ten: "Tin nhắn (cố định)", mau: "var(--muted)", gia_tri: rows.map((r) => so(r.mess_co_dinh)) },
          { ten: "Đơn khai", mau: "var(--bad)", gia_tri: rows.map((r) => so(r.don_co_dinh)) },
          { ten: "Hợp đồng ký", mau: "var(--ok)", gia_tri: rows.map((r) => so(r.hop_dong_moi)) },
        ]}
      />

      <h2>Chi phí quảng cáo (đồng)</h2>
      <Bars
        nhan={nhan}
        cao={150}
        chuoi={[
          { ten: "Tổng", mau: "var(--line-strong)", gia_tri: rows.map((r) => so(r.chi_phi)) },
          { ten: "Riêng cố định", mau: "var(--bad)", gia_tri: rows.map((r) => so(r.chi_phi_co_dinh)) },
        ]}
      />

      <h2>Cước thu được (yên)</h2>
      <Bars
        nhan={nhan}
        cao={150}
        chuoi={[
          { ten: "Phải thu", mau: "var(--line-strong)", gia_tri: rows.map((r) => so(r.cuoc_phai_thu)) },
          { ten: "Đã thu", mau: "var(--ok)", gia_tri: rows.map((r) => so(r.cuoc_da_thu)) },
        ]}
      />
      <p className="muted">
        Chi phí quảng cáo tính bằng đồng, cước tính bằng yên. Chưa chốt tỉ giá nên hai
        khối để riêng và không chia cho nhau.
      </p>

      <h2>Số chi tiết</h2>
      <div className="scroller">
        <table>
          <thead>
            <tr>
              <th>Tháng</th>
              <th className="num">Chi phí ads</th>
              <th className="num">Mess</th>
              <th className="num">Đơn khai</th>
              <th className="num">Lịch lắp</th>
              <th className="num">Lắp xong</th>
              <th className="num">Hợp đồng ký</th>
              <th className="num">Cước đã thu</th>
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((r) => (
              <tr key={r.thang}>
                <td className="mono">{r.thang}</td>
                <td className="num mono">{n(r.chi_phi)}</td>
                <td className="num mono">{n(r.mess_co_dinh)}</td>
                <td className="num mono">{n(r.don_co_dinh)}</td>
                <td className="num mono">{n(r.lich_lap)}</td>
                <td className="num mono">{n(r.lap_xong)}</td>
                <td className="num mono">{n(r.hop_dong_moi)}</td>
                <td className="num mono">{n(r.cuoc_da_thu)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
