import Link from "next/link";
import { Bars } from "../../wifi/bars";
import { BangNgay } from "../bang-ngay";
import { BangTongHop } from "../tong-hop";
import { ChiTietTien } from "../chi-tiet-tien";
import { ChiTietLapQuaHan } from "../chi-tiet-lap";
import { ChiTietHuy } from "../chi-tiet-huy";
import { ChiTietCocChoPhanBo, ChiTietGmoQuaHan } from "../chi-tiet-coc";
import { BangGmoThang } from "../gmo-thang";
import { BangCocNhom } from "../coc-nhom";
import { TheThang } from "../the-thang";
import { BangChoMuon } from "../cho-muon";
import { ChiTietCanTru, ChiTietMayVe } from "../chi-tiet-cho-muon";
import { ChiTietChuaHoatDong } from "../chi-tiet-chua-hoat-dong";
import {
  getBaoCao28NgayCoDinh,
  getBaoCaoNgayCoDinh30,
  getChoXuLyGmo,
  getCocChoDuyetO,
  getCocChoDuyetNhom,
  getLinkCms,
  getGmoCocMo,
  getGmoThangLoai,
  getGmoThang,
  getCongNoCoDinh,
  getFreshness,
  getLapDatQuaHan,
  getChoMuonDangGiu,
  getChoMuonThang,
  getThangNay,
  getTongHop28,
} from "@/lib/queries";

const n = (v: string | number | null) =>
  v === null ? "—" : Math.round(Number(v)).toLocaleString("vi-VN");

const DUONG_DAN = "/diem-nghen?xem=hom-nay&he=co-dinh";

