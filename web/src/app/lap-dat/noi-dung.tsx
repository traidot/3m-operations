import Link from "next/link";
import { Dong } from "../hop-dong/dong";
import { ChiTietThangKy, NHOM_LAP, type NhomLap } from "./chi-tiet";
import { ChiTietChoLap } from "./cho-lap";
import {
  getInstallMonths,
  getInstallPending,
  type InstallMonth,
  type InstallPending,
} from "@/lib/queries";
import { them } from "../duong-dan";

const n = (v: number) => v.toLocaleString("vi-VN");

type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const cong = (rows: { [k: string]: unknown }[], cot: string) =>
  rows.reduce((s, r) => s + Number(r[cot] ?? 0), 0);

const PHU_TRACH_LOC: Record<string, string> = {
  CONG_TY: "công ty",
  DAI_LY: "đại lý",
};

/** Từ nhóm này trở đi là chờ quá hai tháng — quá mốc p90 của toàn hệ thống. */
const NHOM_QUA_HAN = "04";

export async function NoiDungLapDat({ searchParams }: { searchParams: Promise<Tham> }) {
  const sp = await searchParams;
  const [thangAll, choAll] = await Promise.all([getInstallMonths(), getInstallPending()]);

  const pt = mot(sp.pt) in PHU_TRACH_LOC ? mot(sp.pt) : "";
  const hop = <T extends { do_cong_ty: boolean }>(rows: T[]) =>
    pt === "" ? rows : rows.filter((r) => r.do_cong_ty === (pt === "CONG_TY"));
  const thang = hop(thangAll);
  const cho = hop(choAll);

  const moThang = /^\d{4}-\d{2}$/.test(mot(sp.thang)) ? mot(sp.thang) : "";
  const nhomCho = [...new Set(cho.map((r) => r.ma_nhom))].sort();
  const moCho = nhomCho.includes(mot(sp.cho)) ? mot(sp.cho) : "";
  const moNhom: NhomLap = Object.hasOwn(NHOM_LAP, mot(sp.nhom))
    ? (mot(sp.nhom) as NhomLap)
    : "chua_lap";

  const link = (t: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(t)) if (v) p.set(k, v);
    const duoi = p.toString();
    return duoi ? them("/diem-nghen?xem=dong-chay&he=co-dinh", duoi) : "/diem-nghen?xem=dong-chay&he=co-dinh";
  };

  const cacKy = [...new Set(thang.map((r) => r.ky_ky))];
  const choQuaHan = cong(
    cho.filter((r) => r.ma_nhom >= NHOM_QUA_HAN),
    "so_don",
  );

  // Trung vị của toàn hệ thống chứ không phải trung bình các trung vị: lấy tháng
  // gần nhất có đủ dữ liệu để khỏi bị tháng mới ký kéo lệch.
  const thangDu = thang.filter((r) => Number(r.lap_xong) >= 20 && r.ngay_trung_vi !== null);
  const ngayTieuBieu = thangDu.length
    ? Math.round(cong(thangDu, "ngay_trung_vi") / thangDu.length)
    : null;

  const tong = (cot: keyof InstallMonth) => cong(thang, cot);
  const tyLe = (phan: number) => Math.round((1000 * phan) / (tong("so_don") || 1)) / 10;

  const tenNhom = (ma: string) => cho.find((r) => r.ma_nhom === ma)?.ten_nhom ?? ma;

  return (
    <>
      <p className="muted">
        Chia đơn đúng bảy tình huống của báo cáo tổng hợp bên CMS, gom theo <b>tháng ký</b> chứ
        không theo tháng lắp — đơn ký tháng 3 huỷ tháng 7 vẫn nằm ở dòng tháng 3. Bấm vào một dòng
        để xem danh sách đơn.
      </p>

      <p className="actions">
        <Link href={link({ thang: moThang || undefined, nhom: moThang ? moNhom : undefined })}>
          <button type="button" className={pt === "" ? "primary" : undefined}>
            Cả hai
          </button>
        </Link>
        {Object.entries(PHU_TRACH_LOC).map(([ma, ten]) => (
          <Link
            key={ma}
            href={link({ pt: ma, thang: moThang || undefined, nhom: moThang ? moNhom : undefined })}
          >
            <button type="button" className={pt === ma ? "primary" : undefined}>
              {ten}
            </button>
          </Link>
        ))}
      </p>

      <div className="the-hang">
        <div className="the-so">
          <div className="the-ten">Đang chờ lắp</div>
          <div className="the-gia-tri">{n(cong(cho, "so_don"))}</div>
          <div className="the-phu">
            {n(cong(cho.filter((r) => !r.co_lich), "so_don"))} đơn chưa có lịch ·{" "}
            {n(choQuaHan)} đơn quá 2 tháng
          </div>
        </div>
        <div className="the-so">
          <div className="the-ten">Lắp đặt thành công</div>
          <div className="the-gia-tri">{n(tong("lap_xong"))}</div>
          <div className="the-phu">{tyLe(tong("lap_xong"))}% số đơn đã ký</div>
        </div>
        <div className="the-so">
          <div className="the-ten">Tổng huỷ</div>
          <div className="the-gia-tri">{n(tong("huy"))}</div>
          <div className="the-phu">
            {tyLe(tong("huy"))}% · {n(tong("huy_truoc_lich"))} trước lịch ·{" "}
            {n(tong("huy_sau_lich"))} sau lịch · {n(tong("huy_sau_lap"))} sau lắp
          </div>
        </div>
        <div className="the-so">
          <div className="the-ten">Ký đến lắp xong</div>
          <div className="the-gia-tri">{ngayTieuBieu ?? "—"}</div>
          <div className="the-phu">ngày, trung vị các tháng đã xong</div>
        </div>
      </div>

      <h2>Đơn đang chờ lắp</h2>
      <p className="muted">
        Đơn đã ký, chưa lắp xong và chưa huỷ. “Chưa có lịch” là chưa hẹn được ngày lắp — đó là
        phần phải gọi khách trước.
      </p>
      <div className="scroller">
        <table className="bang-thang">
          <thead>
            <tr>
              <th>Đã chờ</th>
              <th className="num" title="Chưa hẹn được ngày lắp">
                Chưa có lịch
              </th>
              <th className="num">Có lịch</th>
              <th className="num">Tổng</th>
              <th>Đơn cũ nhất ký ngày</th>
            </tr>
          </thead>
          <tbody>
            {nhomCho.map((ma) => {
              const r = cho.filter((x) => x.ma_nhom === ma);
              const qua = ma >= NHOM_QUA_HAN;
              return (
                <Dong key={ma} href={link({ pt: pt || undefined, cho: ma })} dangMo={moCho === ma}>
                  <td>{tenNhom(ma)}</td>
                  <td className="num mono">
                    {n(cong(r.filter((x) => !x.co_lich), "so_don"))}
                  </td>
                  <td className="num mono muted">
                    {n(cong(r.filter((x) => x.co_lich), "so_don"))}
                  </td>
                  <td className={`num mono${qua ? " bad" : ""}`}>{n(cong(r, "so_don"))}</td>
                  <td className="mono muted">
                    {r.map((x) => x.ky_som_nhat).filter(Boolean).sort()[0] ?? "—"}
                  </td>
                </Dong>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>Theo tháng ký</h2>
      <div className="scroller">
        <table className="bang-thang">
          <thead>
            <tr>
              <th rowSpan={2}>Tháng ký</th>
              <th colSpan={3} className="nhom">
                Đăng ký
              </th>
              <th colSpan={5} className="nhom">
                Huỷ
              </th>
              <th rowSpan={2} className="num" title="Đăng ký trừ đi huỷ">
                Còn lại
              </th>
              <th colSpan={2} className="nhom">
                Chưa lắp
              </th>
              <th rowSpan={2} className="num">
                Lắp xong
              </th>
              <th rowSpan={2} className="num">
                Thất bại
              </th>
              <th rowSpan={2} className="num" title="Số ngày từ ký tới lắp xong, lấy trung vị">
                Ngày chờ
              </th>
            </tr>
            <tr>
              <th className="num">Lần đầu</th>
              <th className="num">Đăng ký lại</th>
              <th className="num">Tổng</th>
              <th className="num">Trước lịch</th>
              <th className="num">Sau lịch</th>
              <th className="num" title="Lắp xong rồi hợp đồng mới huỷ">
                Sau lắp
              </th>
              <th className="num">Tổng</th>
              <th>Tỉ lệ</th>
              <th className="num">Có lịch</th>
              <th className="num">Chưa có lịch</th>
            </tr>
          </thead>
          <tbody>
            {cacKy.map((ky) => {
              const r = thang.filter((x) => x.ky_ky === ky);
              const dk = cong(r, "so_don");
              const huy = cong(r, "huy");
              const ty = Math.round((1000 * huy) / (dk || 1)) / 10;
              const ngay = r
                .map((x) => x.ngay_trung_vi)
                .filter((v): v is string => v !== null)
                .map(Number);
              return (
                <Dong
                  key={ky}
                  href={link({ pt: pt || undefined, thang: ky })}
                  dangMo={moThang === ky}
                >
                  <td className="mono">{ky}</td>
                  <td className="num mono">{n(cong(r, "dang_ky_lan_dau"))}</td>
                  <td className="num mono muted">{n(cong(r, "dang_ky_lai"))}</td>
                  <td className="num mono">{n(dk)}</td>
                  <td className="num mono muted">{n(cong(r, "huy_truoc_lich"))}</td>
                  <td className="num mono muted">{n(cong(r, "huy_sau_lich"))}</td>
                  <td className="num mono muted">{n(cong(r, "huy_sau_lap"))}</td>
                  <td className="num mono">{n(huy)}</td>
                  <td>
                    <span className="bar">
                      <span
                        className="bar-fill xau"
                        style={{ width: `${Math.min(ty, 100)}%` }}
                      />
                      <span className="bar-label mono">{ty}%</span>
                    </span>
                  </td>
                  <td className="num mono">{n(cong(r, "con_lai"))}</td>
                  <td className="num mono muted">{n(cong(r, "co_lich"))}</td>
                  <td className="num mono">{n(cong(r, "chua_co_lich"))}</td>
                  <td className="num mono">{n(cong(r, "lap_xong"))}</td>
                  <td className="num mono muted">{n(cong(r, "lap_hong"))}</td>
                  <td className="num mono">
                    {ngay.length ? Math.round(ngay.reduce((a, b) => a + b, 0) / ngay.length) : "—"}
                  </td>
                </Dong>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="muted khoi-ghi-chu">
        Tháng ký gần đây luôn có tỉ lệ lắp thấp và cột “chưa lắp” cao — đơn mới ký chưa kịp lắp,
        không phải hỏng. Đọc kết quả từ những tháng đã đủ thời gian, và so cột “chưa lắp” với số
        ngày chờ trung vị của chính tháng đó.
      </p>

      {moCho && (
        <ChiTietChoLap
          nhom={moCho}
          tenNhom={tenNhom(moCho)}
          phuTrach={pt}
          dongLai={link({ pt: pt || undefined })}
        />
      )}

      {moThang && (
        <ChiTietThangKy
          ky={moThang}
          nhom={moNhom}
          dongLai={link({ pt: pt || undefined })}
          linkNhom={(k) => link({ pt: pt || undefined, thang: moThang, nhom: k })}
        />
      )}
    </>
  );
}
