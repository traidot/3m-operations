import Link from "next/link";
import { Bars } from "../../wifi/bars";
import { BangNgay } from "../bang";
import {
  getBaoCaoNgayCoDinh,
  getBaoCaoNgayCoDinh30,
  getFreshness,
  type BaoCaoNgay,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

const n = (v: string | number | null) =>
  v === null ? "—" : Math.round(Number(v)).toLocaleString("vi-VN");

/** Nhãn trục: chỉ ngày, vì cả dải nằm trong một tháng. */
const nhanNgay = (iso: string) => iso.slice(8, 10);

export default async function Page() {
  const [rows, ngay30, freshness] = await Promise.all([
    getBaoCaoNgayCoDinh(),
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
    rows
      .filter((r) => r.nhom === nhom)
      .map((r) => (r.chi_so === "CHUA_GHI" ? { ...r, chi_so: "(chưa ghi tài khoản)" } : r));

  const tien = cua("tien");
  const laCoc = (r: BaoCaoNgay) => r.chi_so === "cần trừ cọc";
  const cong = (ds: BaoCaoNgay[], k: "hom_nay" | "hom_qua" | "tb_7") =>
    ds.reduce((t, r) => t + Number(r[`tien_${k}`]), 0);

  const veTk = tien.filter((r) => !laCoc(r));
  const coc = tien.filter(laCoc);
  const nhan = ngay30.map((d) => nhanNgay(d.ngay));

  return (
    <main>
      <h1>Hôm nay · wifi cố định</h1>
      <p className="muted">
        {hom_nay}. Bảng đặt số hôm nay cạnh <b>hôm qua</b> và <b>trung bình 7 ngày</b>{" "}
        trước đó; lệch từ 50% tô đỏ kể cả lệch xuống — ngày không thu được đồng nào
        cũng bất thường như ngày thu gấp đôi. Biểu đồ là <b>30 ngày gần nhất</b>, để
        thấy hình dạng cả tháng chứ không chỉ một ngày.
      </p>

      {cu.length > 0 && (
        <p className="stale">
          <b>Số dưới đây có thể đã cũ.</b> Nguồn wifi cố định chưa đồng bộ kịp:{" "}
          {cu.map((f) => f.table_name).join(", ")}.{" "}
          <Link href="/dong-bo">Xem đồng bộ →</Link>
        </p>
      )}

      <h2>
        1 · Hợp đồng mới <span className="muted">— ký rồi lắp, lắp rồi mới ra tiền</span>
      </h2>
      <p className="muted">
        Ba khâu nối nhau nên cột lệch pha là bình thường: ký hôm nay thì vài hôm sau
        mới lắp, lắp xong còn chờ tới ngày bắt đầu thu mới tính là <b>hoạt động</b> —
        phần lớn rơi vào mùng 1, nên cột đó dồn thành vài cọc cao chứ không trải đều.
      </p>
      <Bars
        nhan={nhan}
        chuoi={[
          { ten: "Ký mới", mau: "var(--muted)", gia_tri: ngay30.map((d) => Number(d.ky_moi)) },
          { ten: "Lắp xong", mau: "var(--ok)", gia_tri: ngay30.map((d) => Number(d.lap_xong)) },
          { ten: "Hoạt động", mau: "var(--lam)", gia_tri: ngay30.map((d) => Number(d.hoat_dong)) },
        ]}
      />
      <p className="muted">
        Cộng 30 ngày: <b>{n(ngay30.reduce((t, d) => t + Number(d.ky_moi), 0))}</b> ký mới ·{" "}
        <b>{n(ngay30.reduce((t, d) => t + Number(d.lap_xong), 0))}</b> lắp xong ·{" "}
        <b>{n(ngay30.reduce((t, d) => t + Number(d.hoat_dong), 0))}</b> bắt đầu thu.
      </p>

      <h2>
        2 · Hợp đồng huỷ <span className="muted">— khách dừng dịch vụ</span>
      </h2>
      <Bars
        nhan={nhan}
        chuoi={[{ ten: "Huỷ", mau: "var(--do)", gia_tri: ngay30.map((d) => Number(d.huy)) }]}
      />
      <p className="muted">
        Cộng 30 ngày: <b>{n(ngay30.reduce((t, d) => t + Number(d.huy), 0))}</b> hợp đồng huỷ,
        so với <b>{n(ngay30.reduce((t, d) => t + Number(d.ky_moi), 0))}</b> ký mới —{" "}
        ròng{" "}
        <b>
          {n(
            ngay30.reduce((t, d) => t + Number(d.ky_moi) - Number(d.huy), 0),
          )}
        </b>{" "}
        hợp đồng.
      </p>

      <h2>
        3 · Tiền hôm nay <span className="muted">— về tài khoản và cấn trừ cọc</span>
      </h2>
      <div className="the-hang gon">
        <div className="the-so">
          <div className="the-ten">Về tài khoản</div>
          <div className="the-gia-tri mono">{n(cong(veTk, "hom_nay"))}</div>
          <div className="the-phu">
            tiền thật chạy qua ngân hàng · hôm qua {n(cong(veTk, "hom_qua"))} · TB 7 ngày{" "}
            {n(cong(veTk, "tb_7"))}
          </div>
        </div>
        <div className="the-so">
          <div className="the-ten">Cấn trừ cọc</div>
          <div className="the-gia-tri mono">{n(cong(coc, "hom_nay"))}</div>
          <div className="the-phu">
            tiền khách nộp từ trước, nay trừ sang cước — không có đồng nào mới vào ngân
            hàng hôm nay
          </div>
        </div>
        <div className="the-so">
          <div className="the-ten">Tổng ghi nhận</div>
          <div className="the-gia-tri mono">{n(cong(tien, "hom_nay"))}</div>
          <div className="the-phu">cộng cả hai, đúng số trên báo cáo khoản thu</div>
        </div>
      </div>
      <BangNgay
        ten="Chia theo tài khoản"
        y="mỗi tài khoản một dòng"
        ds={tien}
        cot="tien"
        phu="Đơn vị yên. Cột “số lượt” là số đợt thu ghi nhận trong ngày."
      />

      <BangNgay
        ten="4 · Lắp đặt"
        y="lịch hẹn lắp của ngày hôm nay"
        ds={cua("lap_dat")}
        cot="so"
      />

      <BangNgay
        ten="5 · Nhập liệu"
        y="người thu đã ghi vào sổ bao nhiêu"
        ds={cua("duyet")}
        cot="so"
        phu="Đếm theo ngày tạo bản ghi, không phải ngày tiền về — cho biết hôm nay có ai ngồi nhập hay không."
      />
    </main>
  );
}
