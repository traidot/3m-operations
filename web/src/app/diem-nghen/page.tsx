import Link from "next/link";
import { ChiTietTram } from "./chi-tiet-tram";
import { NoiDungHomNayChung } from "../hom-nay/noi-dung";
import { NoiDungHomNayCoDinh } from "../hom-nay/co-dinh/noi-dung";
import { NoiDungHomNayCamTay } from "../hom-nay/cam-tay/noi-dung";
import { NoiDungThang } from "../thang/noi-dung";
import { NoiDungLapDat } from "../lap-dat/noi-dung";
import { NoiDungHuy } from "../cam-tay/huy/noi-dung";
import { NoiDungVongDoi } from "../cam-tay/vong-doi/noi-dung";
import { getTramVanHanh, type TramVanHanh } from "@/lib/queries";
import {
  NGHEN_NGAY,
  NGHEN_TOI_THIEU,
  NGHEN_TUAN,
  NGHEN_TY_LE,
  TEN_HE,
  TRAM_VAN_HANH,
} from "@/lib/nhan";

export const dynamic = "force-dynamic";

const n = (v: string | number | null) =>
  v === null ? "—" : Math.round(Number(v)).toLocaleString("vi-VN");

/** Bao nhiêu tuần nữa mới dọn hết, với tốc độ hiện tại. */
const tuanDon = (r: TramVanHanh) =>
  r.ra_moi_tuan === null || r.ra_moi_tuan <= 0
    ? null
    : Math.round((r.ton / r.ra_moi_tuan) * 10) / 10;

/**
 * Hai kiểu nghẽn khác hẳn nhau:
 *
 * - "thiếu người": guồng không đủ sức, tồn chia tốc độ ra một con số lớn.
 * - "bỏ quên": guồng thừa sức nhưng không làm theo thứ tự, nên tồn thấp mà
 *   vẫn có cái nằm rất lâu.
 *
 * Trả null khi chưa đủ dữ liệu để kết luận.
 */
function kieuNghen(r: TramVanHanh): "thieu_nguoi" | "bo_quen" | null {
  const t = tuanDon(r);
  if (t !== null && t >= NGHEN_TUAN) return "thieu_nguoi";
  // Đếm số cái nằm lâu chứ không lấy cái già nhất: một ngoại lệ duy nhất
  // không làm trạm thành bỏ quên, nếu không thì gần hết bảng đều đỏ.
  const lau = r.qua_lau ?? 0;
  if (lau >= NGHEN_TOI_THIEU && lau / r.ton >= NGHEN_TY_LE) return "bo_quen";
  return null;
}

const NHAN_NGHEN = {
  thieu_nguoi: { ten: "thiếu người", lop: "critical" },
  bo_quen: { ten: "bỏ quên", lop: "warn" },
} as const;

/**
 * Bản đồ trạm vận hành — việc đang nằm ở đâu, và trạm nào đang tắc.
 *
 * Màn này xếp theo DÒNG CHẢY chứ không theo mức nghẽn: phải thấy hình dạng
 * dây chuyền trước thì mới hiểu được chỗ tắc nằm ở khúc nào.
 */
type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? "";

const DUONG_DAN = "/diem-nghen";

/**
 * Hai góc nhìn vào cùng một dây chuyền.
 *
 * "Bản đồ trạm" đo thứ ĐANG NẰM LẠI — tồn, tuổi, bao lâu mới dọn hết.
 * "Hôm nay" đo thứ VỪA CHẢY QUA trong ngày, so với hôm qua và trung bình 7
 * ngày. Hai cách nhìn khác nhau hẳn: một trạm có thể sạch trong ngày mà vẫn
 * tồn hàng trăm cái từ trước, và ngược lại.
 */
const XEM = [
  { ma: "tram", ten: "Bản đồ trạm" },
  { ma: "hom-nay", ten: "Hôm nay" },
  { ma: "dong-chay", ten: "Dòng chảy theo tháng" },
] as const;

/** Dòng chảy không có bản "cả hai mảng": hai hệ đo bằng đơn vị khác nhau —
 *  cố định đếm hợp đồng và đơn lắp, cầm tay đếm thuê bao và máy. */
const HE_THANG = [
  { ma: "co-dinh", ten: "Wifi cố định" },
  { ma: "cam-tay", ten: "Wifi cầm tay" },
] as const;

