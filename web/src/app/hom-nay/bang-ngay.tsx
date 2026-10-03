import Link from "next/link";
import type { Ngay28 } from "@/lib/queries";

const n = (v: string | number) => Math.round(Number(v)).toLocaleString("vi-VN");

/** Khoá của một ô, đủ để trang dựng lại ngăn kéo từ URL. Dấu | an toàn vì tên
 *  tài khoản bên nguồn không có ký tự đó. */
export const ma = (chiSo: string, ngay: string) =>
  encodeURIComponent(`${chiSo}|${ngay}`);

const THU = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

/** Thứ trong tuần của một ngày ISO. Đọc theo UTC vì chuỗi không mang múi giờ:
 *  new Date("2026-10-03") là nửa đêm UTC, lấy getDay() theo giờ máy sẽ lùi
 *  một ngày ở múi giờ âm. */
const thu = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();

/** Cuối tuần: nhịp làm việc khác hẳn, không đánh dấu thì nhìn như ngày ế. */
const cuoiTuan = (iso: string) => thu(iso) === 0 || thu(iso) === 6;

/** Ngày liền trước, dạng ISO. */
const homQuaCua = (homNay: string) => {
  const d = new Date(`${homNay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

/**
 * Nhãn hàng: thứ rồi tới ngày, cùng một khuôn cho mọi dòng. Hai ngày gần nhất
 * ghi thêm trong ngoặc — đó là hai dòng người ta tìm trước tiên, đếm ngược từ
 * đầu bảng thì mất công.
 */
export const nhanNgay = (ngay: string, homNay: string) => {
  const d = `${THU[thu(ngay)]} ${ngay.slice(8, 10)}/${ngay.slice(5, 7)}`;
  if (ngay === homNay) return `${d} (hôm nay)`;
  if (ngay === homQuaCua(homNay)) return `${d} (hôm qua)`;
  return d;
};

/** Lớp của một hàng ngày: hai ngày gần nhất nổi lên, cuối tuần tô nhạt. */
export const lopNgay = (ngay: string, homNay: string) => {
  if (ngay === homNay) return "o-homnay";
  if (ngay === homQuaCua(homNay)) return "o-homqua";
  return cuoiTuan(ngay) ? "o-nghi" : undefined;
};

/**
 * Dấu đứng cuối ô tiền. Vẽ bằng SVG chứ không dùng ký tự ✓ ⚠: ký tự phụ thuộc
 * font, mỗi máy ra một cỡ một nét, và cái tam giác cảnh báo thường bị font
 * dựng mảnh tới mức nhìn không ra.
 */
export function Dau({ du, chenh }: { du: boolean; chenh: number }) {
  return (
    <span
      className={`dau ${du ? "du" : "lech"}`}
      title={du ? "đã duyệt hết" : `còn ${n(chenh)} chưa duyệt`}
    >
      <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
        {du ? (
          <path
            d="M3 8.6l3.3 3.3L13.2 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <>
            <path
              d="M8 1.9l6.6 11.6H1.4z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path
              d="M8 6.3v3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
            <circle cx="8" cy="11.6" r="0.95" fill="currentColor" />
          </>
        )}
      </svg>
    </span>
  );
}

/**
 * Bảng 28 ngày: mỗi HÀNG một ngày, mỗi cột một chỉ số.
 *
 * Xoay chiều này vì ô tiền có hai số và một dấu, rộng 171px — xếp 28 ngày
 * thành cột thì bảng dài 5.000px, cuộn ngang gần ba màn hình. Để ngày làm
 * hàng thì chỉ còn 6-7 cột, vừa khít màn hình và đọc giống bảng tổng hợp ở
 * mục trên.
 *
 * `kieu` đổi cách gom cột cuối: nhóm tiền tách tổng làm hai cột, tiền thật
 * vào tài khoản và tiền cấn trừ cọc. Cấn trừ cọc là nghiệp vụ bình thường —
 * khách đã nộp từ trước, nay trừ sang cước — nhưng gộp chung một tổng thì
 * ngày cấn trừ nhiều nhìn như ngày thu tốt, trong khi ngân hàng không nhận
 * thêm đồng nào.
 */
export function BangNgay({
  ten, y, ds, kieu, phu, phuNut, congTong = true, moO, dauDuyet = true,
}: {
  ten: string;
  y: string;
  ds: Ngay28[];
  kieu: "tien" | "so";
  phu?: string;
  /** Như `phu` nhưng có liên kết bên trong. */
  phuNut?: React.ReactNode;
  /** Đường dẫn của trang chứa bảng. Có thì mỗi ô có số thành một liên kết mở
   *  ngăn kéo chi tiết; không có thì ô là chữ thường. */
  moO?: string;
  /** Tắt ở nguồn không có khái niệm duyệt — bên cầm tay tiền về là xong, dấu
   *  luôn khớp nên chỉ thành nhiễu. */
  dauDuyet?: boolean;
  /** Tắt khi các cột lồng nhau — "đơn hẹn" đã gồm cả "đã lắp xong", cộng lại
   *  ra số không tồn tại. */
  congTong?: boolean;
}) {
  if (ds.length === 0) return null;
  const ngays = [...new Set(ds.map((r) => r.ngay))].sort().reverse();
  const homNay = ngays[0] ?? "";
  const chiSos = [...new Set(ds.map((r) => r.chi_so))];
  const o = new Map(ds.map((r) => [`${r.chi_so}|${r.ngay}`, r]));

  type Cot = "tien" | "that" | "duyet" | "so";
  const giaTri = (r: Ngay28 | undefined, cot: Cot) => {
    if (r === undefined) return 0;
    if (cot === "tien") return Number(r.tien);
    if (cot === "that") return Number(r.tien_that);
    if (cot === "duyet") return Number(r.tien_duyet);
    return Number(r.so_luong);
  };
  const congQua = (ds2: string[], ngay: string, cot: Cot) =>
    ds2.reduce((t, cs) => t + giaTri(o.get(`${cs}|${ngay}`), cot), 0);

  // Dòng cấn trừ cọc nhận ra bằng chính số liệu: cả tháng không có đồng nào
  // vào tài khoản mà vẫn có tiền ghi nhận. Không dò theo tên kênh — tên bên
  // nguồn đổi lúc nào không biết.
  const laCoc = (cs: string) =>
    ngays.every((d) => giaTri(o.get(`${cs}|${d}`), "that") === 0) &&
    ngays.some((d) => giaTri(o.get(`${cs}|${d}`), "tien") > 0);
  const kenhThat = kieu === "tien" ? chiSos.filter((cs) => !laCoc(cs)) : chiSos;
  const kenhCoc = kieu === "tien" ? chiSos.filter(laCoc) : [];

  // Hai số "đã duyệt / tổng ghi nhận" kèm dấu. Phần chênh là tiền đã đếm trên
  // báo cáo mà kế toán chưa xác nhận.
  const oTien = (duyet: number, tong: number, dam = false) => {
    if (tong === 0) return <span className="muted">—</span>;
    if (!dauDuyet) return dam ? <b>{n(tong)}</b> : <>{n(tong)}</>;
    return (
      <>
        <span className="muted">{n(duyet)}</span> / {dam ? <b>{n(tong)}</b> : n(tong)}
        <Dau du={duyet === tong} chenh={tong - duyet} />
      </>
    );
  };

  /** Nội dung một ô, chưa bọc liên kết. */
  const noiDung = (cs: string, d: string) => {
    const r = o.get(`${cs}|${d}`);
    if (kieu !== "tien" || laCoc(cs)) {
      const v = kieu === "tien" ? giaTri(r, "tien") : giaTri(r, "so");
      return v === 0 ? <span className="muted">—</span> : <>{n(v)}</>;
    }
    return oTien(giaTri(r, "duyet"), giaTri(r, "tien"));
  };

  const coSo = (cs: string, d: string) =>
    giaTri(o.get(`${cs}|${d}`), kieu === "tien" ? "tien" : "so") > 0;

  return (
    <section>
      <h2>
        {ten} <span className="muted">— {y}</span>
      </h2>
      <div className="scroller">
        <table className="ngay-hang">
          <thead>
            <tr>
              <th>Ngày</th>
              {chiSos.map((cs) => (
                <th key={cs} className="num">
                  {cs}
                  {kieu === "so" && (
                    <span className="muted">
                      {" · "}
                      {ds.find((r) => r.chi_so === cs)?.don_vi}
                    </span>
                  )}
                </th>
              ))}
              {congTong && chiSos.length > 1 && (
                <th className="num">
                  {kieu === "tien" ? "Tổng vào tài khoản" : "Tổng"}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {ngays.map((d) => (
              <tr key={d} className={lopNgay(d, homNay)}>
                <td className="mono">{nhanNgay(d, homNay)}</td>
                {chiSos.map((cs) => (
                  <td key={cs} className="num mono">
                    {moO !== undefined && coSo(cs, d) ? (
                      <Link className="o-mo" href={`${moO}?o=${ma(cs, d)}`} scroll={false}>
                        {noiDung(cs, d)}
                      </Link>
                    ) : (
                      noiDung(cs, d)
                    )}
                  </td>
                ))}
                {congTong && chiSos.length > 1 && (
                  <td className="num mono">
                    {kieu === "tien" ? (
                      oTien(congQua(kenhThat, d, "duyet"), congQua(kenhThat, d, "tien"), true)
                    ) : congQua(chiSos, d, "so") === 0 ? (
                      <span className="muted">—</span>
                    ) : (
                      <b>{n(congQua(chiSos, d, "so"))}</b>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {kenhCoc.length > 0 && (
        <p className="muted">
          Cột <b>{kenhCoc.join(", ")}</b> đứng ngoài tổng: đó là tiền khách nộp từ
          trước nay trừ sang cước, có ghi nhận nhưng không đồng nào mới vào ngân hàng.
        </p>
      )}
      {phu && <p className="muted">{phu}</p>}
      {phuNut && <p className="muted">{phuNut}</p>}
    </section>
  );
}
