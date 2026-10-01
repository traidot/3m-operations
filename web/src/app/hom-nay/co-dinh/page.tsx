import Link from "next/link";
import { Bars } from "../../wifi/bars";
import { Bang7 } from "../bang7";
import { BangTongHop } from "../tong-hop";
import {
  getBaoCaoNgayCoDinh7,
  getBaoCaoNgayCoDinh30,
  getFreshness,
  getLapDatQuaHan,
  getTongHopNgay,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

const n = (v: string | number | null) =>
  v === null ? "—" : Math.round(Number(v)).toLocaleString("vi-VN");

const ngayVn = (iso: string | null) =>
  iso === null ? "—" : `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export default async function Page() {
  const [ngay7, ngay30, tongHop, quaHan, freshness] = await Promise.all([
    getBaoCaoNgayCoDinh7(),
    getBaoCaoNgayCoDinh30(),
    getTongHopNgay(),
    getLapDatQuaHan(),
    getFreshness(),
  ]);

  // Nguồn chết âm thầm thì mọi dòng "hôm nay" đều bằng 0 mà nhìn như một ngày
  // ế — phải nói ra trước khi người xem kết luận.
  const cu = freshness.filter(
    (f) =>
      f.source === "FIXED" &&
      (f.lan_dong_bo_cuoi === null || Number(f.gio_ke_tu_lan_cuoi) > Number(f.nguong_gio)),
  );

  const hom_nay = new Date().toLocaleDateString("vi-VN", {
    weekday: "long", day: "2-digit", month: "2-digit", year: "numeric",
  });

  // CHUA_GHI là giá trị thô bên nguồn khi đợt thu chưa chọn tài khoản.
  const cua = (nhom: string) =>
    ngay7
      .filter((r) => r.nhom === nhom)
      .map((r) => (r.chi_so === "CHUA_GHI" ? { ...r, chi_so: "(chưa ghi tài khoản)" } : r));

  // Nhãn là ngày ISO đầy đủ: trục tự cắt lấy ngày, tooltip giữ cả tháng.
  const nhan = ngay30.map((d) => d.ngay);
  const tong30 = (k: "ky_moi" | "lap_xong" | "hoat_dong" | "huy") =>
    ngay30.reduce((t, d) => t + Number(d[k]), 0);

  return (
    <main>
      <h1>Hôm nay · wifi cố định</h1>
      <p className="muted">
        {hom_nay}. Biểu đồ là <b>30 ngày gần nhất</b> để thấy hình dạng cả tháng;
        các bảng bày thẳng <b>7 ngày gần nhất</b>, mỗi ngày một cột — ba con số
        hôm nay/hôm qua/trung bình nén cả tuần lại nên không thấy hôm nào thu, hôm
        nào nghỉ.
      </p>

      {cu.length > 0 && (
        <p className="stale">
          <b>Số dưới đây có thể đã cũ.</b> Nguồn wifi cố định chưa đồng bộ kịp:{" "}
          {cu.map((f) => f.table_name).join(", ")}.{" "}
          <Link href="/dong-bo">Xem đồng bộ →</Link>
        </p>
      )}

      <h2>
        1 · Hợp đồng <span className="muted">— vào và ra trong 30 ngày</span>
      </h2>
      <p className="muted">
        Ba khâu đầu nối nhau nên cột lệch pha là bình thường: ký hôm nay thì vài hôm
        sau mới lắp, lắp xong còn chờ tới ngày bắt đầu thu mới tính là{" "}
        <b>hoạt động</b> — phần lớn rơi vào mùng 1, nên cột đó dồn thành vài cọc cao
        chứ không trải đều. Cột <b>huỷ</b> để cùng trục cho thấy vào và ra bù nhau
        tới đâu.
      </p>
      <Bars
        moiNhan
        cao={230}
        nhan={nhan}
        chuoi={[
          { ten: "Ký mới", mau: "var(--muted)", gia_tri: ngay30.map((d) => Number(d.ky_moi)) },
          { ten: "Lắp xong", mau: "var(--ok)", gia_tri: ngay30.map((d) => Number(d.lap_xong)) },
          { ten: "Hoạt động", mau: "var(--lam)", gia_tri: ngay30.map((d) => Number(d.hoat_dong)) },
          { ten: "Huỷ", mau: "var(--do)", gia_tri: ngay30.map((d) => Number(d.huy)) },
        ]}
      />
      <p className="muted">
        Cộng 30 ngày: <b>{n(tong30("ky_moi"))}</b> ký mới ·{" "}
        <b>{n(tong30("lap_xong"))}</b> lắp xong · <b>{n(tong30("hoat_dong"))}</b> bắt
        đầu thu · <b>{n(tong30("huy"))}</b> huỷ — ròng{" "}
        <b>{n(tong30("ky_moi") - tong30("huy"))}</b> hợp đồng.
      </p>

      <BangTongHop ds={tongHop} />

      <Bang7
        ten="3 · Tiền về theo ngày"
        y="mỗi tài khoản một dòng, đơn vị yên"
        ds={cua("tien")}
        kieu="tien"
        phu="Mỗi ô là “tiền thật vào ngân hàng / tổng ghi nhận”. Dấu ✓ là hai số bằng nhau, tiền về đủ. Dấu ⚠ là phần chênh đã cấn trừ cọc — khách nộp từ trước, nay trừ sang cước, không có đồng nào mới vào tài khoản."
      />

      <Bang7
        ten="4 · Lắp đặt"
        y="theo ngày hẹn, nên ngày mai cũng có số"
        ds={cua("lap_dat")}
        kieu="so"
        congTong={false}
        phu={
          Number(quaHan.don) > 0
            ? `Ngoài bảng này còn ${n(quaHan.don)} đơn đã qua ngày hẹn mà chưa lắp xong, cũ nhất hẹn từ ${ngayVn(quaHan.hen_cu_nhat)} — ${n(quaHan.trong_30_ngay)} trong số đó hẹn trong 30 ngày gần đây, phần còn lại là tồn đọng cũ.`
            : undefined
        }
      />

      <Bang7
        ten="5 · Nhập liệu trễ"
        y="đợt thu được gõ vào máy ngày nào, tiền về ngày nào"
        ds={cua("nhap_lieu")}
        kieu="so"
        phu="Đếm theo ngày GÕ MÁY. “Gõ bù cho ngày trước” lớn nghĩa là cột tiền của mấy ngày gần đây còn thiếu và sẽ phình lên sau — đừng vội kết luận hôm nay thu kém."
      />
    </main>
  );
}
