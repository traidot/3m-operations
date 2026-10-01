import type { TongHopNgay } from "@/lib/queries";

const n = (v: string | number) => {
  const x = Math.round(Number(v));
  return x === 0 ? <span className="muted">—</span> : x.toLocaleString("vi-VN");
};

const ngayNgan = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Khoá số và nhãn của từng cột, theo đúng thứ tự bảng bên CMS. */
const COT = [
  { k: "lan_dau", ten: "Lần đầu" },
  { k: "dang_ky_lai", ten: "Đăng ký lại" },
  { k: "tong_dang_ky", ten: "Tổng", manh: true },
  { k: "huy_truoc_lich", ten: "Trước lịch" },
  { k: "huy_sau_lich", ten: "Sau lịch" },
  { k: "huy_sau_lap", ten: "Sau lắp" },
  { k: "tong_huy", ten: "Tổng", manh: true },
  { k: "con_lai", ten: "Còn lại", manh: true },
  { k: "co_lich_lap", ten: "Có lịch" },
  { k: "chua_co_lich", ten: "Chưa có lịch" },
  { k: "lap_xong", ten: "Lắp xong", manh: true },
  { k: "co_lich_chua_lap", ten: "Có lịch chưa lắp" },
  { k: "that_bai", ten: "Thất bại" },
] as const satisfies readonly { k: keyof TongHopNgay; ten: string; manh?: boolean }[];

/** Các mảng cột gộp đầu bảng, khớp với thứ tự của COT. */
const NHOM = [
  { ten: "Đăng ký", rong: 3 },
  { ten: "Huỷ", rong: 4 },
  { ten: "", rong: 1 },
  { ten: "Lịch lắp của địa chỉ chưa huỷ", rong: 2 },
  { ten: "Lắp đặt", rong: 3 },
];

/**
 * Bảng tổng hợp hợp đồng theo ngày — bản sao của "Báo cáo tổng hợp" bên CMS,
 * chỉ đổi trục tháng thành ngày.
 *
 * Mỗi dòng là số phận của lứa hợp đồng VÀO SỔ ngày đó, không phải việc xảy ra
 * trong ngày: hợp đồng ký hôm nay mà ba tháng sau mới huỷ vẫn được đếm vào
 * dòng hôm nay. Vì vậy các dòng gần đây luôn trông "sạch" hơn — chúng chưa có
 * đủ thời gian để hỏng.
 */
export function BangTongHop({ ds }: { ds: TongHopNgay[] }) {
  if (ds.length === 0) return null;
  const tong = (k: keyof TongHopNgay) =>
    ds.reduce((t, r) => t + Number(r[k]), 0);
  const tyLe = (huy: number, dk: number) => (dk > 0 ? Math.round((huy / dk) * 1000) / 10 : 0);

  return (
    <section>
      <h2>
        2 · Tổng hợp theo ngày{" "}
        <span className="muted">— cùng chỉ số với báo cáo tổng hợp bên CMS</span>
      </h2>
      <p className="muted">
        Mỗi dòng là lứa hợp đồng <b>vào sổ ngày đó</b>, không phải việc xảy ra trong
        ngày — hợp đồng ký hôm nay mà ba tháng nữa mới huỷ vẫn nằm ở dòng hôm nay.
        Nên những dòng gần đây luôn trông sạch hơn: chúng chưa đủ thời gian để hỏng,
        và cột <b>chưa có lịch</b> của mấy ngày cuối là việc đang chờ làm chứ không
        phải việc đã hỏng.
      </p>
      <div className="scroller">
        <table>
          <thead>
            <tr>
              <th />
              {NHOM.map((g, i) => (
                <th key={g.ten || i} colSpan={g.rong} className="num nhom-cot">
                  {g.ten}
                </th>
              ))}
            </tr>
            <tr>
              <th>Ngày</th>
              {COT.map((c) => (
                <th key={c.k} className="num">
                  {c.ten}
                </th>
              ))}
              <th className="num">Tỷ lệ huỷ</th>
            </tr>
          </thead>
          <tbody>
            <tr className="tong">
              <td>
                <b>30 ngày</b>
              </td>
              {COT.map((c) => (
                <td key={c.k} className="num mono">
                  <b>{n(tong(c.k))}</b>
                </td>
              ))}
              <td className="num mono">
                <b>{tyLe(tong("tong_huy"), tong("tong_dang_ky"))}%</b>
              </td>
            </tr>
            {ds.map((r) => (
              <tr key={r.ngay}>
                <td className="mono">{ngayNgan(r.ngay)}</td>
                {COT.map((c) => (
                  <td key={c.k} className={`num mono${"manh" in c && c.manh ? "" : " muted"}`}>
                    {n(r[c.k])}
                  </td>
                ))}
                <td className="num mono muted">
                  {Number(r.tong_dang_ky) === 0
                    ? "—"
                    : `${tyLe(Number(r.tong_huy), Number(r.tong_dang_ky))}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
