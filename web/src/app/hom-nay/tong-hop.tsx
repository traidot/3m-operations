import type { TongHop28 } from "@/lib/queries";

const n = (v: number) =>
  v === 0 ? <span className="muted">—</span> : v.toLocaleString("vi-VN");

const THU = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const thu = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();
const cuoiTuan = (iso: string) => thu(iso) === 0 || thu(iso) === 6;

/** Nhãn hàng: thứ rồi tới ngày — nhịp cuối tuần khác hẳn nên phải đọc ra ngay. */
const nhanNgay = (iso: string) =>
  `${THU[thu(iso)]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

const tyLe = (huy: number, dk: number) =>
  dk === 0 ? null : Math.round((huy / dk) * 1000) / 10;

/** Các mảng cột, đúng thứ tự và cách gộp của bảng bên CMS. */
const NHOM = ["Đăng ký", "Huỷ", "Còn lại sau huỷ", "Lịch lắp của địa chỉ chưa huỷ", "Lắp đặt"];

/**
 * Cột của bảng. `g` là chỉ số nhóm ở NHOM — dùng cả để gộp ô tiêu đề lẫn để
 * tô nền xen kẽ, nên không thể suy ra từ thứ tự.
 *
 * `ty_le` không có trong dữ liệu, tính từ hai cột huỷ và đăng ký.
 */
const COT: readonly { k: keyof TongHop28 | "ty_le"; ten: string; g: number; manh?: boolean }[] = [
  { k: "lan_dau", ten: "Lần đầu", g: 0 },
  { k: "dang_ky_lai", ten: "Đăng ký lại", g: 0 },
  { k: "tong_dang_ky", ten: "Tổng", g: 0, manh: true },
  { k: "huy_truoc_lich", ten: "Trước lịch", g: 1 },
  { k: "huy_sau_lich", ten: "Sau lịch", g: 1 },
  { k: "huy_sau_lap", ten: "Sau lắp", g: 1 },
  { k: "tong_huy", ten: "Tổng", g: 1, manh: true },
  { k: "ty_le", ten: "Tỷ lệ", g: 1 },
  { k: "con_lai", ten: "Còn lại", g: 2, manh: true },
  { k: "co_lich_lap", ten: "Có lịch", g: 3 },
  { k: "chua_co_lich", ten: "Chưa có lịch", g: 3 },
  { k: "lap_xong", ten: "Lắp xong", g: 4, manh: true },
  { k: "co_lich_chua_lap", ten: "Có lịch chưa lắp", g: 4 },
  { k: "that_bai", ten: "Thất bại", g: 4 },
];

/** Nền xen kẽ theo nhóm, để mắt dò cột không lạc sang mảng bên cạnh. */
const nenNhom = (g: number) => (g % 2 === 1 ? " g-le" : "");
/** Vạch ngăn ở cột đầu của mỗi nhóm. */
const dauNhom = (i: number) => (i === 0 || COT[i]!.g !== COT[i - 1]!.g ? " mo-nhom" : "");

/**
 * Bảng tổng hợp hợp đồng theo ngày — bản sao của "Báo cáo tổng hợp" bên CMS,
 * chỉ đổi trục tháng thành ngày.
 *
 * Mỗi dòng là số phận của lứa hợp đồng VÀO SỔ ngày đó, không phải việc xảy ra
 * trong ngày: hợp đồng ký hôm nay mà ba tháng sau mới huỷ vẫn được đếm vào
 * dòng hôm nay. Vì vậy các dòng gần đây luôn trông "sạch" hơn — chúng chưa có
 * đủ thời gian để hỏng.
 */
export function BangTongHop({ ds }: { ds: TongHop28[] }) {
  if (ds.length === 0) return null;

  const tong = (k: keyof TongHop28) => ds.reduce((t, r) => t + Number(r[k]), 0);

  /** Một ô số, dùng chung cho dòng tổng và dòng ngày. */
  const o = (k: (typeof COT)[number]["k"], lay: (c: keyof TongHop28) => number) => {
    if (k !== "ty_le") return n(lay(k));
    const t = tyLe(lay("tong_huy"), lay("tong_dang_ky"));
    return t === null ? <span className="muted">—</span> : `${t}%`;
  };

  return (
    <section>
      <h2>
        2 · Tổng hợp theo ngày{" "}
        <span className="muted">— 28 ngày, cùng chỉ số với báo cáo tổng hợp bên CMS</span>
      </h2>
      <p className="muted">
        Mỗi dòng là lứa hợp đồng <b>vào sổ ngày đó</b>, không phải việc xảy ra trong
        ngày — hợp đồng ký hôm nay mà ba tháng nữa mới huỷ vẫn nằm ở dòng hôm nay.
        Nên dòng càng gần càng trông sạch: chúng chưa đủ thời gian để hỏng, và cột{" "}
        <b>chưa có lịch</b> của mấy ngày cuối là việc đang chờ làm chứ không phải
        việc đã hỏng. Thứ Bảy và Chủ nhật tô nền khác.
      </p>
      <div className="scroller">
        <table>
          <thead>
            <tr>
              <th />
              {NHOM.map((ten, g) => (
                <th
                  key={ten}
                  colSpan={COT.filter((c) => c.g === g).length}
                  className={`nhom-cot mo-nhom${nenNhom(g)}`}
                >
                  {ten}
                </th>
              ))}
            </tr>
            <tr>
              <th>Ngày</th>
              {COT.map((c, i) => (
                <th key={c.k} className={`num${dauNhom(i)}${nenNhom(c.g)}`}>
                  {c.ten}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="tong">
              <td>
                <b>7 ngày</b>
              </td>
              {COT.map((c, i) => (
                <td key={c.k} className={`num mono${dauNhom(i)}${nenNhom(c.g)}`}>
                  <b>{o(c.k, tong)}</b>
                </td>
              ))}
            </tr>
            {ds.map((r) => (
              <tr key={r.ngay} className={cuoiTuan(r.ngay) ? "o-nghi" : undefined}>
                <td className="mono">{nhanNgay(r.ngay)}</td>
                {COT.map((c, i) => (
                  <td
                    key={c.k}
                    className={`num mono${c.manh ? "" : " muted"}${dauNhom(i)}${nenNhom(c.g)}`}
                  >
                    {o(c.k, (k) => Number(r[k]))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
