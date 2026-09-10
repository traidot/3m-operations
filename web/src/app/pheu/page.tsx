import { getFunnel } from "@/lib/queries";
import { Bars } from "./bars";

export const dynamic = "force-dynamic";

const n = (v: string | null) => (v === null ? "—" : Number(v).toLocaleString("vi-VN"));
const so = (v: string | null) => (v === null ? null : Number(v));

export default async function Page() {
  const rows = await getFunnel();
  const nhan = rows.map((r) => r.thang);

  return (
    <main>
      <h1>Phễu marketing → sale → thu cước</h1>
      <p className="muted">
        Chi phí quảng cáo tính bằng đồng, cước wifi cố định tính bằng yên. Chưa chốt tỉ
        giá nên hai đầu để riêng, không vẽ chung một trục và không chia cho nhau.
      </p>

      <h2>Từ tin nhắn tới hợp đồng</h2>
      <p className="muted">
        Chỉ lấy dòng wifi cố định trong sheet quảng cáo, vì hợp đồng bên hệ thống cũng chỉ
        là wifi cố định. Cột TỔNG của sheet gộp cả pocket, wimax, esim nên so với nó là so
        nhầm rổ.
      </p>
      <Bars
        nhan={nhan}
        chuoi={[
          { ten: "Tin nhắn (cố định)", mau: "var(--muted)", gia_tri: rows.map((r) => so(r.mess_co_dinh)) },
          { ten: "Đơn marketing khai", mau: "var(--bad)", gia_tri: rows.map((r) => so(r.don_khai_co_dinh)) },
          { ten: "Hợp đồng ký mới", mau: "var(--ok)", gia_tri: rows.map((r) => so(r.hop_dong_moi)) },
        ]}
      />

      <h2>Chi phí quảng cáo (đồng)</h2>
      <Bars
        nhan={nhan}
        cao={160}
        chuoi={[
          { ten: "Tổng mọi sản phẩm", mau: "var(--line-strong)", gia_tri: rows.map((r) => so(r.chi_phi_ads)) },
          { ten: "Riêng wifi cố định", mau: "var(--bad)", gia_tri: rows.map((r) => so(r.chi_phi_co_dinh)) },
        ]}
      />

      <h2>Cước wifi cố định (yên)</h2>
      <Bars
        nhan={nhan}
        cao={160}
        chuoi={[
          { ten: "Phải thu", mau: "var(--line-strong)", gia_tri: rows.map((r) => so(r.cuoc_phai_thu)) },
          { ten: "Đã thu", mau: "var(--ok)", gia_tri: rows.map((r) => so(r.cuoc_da_thu)) },
        ]}
      />

      <h2>Số chi tiết</h2>
      <div className="scroller">
        <table>
          <thead>
            <tr>
              <th>Tháng</th>
              <th className="num">Chi phí ads</th>
              <th className="num">Mess cố định</th>
              <th className="num">Đơn khai</th>
              <th className="num">Hợp đồng mới</th>
              <th className="num">Đơn → hợp đồng</th>
              <th className="num">Cước phải thu</th>
              <th className="num">Cước đã thu</th>
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((r) => (
              <tr key={r.thang}>
                <td className="mono">{r.thang}</td>
                <td className="num mono">{n(r.chi_phi_ads)}</td>
                <td className="num mono">{n(r.mess_co_dinh)}</td>
                <td className="num mono">{n(r.don_khai_co_dinh)}</td>
                <td className="num mono">{n(r.hop_dong_moi)}</td>
                <td className={`num mono ${Number(r.ty_le_don_thanh_hop_dong ?? 0) > 100 ? "bad" : ""}`}>
                  {r.ty_le_don_thanh_hop_dong ? `${r.ty_le_don_thanh_hop_dong}%` : "—"}
                </td>
                <td className="num mono">{n(r.cuoc_phai_thu)}</td>
                <td className="num mono">{n(r.cuoc_da_thu)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="muted">
        Cột &ldquo;đơn → hợp đồng&rdquo; vượt 100% nghĩa là hợp đồng ký được nhiều hơn số
        đơn marketing tự khai. Hoặc phần lớn hợp đồng đến từ nguồn khác quảng cáo Facebook,
        hoặc marketing khai thiếu. Chưa có trường nguồn khách trong hệ thống nên chưa phân
        biệt được hai khả năng đó.
      </p>
    </main>
  );
}
