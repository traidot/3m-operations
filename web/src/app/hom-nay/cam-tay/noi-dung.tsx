import Link from "next/link";
import { BangNgay } from "../bang-ngay";
import { SoSanh } from "../so-sanh";
import { BangChoMuon } from "../cho-muon";
import { ChiTietCanTru, ChiTietMayVe } from "../chi-tiet-cho-muon";
import {
  getFreshness,
  getChoMuonDangGiu,
  getChoMuonThang,
  getTelecom28Ngay,
  getTelecomDangTreo,
  getTelecomThangNay,
} from "@/lib/queries";
import { KENH_THU } from "@/lib/nhan";

const n = (v: string | number | null) =>
  v === null ? "—" : Math.round(Number(v)).toLocaleString("vi-VN");

const DUONG_DAN = "/diem-nghen?xem=hom-nay&he=cam-tay";

type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export async function NoiDungHomNayCamTay({ searchParams }: { searchParams: Promise<Tham> }) {
  const sp = await searchParams;
  const [thangNay, treo, ngay28, choMuon, choMuonGiu, freshness] = await Promise.all([
    getTelecomThangNay(),
    getTelecomDangTreo(),
    getTelecom28Ngay(),
    getChoMuonThang(),
    getChoMuonDangGiu(),
    getFreshness(),
  ]);

  const cu = freshness.filter(
    (f) =>
      f.source === "TELECOM" &&
      (f.lan_dong_bo_cuoi === null || Number(f.gio_ke_tu_lan_cuoi) > Number(f.nguong_gio)),
  );
  const moc = freshness
    .filter((f) => f.source === "TELECOM" && f.lan_dong_bo_cuoi !== null)
    .map((f) => new Date(f.lan_dong_bo_cuoi as Date).getTime())
    .sort((a, b) => b - a)[0];
  const dongBoLuc =
    moc === undefined
      ? null
      : new Date(moc).toLocaleString("vi-VN", {
          hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit",
        });

  const hom_nay = new Date().toLocaleDateString("vi-VN", {
    weekday: "long", day: "2-digit", month: "2-digit", year: "numeric",
  });
  const thang = `${thangNay.ky.slice(5, 7)}/${thangNay.ky.slice(0, 4)}`;
  const ngay = Number(thangNay.ngay_da_qua);

  // Tên kênh bên nguồn viết bằng mã; dịch ra cho dễ đọc, mã lạ thì giữ nguyên
  // chứ không giấu đi.
  const cua = (nhom: string) =>
    ngay28
      .filter((r) => r.nhom === nhom)
      .map((r) => ({ ...r, chi_so: KENH_THU[r.chi_so] ?? r.chi_so }));

  return (
    <>
      <p className="muted">
        {hom_nay}. Các bảng bày <b>28 ngày gần nhất</b>, mỗi ngày một dòng. Thứ Bảy
        và Chủ nhật tô nền khác: nhịp làm việc cuối tuần vốn thấp, không đánh dấu
        thì nhìn như ngày ế.{" "}
        {dongBoLuc !== null && (
          <>
            Số kéo về từ nguồn lúc <b>{dongBoLuc}</b>.
          </>
        )}
      </p>

      {cu.length > 0 && (
        <p className="stale">
          <b>Số dưới đây có thể đã cũ.</b> Nguồn wifi cầm tay chưa đồng bộ kịp:{" "}
          {cu.map((f) => f.table_name).join(", ")}.{" "}
          <Link href="/dong-bo">Xem đồng bộ →</Link>
        </p>
      )}

      <section>
        <h2>
          Tháng {thang} <span className="muted">— {ngay} ngày đầu tháng</span>
        </h2>
        <p className="muted">
          So với <b>{ngay} ngày đầu</b> của tháng trước chứ không phải cả tháng —
          so với cả tháng thì đầu tháng nào cũng thấy sụt.
        </p>
        <div className="the-hang">
          <div className="the-so">
            <div className="the-ten">Doanh thu</div>
            <div className="the-gia-tri mono">{n(thangNay.doanh_thu)}</div>
            <div className="the-phu">
              tiền thật về ·{" "}
              <SoSanh
                nay={Number(thangNay.doanh_thu)}
                truoc={Number(thangNay.doanh_thu_cung_ky)}
                tangLaTot
              />{" "}
              so với {n(thangNay.doanh_thu_cung_ky)} cùng kỳ
            </div>
          </div>
          <div className="the-so">
            <div className="the-ten">Thuê bao ngừng</div>
            <div className="the-gia-tri mono">{n(thangNay.ngung)}</div>
            <div className="the-phu">
              đã ngừng thật, chưa tính ngày hẹn ngừng ·{" "}
              <SoSanh
                nay={Number(thangNay.ngung)}
                truoc={Number(thangNay.ngung_cung_ky)}
                tangLaTot={false}
              />{" "}
              so với {n(thangNay.ngung_cung_ky)} cùng kỳ · {n(thangNay.moi)} kích hoạt mới
            </div>
          </div>
          <div className="the-so">
            <div className="the-ten">Cước tháng này còn đòi</div>
            <div className="the-gia-tri mono">{n(thangNay.con_doi)}</div>
            <div className="the-phu">
              {n(thangNay.hoa_don_dang_doi)} hoá đơn của tháng {thang} chưa thu xong —
              đầu tháng con số này luôn lớn vì hoá đơn vừa phát hành ·{" "}
              <Link href="/viec-hom-nay/cam-tay?tab=cong-no">xem danh sách →</Link>
            </div>
          </div>
          <div className="the-so">
            <div className="the-ten">Máy khách trả về</div>
            <div className="the-gia-tri mono">{n(thangNay.may_thu_ve)}</div>
            <div className="the-phu">
              máy nhập lại kho ·{" "}
              <SoSanh
                nay={Number(thangNay.may_thu_ve)}
                truoc={Number(thangNay.may_thu_ve_cung_ky)}
                tangLaTot
              />{" "}
              so với {n(thangNay.may_thu_ve_cung_ky)} cùng kỳ · {n(thangNay.may_giao_di)}{" "}
              máy giao đi trong tháng
            </div>
          </div>
        </div>
      </section>

      <h2>
        Đang treo <span className="muted">— tiền và việc đứng lại, không theo tháng nào</span>
      </h2>
      <div className="the-hang gon">
        <div className="the-so">
          <div className="the-ten">Đang phải thu</div>
          <div className="the-gia-tri mono">{n(treo.no_tien)}</div>
          <div className="the-phu">
            {n(treo.no_thue_bao)} thuê bao còn nợ ·{" "}
            <Link href="/viec-hom-nay/cam-tay?tab=cong-no">xem danh sách →</Link>
          </div>
        </div>
        <div className="the-so">
          <div className="the-ten">Tiền chưa gán hoá đơn</div>
          <div className="the-gia-tri mono">{n(treo.treo_tien)}</div>
          <div className="the-phu">
            {n(treo.treo_so)} lần thu đã vào tài khoản nhưng chưa trừ vào hoá đơn nào,
            nên nợ của khách vẫn chưa giảm ·{" "}
            <Link href="/cam-tay/chua-can-tru">xem danh sách →</Link>
          </div>
        </div>
        <div className="the-so">
          <div className="the-ten">Máy chưa trả</div>
          <div className="the-gia-tri mono">{n(treo.may_chua_tra)}</div>
          <div className="the-phu">
            máy đã hết hạn thuê mà khách chưa trả về kho ·{" "}
            <Link href="/tra-cuu/cam-tay?tab=may">xem danh sách →</Link>
          </div>
        </div>
      </div>

      <BangNgay
        ten="1 · Tiền về theo ngày"
        y="mỗi kênh thu một cột, đơn vị yên"
        ds={cua("tien")}
        kieu="tien"
        dauDuyet={false}
      />

      <BangNgay
        ten="2 · Hoá đơn phát hành"
        y="theo ngày phát hành, đơn vị yên"
        ds={cua("hoa_don")}
        kieu="tien"
        dauDuyet={false}
        phu="Đây là tiền ĐÁNG LẼ phải thu của ngày phát hành, khác với bảng trên vốn đếm theo ngày tiền về. Hai bảng không cộng trừ được với nhau."
      />

      <BangNgay
        ten="3 · Thuê bao vào và ra"
        y="kích hoạt mới và ngừng trong ngày"
        ds={cua("thue_bao")}
        kieu="so"
        phu="Cột “ngừng” chỉ đếm thuê bao ĐÃ ngừng. Bên nguồn còn ghi sẵn ngày hẹn ngừng ở tương lai — hiện có 1.101 thuê bao hẹn 31/10 — nếu đếm cả thì con số hôm nay phồng lên nhiều lần."
      />

      <BangNgay
        ten="4 · Máy ra khỏi kho"
        y="theo ngày chứng từ, tách theo lý do"
        ds={cua("kho_ra")}
        kieu="so"
      />

      <BangNgay
        ten="5 · Máy vào kho"
        y="theo ngày chứng từ, tách theo lý do"
        ds={cua("kho_vao")}
        kieu="so"
      />

      <BangChoMuon ds={choMuon} giu={choMuonGiu} so={6} moTai={DUONG_DAN} />
      {(() => {
        // "<tháng>.may" hoặc "<tháng>.coc" — hai đầu của cùng một việc.
        const [ky, loai] = mot(sp.muon).split(".");
        if (!ky || loai === undefined) return null;
        return loai === "may" ? (
          <ChiTietMayVe ky={ky} dongLai={DUONG_DAN} />
        ) : (
          <ChiTietCanTru ky={ky} dongLai={DUONG_DAN} />
        );
      })()}
    </>
  );
}
