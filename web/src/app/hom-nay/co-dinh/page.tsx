import Link from "next/link";
import { BangNgay } from "../bang";
import { getBaoCaoNgayCoDinh, getFreshness } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [rows, freshness] = await Promise.all([getBaoCaoNgayCoDinh(), getFreshness()]);

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
    rows
      .filter((r) => r.nhom === nhom)
      .map((r) => (r.chi_so === "CHUA_GHI" ? { ...r, chi_so: "(chưa ghi tài khoản)" } : r));

  return (
    <main>
      <h1>Hôm nay · wifi cố định</h1>
      <p className="muted">
        {hom_nay}. Mỗi dòng là chuyện xảy ra trong ngày, đặt cạnh <b>hôm qua</b> và{" "}
        <b>trung bình 7 ngày</b> trước đó. Cột lệch so với trung bình; từ 50% trở lên
        tô đỏ kể cả lệch xuống — ngày không thu được đồng nào cũng bất thường như ngày
        thu gấp đôi. Nền dưới 1 thì bỏ trống cột lệch, không thì chia cho số gần 0 ra
        vài nghìn phần trăm.
      </p>

      {cu.length > 0 && (
        <p className="stale">
          <b>Số dưới đây có thể đã cũ.</b> Nguồn wifi cố định chưa đồng bộ kịp:{" "}
          {cu.map((f) => f.table_name).join(", ")}.{" "}
          <Link href="/dong-bo">Xem đồng bộ →</Link>
        </p>
      )}

      <BangNgay
        ten="Tiền vào hôm nay"
        y="đợt thu đã ghi nhận, tách theo tài khoản"
        ds={cua("tien")}
        cot="tien"
        phu="Đơn vị yên. “Cần trừ cọc” là tiền khách đã nộp từ trước, nay trừ sang cước — không có đồng nào mới chạy qua ngân hàng hôm nay."
      />

      <BangNgay
        ten="Hợp đồng"
        y="ký mới, lắp xong, huỷ trong ngày"
        ds={cua("hop_dong")}
        cot="so"
      />

      <BangNgay
        ten="Lắp đặt"
        y="lịch hẹn lắp của ngày hôm nay"
        ds={cua("lap_dat")}
        cot="so"
      />

      <BangNgay
        ten="Nhập liệu"
        y="người thu đã ghi vào sổ bao nhiêu"
        ds={cua("duyet")}
        cot="so"
        phu="Đếm theo ngày tạo bản ghi, không phải ngày tiền về — cho biết hôm nay có ai ngồi nhập hay không."
      />
    </main>
  );
}