const HE_NGAY = [
  { ma: "chung", ten: "Cả hai mảng" },
  { ma: "co-dinh", ten: "Wifi cố định" },
  { ma: "cam-tay", ten: "Wifi cầm tay" },
] as const;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Tham>;
}) {
  const [rows, sp] = await Promise.all([getTramVanHanh(), searchParams]);
  const biet = (r: TramVanHanh) => TRAM_VAN_HANH[r.ma];
  const moTram = mot(sp.mo);
  const xem = XEM.some((x) => x.ma === mot(sp.xem)) ? mot(sp.xem) : "tram";
  const heNgay = HE_NGAY.some((h) => h.ma === mot(sp.he))
    ? mot(sp.he)
    : "chung";
  const heThang = HE_THANG.some((h) => h.ma === mot(sp.he))
    ? mot(sp.he)
    : "co-dinh";

  // Trạm có trong view mà chưa khai nhãn thì vẫn phải lộ ra.
  const laDu = rows.filter((r) => biet(r) === undefined);

  const cua = (he: string) =>
    rows
      .filter((r) => biet(r)?.he === he)
      .sort((a, b) => biet(a)!.thu_tu - biet(b)!.thu_tu);

  const nghen = rows.filter((r) => kieuNghen(r) !== null);

  return (
    <main>
      <h1>Điểm nghẽn</h1>

      <div className="nhom-loc">
        <div className="muted nhan-nhom">Nhìn theo</div>
        <p className="actions">
          {XEM.map((x) => (
            <Link key={x.ma} href={`${DUONG_DAN}?xem=${x.ma}`}>
              <button
                type="button"
                className={xem === x.ma ? "primary" : undefined}
              >
                {x.ten}
              </button>
            </Link>
          ))}
        </p>
      </div>

      {xem === "hom-nay" && (
        <>
          <div className="nhom-loc">
            <div className="muted nhan-nhom">Mảng</div>
            <p className="actions">
              {HE_NGAY.map((h) => (
                <Link key={h.ma} href={`${DUONG_DAN}?xem=hom-nay&he=${h.ma}`}>
                  <button
                    type="button"
                    className={heNgay === h.ma ? "primary" : undefined}
                  >
                    {h.ten}
                  </button>
                </Link>
              ))}
            </p>
          </div>
          {heNgay === "chung" && <NoiDungHomNayChung />}
          {heNgay === "co-dinh" && (
            <NoiDungHomNayCoDinh searchParams={Promise.resolve(sp)} />
          )}
          {heNgay === "cam-tay" && (
            <NoiDungHomNayCamTay searchParams={Promise.resolve(sp)} />
          )}
        </>
      )}

      {xem === "dong-chay" && (
        <>
          <div className="nhom-loc">
            <div className="muted nhan-nhom">Mảng</div>
            <p className="actions">
              {HE_THANG.map((h) => (
                <Link key={h.ma} href={`${DUONG_DAN}?xem=dong-chay&he=${h.ma}`}>
                  <button
                    type="button"
                    className={heThang === h.ma ? "primary" : undefined}
                  >
                    {h.ten}
                  </button>
                </Link>
              ))}
            </p>
          </div>
          <p className="muted">
            Vào và ra của dây chuyền theo tháng — bản đồ trạm cho biết đang tồn
            bao nhiêu, phần này cho biết tốc độ nạp vào và thoát ra. Xếp theo
            <b> lứa ký</b>, nên hợp đồng ký tháng 3 huỷ tháng 7 vẫn nằm ở dòng
            tháng 3.
          </p>
          {heThang === "co-dinh" ? (
            <>
              <NoiDungThang searchParams={Promise.resolve(sp)} />
              <NoiDungLapDat searchParams={Promise.resolve(sp)} />
            </>
          ) : (
            <>
              <NoiDungHuy searchParams={Promise.resolve(sp)} />
              <NoiDungVongDoi searchParams={Promise.resolve(sp)} />
            </>
          )}
        </>
      )}

      {xem === "tram" && (
        <>
          <p className="muted">
            Việc đang nằm ở đâu trên dây chuyền, và chỗ nào tắc.{" "}
            {nghen.length === 0 ? (
              <b>Hiện không trạm nào tắc.</b>
            ) : (
              <>
                <b>{nghen.length} trạm đang tắc.</b>
              </>
            )}{" "}
            Xếp theo thứ tự việc chảy qua, không theo mức nghẽn — phải thấy hình
            dạng dây chuyền trước thì mới hiểu chỗ tắc nằm ở khúc nào.
          </p>
          <p className="muted">
            Cột quyết định là <b>tuần để dọn</b> = tồn ÷ ra mỗi tuần, không phải
            cột tồn. Hai trạm cùng tồn vài trăm việc có thể một bên dọn hết
            trong nửa tuần còn bên kia mất cả năm, tuỳ guồng chạy nhanh hay
            chậm. Xếp hạng theo số tồn là xếp sai.
          </p>
          <p className="muted">
            Có <b>hai kiểu tắc</b>, đọc bằng hai cột khác nhau.{" "}
            <span className="tag critical">thiếu người</span> là tồn ÷ ra từ{" "}
            {NGHEN_TUAN} tuần trở lên — guồng không đủ sức, càng ngày càng dày.{" "}
            <span className="tag warn">bỏ quên</span> là guồng thừa sức nhưng từ{" "}
            {Math.round(NGHEN_TY_LE * 100)}% số việc trở lên đã nằm quá{" "}
            {NGHEN_NGAY} ngày — không làm theo thứ tự. Đếm số cái nằm lâu chứ
            không lấy cái già nhất: một ngoại lệ duy nhất không đủ gọi là tắc.
            Cột <b>ra mỗi tuần</b> để trống nghĩa là nguồn không ghi mốc hoàn
            thành nên chưa đo được, <b>không phải</b> guồng đứng im.
          </p>

          {laDu.length > 0 && (
            <p className="tag critical">
              {laDu.length} trạm chưa có nhãn ở nhan.ts:{" "}
              {laDu.map((r) => r.ma).join(", ")}
            </p>
          )}

          {["co_dinh", "cam_tay"].map((he) => {
            const ds = cua(he);
            if (ds.length === 0) return null;

            return (
              <section key={he}>
                <h2 className="dau-he">{TEN_HE[he] ?? he}</h2>
                <div className="scroller">
                  <table>
                    <thead>
                      <tr>
                        <th>Trạm</th>
                        <th className="num">Đang nằm</th>
                        <th className="num">Ra mỗi tuần</th>
                        <th className="num">Tuần để dọn</th>
                        <th className="num">Quá {NGHEN_NGAY} ngày</th>
                        <th className="num">Tiền</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {ds.map((r) => {
                        const b = biet(r)!;
                        const t = tuanDon(r);
                        const k = kieuNghen(r);
                        return (
                          <tr key={r.ma}>
                            <td>
                              <Link
                                href={`${DUONG_DAN}?mo=${r.ma}`}
                                scroll={false}
                                className="o-mo"
                              >
                                <b>{b.ten}</b>
                              </Link>
                              {k !== null && (
                                <>
                                  {" "}
                                  <span className={`tag ${NHAN_NGHEN[k].lop}`}>
                                    {NHAN_NGHEN[k].ten}
                                  </span>
                                </>
                              )}
                              <div className="muted">{b.y}</div>
                            </td>
                            <td className="num mono">
                              <b>{n(r.ton)}</b>
                            </td>
                            <td className="num mono muted">
                              {r.ra_moi_tuan === null ? (
                                <span title="nguồn không ghi mốc hoàn thành">
                                  chưa đo được
                                </span>
                              ) : (
                                n(r.ra_moi_tuan)
                              )}
                            </td>
                            <td
                              className={`num mono${
                                k === "thieu_nguoi"
                                  ? " bad"
                                  : t === null
                                    ? " muted"
                                    : ""
                              }`}
                            >
                              {t === null ? "—" : <b>{t} tuần</b>}
                            </td>
                            <td
                              className={`num mono${k === "bo_quen" ? " bad" : " muted"}`}
                              title={
                                r.gia_nhat === null
                                  ? undefined
                                  : `già nhất ${n(r.gia_nhat)} ngày`
                              }
                            >
                              {r.qua_lau === null
                                ? "—"
                                : r.qua_lau === 0
                                  ? "không cái nào"
                                  : `${n(r.qua_lau)} / ${n(r.ton)}`}
                            </td>
                            <td className="num mono">
                              {r.tien === null ? (
                                <span className="muted">—</span>
                              ) : (
                                n(r.tien)
                              )}
                            </td>
                            <td className="khong-xuong-dong">
                              <Link
                                href={`${DUONG_DAN}?mo=${r.ma}`}
                                scroll={false}
                              >
                                xem →
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </>
      )}

      {(() => {
        if (xem !== "tram") return null;
        const r = rows.find((x) => x.ma === moTram);
        if (r === undefined) return null;
        return (
          <ChiTietTram
            tram={r.ma}
            ton={r.ton}
            quaLau={r.qua_lau}
            tien={r.tien}
            dongLai={DUONG_DAN}
          />
        );
      })()}
    </main>
  );
}
