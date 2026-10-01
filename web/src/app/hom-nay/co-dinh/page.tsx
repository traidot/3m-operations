import Link from "next/link";
import { Bars } from "../../wifi/bars";
import { Bang7 } from "../bang7";
import {
  getBaoCaoNgayCoDinh7,
  getBaoCaoNgayCoDinh30,
  getFreshness,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

const n = (v: string | number | null) =>
  v === null ? "—" : Math.round(Number(v)).toLocaleString("vi-VN");

/** Nhãn trục: chỉ ngày, vì cả dải nằm trong một tháng. */
const nhanNgay = (iso: string) => iso.slice(8, 10);

export default async function Page() {
  const [ngay7, ngay30, freshness] = await Promise.all([
    getBaoCaoNgayCoDinh7(),
    getBaoCaoNgayCoDinh30(),
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

  const nhan = ngay30.map((d) => nhanNgay(d.ngay));
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

      <Bang7
        ten="2 · Tiền về theo ngày"
        y="mỗi tài khoản một dòng, đơn vị yên"
        ds={cua("tien")}
        kieu="tien"
        phu="Ô có hai số là “tiền thật vào ngân hàng / tổng ghi nhận”: phần chênh là cấn trừ cọc — khách đã nộp từ trước, nay trừ sang cước, hôm nay không có đồng nào mới vào tài khoản. Ô một số là cả hai bằng nhau."
      />

      <Bang7
        ten="3 · Lắp đặt"
        y="đơn hẹn lịch lắp theo ngày hẹn"
        ds={cua("lap_dat")}
        kieu="so"
      />

      <Bang7
        ten="4 · Nhập liệu"
        y="người thu ghi vào sổ bao nhiêu mỗi ngày"
        ds={cua("nhap_lieu")}
        kieu="so"
        phu="Đếm theo ngày tạo bản ghi, không phải ngày tiền về — cho biết hôm nay có ai ngồi nhập hay không."
      />
    </main>
  );
}
