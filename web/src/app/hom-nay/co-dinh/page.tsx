import Link from "next/link";
import { Bars } from "../../wifi/bars";
import { Bang7 } from "../bang7";
import { BangTongHop } from "../tong-hop";
import { ChiTietTien } from "../chi-tiet-tien";
import { ChiTietLapQuaHan } from "../chi-tiet-lap";
import { ChiTietHuy } from "../chi-tiet-huy";
import { ChiTietCocChoPhanBo, ChiTietGmoQuaHan } from "../chi-tiet-coc";
import { BangGmoThang } from "../gmo-thang";
import { BangCocNhom } from "../coc-nhom";
import { ChiTietChuaHoatDong } from "../chi-tiet-chua-hoat-dong";
import {
  getBaoCaoNgayCoDinh7,
  getBaoCaoNgayCoDinh30,
  getChoXuLyGmo,
  getCocChoDuyetNhom,
  getGmoThang,
  getCongNoCoDinh,
  getFreshness,
  getLapDatQuaHan,
  getTongHopNgay,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

const n = (v: string | number | null) =>
  v === null ? "—" : Math.round(Number(v)).toLocaleString("vi-VN");

const DUONG_DAN = "/hom-nay/co-dinh";

const ngayVn = (iso: string | null) =>
  iso === null ? "—" : `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function Page({ searchParams }: { searchParams: Promise<Tham> }) {
  const sp = await searchParams;
  const [ngay7, ngay30, tongHop, quaHan, congNo, cho, gmoThang, cocNhom, freshness] =
    await Promise.all([
    getBaoCaoNgayCoDinh7(),
    getBaoCaoNgayCoDinh30(),
    getTongHopNgay(),
    getLapDatQuaHan(),
    getCongNoCoDinh(),
    getChoXuLyGmo(),
    getGmoThang(),
    getCocChoDuyetNhom(),
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

  // Cột "hôm nay" trống có hai nghĩa rất khác nhau: chưa ai làm gì, hay kho
  // chưa kéo số về. Ghi luôn mốc đồng bộ gần nhất để khỏi phải đoán.
  const moc = freshness
    .filter((f) => f.source === "FIXED" && f.lan_dong_bo_cuoi !== null)
    .map((f) => new Date(f.lan_dong_bo_cuoi as Date).getTime())
    .sort((a, b) => b - a)[0];
  const dongBoLuc =
    moc === undefined
      ? null
      : new Date(moc).toLocaleString("vi-VN", {
          hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit",
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
        nào nghỉ.{" "}
        {dongBoLuc !== null && (
          <>
            Số kéo về từ nguồn lúc <b>{dongBoLuc}</b>.
          </>
        )}
      </p>

      <div className="the-hang gon">
        <div className="the-so">
          <div className="the-ten">Đang phải thu</div>
          <div className="the-gia-tri mono">{n(congNo.tien)}</div>
          <div className="the-phu">
            {n(congNo.hop_dong)} hợp đồng · {n(congNo.ky)} kỳ cước chưa thu ·{" "}
            <Link href="/thu-cuoc">xem danh sách →</Link>
          </div>
        </div>
<div className="the-so">
          <div className="the-ten">Cọc chờ duyệt</div>
          <div className="the-gia-tri mono">{n(cho.coc_tien)}</div>
          <div className="the-phu">
            khách đã trả nhưng phiếu chưa duyệt nên nợ chưa được trừ ·{" "}
            <b>{n(cho.coc_chua_thang)}</b> phiếu chưa chọn sẵn tháng cước ·{" "}
            <Link href={`${DUONG_DAN}?coc=all`} scroll={false}>
              {n(cho.coc_so)} phiếu, chờ lâu nhất {n(cho.coc_lau_nhat)} ngày →
            </Link>
          </div>
        </div>
        <div className="the-so">
          <div className="the-ten">Chưa hoạt động</div>
          <div className="the-gia-tri mono">{n(cho.chd_cuoc)}</div>
          <div className="the-phu">
            cước mỗi tháng chưa chạy vì hợp đồng lắp xong mà chưa tới ngày thu ·{" "}
            <b>{n(cho.chd_khong_ly_do)}</b> cái không ghi lý do gì ·{" "}
            <Link href={`${DUONG_DAN}?chd=1`} scroll={false}>
              {n(cho.chd_so)} hợp đồng →
            </Link>
          </div>
        </div>
        <div className="the-so">
          <div className="the-ten">Mã combini hết hạn</div>
          <div className="the-gia-tri mono">{n(cho.gmo_tien)}</div>
          <div className="the-phu">
            đã hẹn thu mà khách không ra trả; còn {n(cho.gmo_cho_so)} mã đang chờ trong
            hạn, {n(cho.gmo_cho_tien)} yên ·{" "}
            <Link href={`${DUONG_DAN}?gmo=1`} scroll={false}>
              {n(cho.gmo_so)} lần tạo mã →
            </Link>
          </div>
        </div>
      </div>

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
          { ten: "Huỷ", mau: "var(--do)", gia_tri: ngay30.map((d) => Number(d.huy)), mo: "huy" },
        ]}
        moTai={DUONG_DAN}
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
        moO={DUONG_DAN}
        phu="Ô tài khoản ghi “đã duyệt / tổng ghi nhận”: phần chênh là tiền đã đếm trên báo cáo mà kế toán chưa xác nhận, dấu ✓ là đã duyệt hết. Dòng “cần trừ cọc” là tiền khách nộp từ trước nay trừ sang cước — có ghi nhận nhưng không đồng nào vào ngân hàng, nên đứng ngoài dòng tổng. Bấm một ô để xem từng đợt thu."
      />

      <Bang7
        ten="4 · Lắp đặt"
        y="theo ngày hẹn, nên ngày mai cũng có số"
        ds={cua("lap_dat")}
        kieu="so"
        congTong={false}
        phuNut={
          Number(quaHan.don) > 0 ? (
            <>
              Ngoài bảng này còn{" "}
              <Link href={`${DUONG_DAN}?qua-han=1`} scroll={false}>
                {n(quaHan.don)} đơn đã qua ngày hẹn mà chưa lắp xong
              </Link>
              , cũ nhất hẹn từ {ngayVn(quaHan.hen_cu_nhat)} — {n(quaHan.trong_30_ngay)} trong
              số đó hẹn trong 30 ngày gần đây, phần còn lại là tồn đọng cũ.
            </>
          ) : undefined
        }
      />

      <Bang7
        ten="5 · Nhập liệu trễ"
        y="đợt thu được gõ vào máy ngày nào, tiền về ngày nào"
        ds={cua("nhap_lieu")}
        kieu="so"
        phu="Đếm theo ngày GÕ MÁY. “Gõ bù cho ngày trước” lớn nghĩa là cột tiền của mấy ngày gần đây còn thiếu và sẽ phình lên sau — đừng vội kết luận hôm nay thu kém."
      />
      <BangGmoThang ds={gmoThang} />

      <BangCocNhom ds={cocNhom} moTai={DUONG_DAN} />

      {(() => {
        // Ô được mở nằm trong URL nên F5 hay gửi link cho người khác vẫn ra
        // đúng ngăn kéo đó.
        const [kenh, ngay] = mot(sp.o).split("|");
        if (!kenh || !ngay) return null;
        return <ChiTietTien kenh={kenh} ngay={ngay} dongLai={DUONG_DAN} />;
      })()}

      {mot(sp["qua-han"]) !== "" && <ChiTietLapQuaHan dongLai={DUONG_DAN} />}
      {mot(sp.huy) !== "" && <ChiTietHuy ngay={mot(sp.huy)} dongLai={DUONG_DAN} />}
      {mot(sp.coc) !== "" && (
        <ChiTietCocChoPhanBo
          dongLai={DUONG_DAN}
          bac={mot(sp.coc) === "all" ? undefined : mot(sp.coc)}
          nhom={cocNhom.find((r) => r.bac === mot(sp.coc))?.nhom}
        />
      )}
      {mot(sp.gmo) !== "" && <ChiTietGmoQuaHan dongLai={DUONG_DAN} />}
      {mot(sp.chd) !== "" && <ChiTietChuaHoatDong dongLai={DUONG_DAN} />}
    </main>
  );
}