const ngayVn = (iso: string | null) =>
  iso === null ? "—" : `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export async function NoiDungHomNayCoDinh({ searchParams }: { searchParams: Promise<Tham> }) {
  const sp = await searchParams;
  const [ngay7, ngay30, tongHop, thangNay, choMuon, choMuonGiu, quaHan, congNo, cho, gmoThang, gmoO, cocMo, cocNhom, cocO, linkDuyet, freshness] =
    await Promise.all([
    getBaoCao28NgayCoDinh(),
    getBaoCaoNgayCoDinh30(),
    getTongHop28(),
    getThangNay(),
    getChoMuonThang(),
    getChoMuonDangGiu(),
    getLapDatQuaHan(),
    getCongNoCoDinh(),
    getChoXuLyGmo(),
    getGmoThang(),
    getGmoThangLoai(),
    getGmoCocMo(),
    getCocChoDuyetNhom(),
    getCocChoDuyetO(),
    getLinkCms("fixed_cms_deposit_url"),
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
    <>
      <p className="muted">
        {hom_nay}. Biểu đồ là <b>30 ngày gần nhất</b> để thấy hình dạng cả tháng;
        các bảng bày <b>28 ngày gần nhất</b>, mỗi ngày một cột. Thứ Bảy và Chủ
        nhật tô nền khác: nhịp làm việc cuối tuần vốn thấp, không đánh dấu thì
        nhìn như ngày ế.{" "}
        {dongBoLuc !== null && (
          <>
            Số kéo về từ nguồn lúc <b>{dongBoLuc}</b>.
          </>
        )}
      </p>

      <TheThang t={thangNay} moTai={DUONG_DAN} />

      <h2>
        Đang treo <span className="muted">— tiền và việc đứng lại, không theo tháng nào</span>
      </h2>
      <div className="the-hang gon">
        <div className="the-so">
          <div className="the-ten">Đang phải thu</div>
          <div className="the-gia-tri mono">{n(congNo.tien)}</div>
          <div className="the-phu">
            {n(congNo.hop_dong)} hợp đồng · {n(congNo.ky)} kỳ cước chưa thu ·{" "}
            <Link href="/viec-hom-nay/co-dinh?tab=cong-no">xem danh sách →</Link>
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
            nợ còn lại của {n(cho.gmo_con_no)} hợp đồng từng có mã hết hạn — số còn lại
            đã thu được bằng đường khác · {n(cho.gmo_lau_nhat)} lần hẹn thu hỏng trên{" "}
            {n(cho.gmo_so)} hợp đồng ·{" "}
            <Link href={`${DUONG_DAN}?gmo=1`} scroll={false}>
              xem danh sách →
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

      <BangNgay
        ten="3 · Tiền về theo ngày"
        y="mỗi tài khoản một cột, đơn vị yên"
        ds={cua("tien")}
        kieu="tien"
        moO={DUONG_DAN}
        phu="Ô tài khoản ghi “đã duyệt / tổng ghi nhận”: phần chênh là tiền đã đếm trên báo cáo mà kế toán chưa xác nhận, dấu ✓ là đã duyệt hết. Bấm một ô để xem từng đợt thu của ngày đó."
      />

      <BangNgay
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

      <BangNgay
        ten="5 · Nhập liệu trễ"
        y="đợt thu được gõ vào máy ngày nào, tiền về ngày nào"
        ds={cua("nhap_lieu")}
        kieu="so"
        phu="Đếm theo ngày GÕ MÁY. “Gõ bù cho ngày trước” lớn nghĩa là cột tiền của mấy ngày gần đây còn thiếu và sẽ phình lên sau — đừng vội kết luận hôm nay thu kém."
      />
      <BangCocNhom ds={cocNhom} o={cocO} moTai={DUONG_DAN} linkDuyet={linkDuyet} />

      <BangGmoThang ds={gmoThang} o={gmoO} cocMo={cocMo} />

      <BangChoMuon ds={choMuon} giu={choMuonGiu} so={8} moTai={DUONG_DAN} />

      {(() => {
        // Ô được mở nằm trong URL nên F5 hay gửi link cho người khác vẫn ra
        // đúng ngăn kéo đó.
        const [kenh, ngay] = mot(sp.o).split("|");
        if (!kenh || !ngay) return null;
        return <ChiTietTien kenh={kenh} ngay={ngay} dongLai={DUONG_DAN} />;
      })()}

      {(() => {
        const [ky, loai] = mot(sp.muon).split(".");
        if (!ky || loai === undefined) return null;
        return loai === "may" ? (
          <ChiTietMayVe ky={ky} dongLai={DUONG_DAN} />
        ) : (
          <ChiTietCanTru ky={ky} dongLai={DUONG_DAN} />
        );
      })()}

      {mot(sp["qua-han"]) !== "" && <ChiTietLapQuaHan dongLai={DUONG_DAN} />}
      {mot(sp.huy) !== "" && <ChiTietHuy ngay={mot(sp.huy)} dongLai={DUONG_DAN} />}
      {mot(sp.coc) !== "" &&
        (() => {
          // "l-<mã>" là lọc theo thứ đang thu, số trần là bậc tuổi chờ,
          // "all" là mọi phiếu.
          // "all" = mọi phiếu, "<bậc>" = một nhóm tuổi chờ,
          // "<bậc>.<loại>" = một ô của bảng.
          const v = mot(sp.coc);
          const [b, l] = v === "all" ? [undefined, undefined] : v.split(".");
          const tenBac = cocNhom.find((r) => r.bac === b)?.nhom;
          const tenLoai = cocO.find((r) => r.nhom_tien === l)?.ten;
          return (
            <ChiTietCocChoPhanBo
              dongLai={DUONG_DAN}
              bac={b}
              loai={l}
              nhom={[tenBac, tenLoai].filter(Boolean).join(" · ") || undefined}
            />
          );
        })()}
      {mot(sp.gmo) !== "" && <ChiTietGmoQuaHan dongLai={DUONG_DAN} />}
      {mot(sp.chd) !== "" && <ChiTietChuaHoatDong dongLai={DUONG_DAN} />}
    </>
  );
}
