import Link from "next/link";
import { ChiTietNhom } from "../kho/chi-tiet";
import { ChiTietThueBao } from "./thue-bao";
import {
  getKhoMa,
  getThueBaoNo,
  type KhoMa,
  type ThueBaoNo,
} from "@/lib/queries";
import { LOAI_KHACH, MAU_LOAI_KHACH, MAU_NHOM_TB, NHOM_TB } from "@/lib/nhan";
import { them } from "../../duong-dan";

// Làm tròn khi in: hoá đơn bên nguồn có phần lẻ, cộng lại thành 2.918.161,67
// đọc ra như số đo chứ không như tiền.
const n = (v: string | number | null) =>
  v === null ? "—" : Math.round(Number(v)).toLocaleString("vi-VN");

type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? "";

/**
 * Năm khâu của vòng đời một cái máy. Mỗi khâu rò một kiểu khác nhau nên phải
 * nhìn liền mạch — mở năm màn hình thì không ai nối được đầu này với đầu kia.
 *
 * Dòng nào đếm MÁY thì lấy từ v_kho_ma, dòng nào đếm TIỀN thì lấy từ thuê bao:
 * một thuê bao nợ tiền chứ cái máy không nợ.
 */
type DongMay = {
  ma: string;
  ten: string;
  y: string;
  ro?: boolean;
  /**
   * Việc LẤY MÁY VỀ KHO. SIM không cần lấy về — xuất kho là xong, không có bước
   * nhập lại — nên trừ SIM khỏi số cần xử lý.
   */
  thu_hoi?: boolean;
  don: "may";
  hop: (r: KhoMa) => boolean;
  tien?: (r: KhoMa) => number;
  nhan_tien?: string;
};

type DongTb = {
  ma: string;
  ten: string;
  y: string;
  ro?: boolean;
  don: "tb";
  hop: (r: ThueBaoNo) => boolean;
  tien?: (r: ThueBaoNo) => number;
  nhan_tien?: string;
};

type Khau = { so: string; ten: string; dong: (DongMay | DongTb)[] };

const so = (v: string | null) => Number(v ?? 0);

/** Thứ tự cố định để cột không nhảy chỗ giữa hai lần tải. */
const LOAI = ["CUSTOMER", "COLLABORATOR", "AGENCY"] as const;

/** Máy wifi phải lấy về kho, SIM thì xuất kho là xong — hai việc khác nhau. */
const NHOM = ["MAY_WIFI", "SIM"] as const;

/**
 * Mục mà file Excel xếp mã vào. In kèm dưới mấy dòng rò để biết đống đó gồm
 * những gì — 561 máy chưa mở dịch vụ mà 148 cái là máy cho mượn chờ lắp cố
 * định thì đó là đúng nghiệp vụ, không phải rò.
 */
function gomMuc(rows: KhoMa[]) {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = r.file_vi_tri_so ?? "file không xếp mục";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

const KHAU: Khau[] = [
  {
    so: "1",
    ten: "Nhập hàng về kho",
    dong: [
      {
        ma: "trong-kho",
        don: "may",
        ten: "Đang nằm trong kho",
        y: "phiếu gần nhất là phiếu nhập",
        hop: (r) => r.cho_dung === "TRONG_KHO",
      },
      {
        ma: "kho-chua-thue",
        don: "may",
        ten: "Trong kho mà chưa từng cho thuê",
        y: "nhập về rồi để đó, chưa ra khỏi kho lần nào",
        hop: (r) => r.cho_dung === "TRONG_KHO" && !r.co_thue_bao,
      },
    ],
  },
  {
    so: "2",
    ten: "Cho thuê",
    dong: [
      {
        ma: "o-khach",
        don: "may",
        ten: "Đang ở khách",
        y: "phiếu gần nhất là phiếu xuất, hoặc hồ sơ cho thuê còn mở",
        hop: (r) => r.cho_dung === "O_KHACH",
        tien: (r) => so(r.coc),
        nhan_tien: "cọc đang giữ",
      },
      {
        ma: "khong-dich-vu",
        don: "may",
        ro: true,
        ten: "Ra khỏi kho mà chưa mở dịch vụ",
        y: "có phiếu xuất nhưng không gắn thuê bao nào — không bao giờ ra cước",
        hop: (r) => r.cho_dung === "O_KHACH" && !r.co_thue_bao,
        tien: (r) => so(r.coc),
        nhan_tien: "cọc đang giữ",
      },
    ],
  },
  {
    so: "3",
    ten: "Tính cước",
    dong: [
      {
        ma: "dang-ra-cuoc",
        don: "may",
        ten: "Đang ra cước tháng này",
        y: "máy ở khách, thuê bao còn hiệu lực, tháng này có kỳ",
        hop: (r) =>
          r.cho_dung === "O_KHACH" && r.tinh_trang_cuoc === "DANG_RA_CUOC",
      },
      {
        ma: "hut-cuoc",
        don: "may",
        ro: true,
        ten: "Thuê bao còn sống mà ngừng ra cước",
        y: "máy vẫn ở khách, dịch vụ vẫn hiệu lực, nhưng tháng này không có kỳ nào",
        hop: (r) =>
          r.cho_dung === "O_KHACH" && r.tinh_trang_cuoc === "HUT_CUOC",
      },
    ],
  },
  {
    so: "4",
    ten: "Thu tiền",
    dong: [
      {
        ma: "da-thu",
        don: "tb",
        ten: "Đã thu được",
        y: "cộng hoá đơn đã thanh toán của mọi thuê bao",
        hop: (r) => so(r.da_thu) > 0,
        tien: (r) => so(r.da_thu),
        nhan_tien: "đã thu",
      },
      {
        ma: "dang-doi",
        don: "tb",
        ten: "Đang đòi",
        y: "hoá đơn đã phát hành, phần lớn là cước tháng mới ra chưa tới hạn",
        hop: (r) => so(r.no) > 0,
        tien: (r) => so(r.no),
        nhan_tien: "đang đòi",
      },
      {
        ma: "qua-han",
        don: "tb",
        ro: true,
        ten: "Có hoá đơn quá hạn",
        y: "đã qua ngày phải trả mà chưa thấy tiền",
        hop: (r) => so(r.qua_han_lau_nhat) > 0,
        tien: (r) => so(r.no),
        nhan_tien: "đang đòi",
      },
      {
        ma: "bo-thu",
        don: "tb",
        ro: true,
        ten: "Đã chốt là không thu được",
        y: "hoá đơn chuyển sang trạng thái bỏ thu — tiền coi như mất",
        hop: (r) => so(r.bo_thu) > 0,
        tien: (r) => so(r.bo_thu),
        nhan_tien: "bỏ thu",
      },
    ],
  },
  {
    so: "5",
    ten: "Huỷ và đòi máy về",
    dong: [
      {
        ma: "da-huy",
        don: "tb",
        ten: "Thuê bao đã huỷ",
        y: "dịch vụ đã dừng",
        hop: (r) => r.trang_thai === "TERMINATED",
        tien: (r) => so(r.bo_thu),
        nhan_tien: "bỏ thu",
      },
      {
        ma: "huy-con-no",
        don: "tb",
        ro: true,
        ten: "Huỷ rồi mà hoá đơn vẫn đang đòi",
        y: "dịch vụ dừng nhưng tiền chưa chốt xong",
        hop: (r) => r.trang_thai === "TERMINATED" && so(r.no) > 0,
        tien: (r) => so(r.no),
        nhan_tien: "đang đòi",
      },
      {
        ma: "huy-chua-thu-may",
        don: "may",
        ro: true,
        thu_hoi: true,
        ten: "Huỷ rồi mà máy chưa về",
        y: "không có phiếu nhập nào, cọc còn treo",
        // Trừ nhóm phiếu xuất đánh dấu không thu hồi: máy đó vốn không bao giờ
        // về kho, kể vào đây là thổi số phải đòi lên hơn hai lần rưỡi.
        hop: (r) =>
          r.cho_dung === "O_KHACH" &&
          r.tinh_trang_cuoc === "HUY_CHUA_THU_MAY" &&
          !r.khong_thu_hoi,
        tien: (r) => so(r.coc),
        nhan_tien: "cọc treo",
      },
      {
        ma: "xuat-khong-thu-hoi",
        don: "may",
        ten: "Huỷ rồi, nhưng phiếu ghi không cần thu hồi",
        y: "xuất đi là xong — không phải máy thất lạc, không đòi",
        hop: (r) =>
          r.cho_dung === "O_KHACH" &&
          r.tinh_trang_cuoc === "HUY_CHUA_THU_MAY" &&
          r.khong_thu_hoi,
        tien: (r) => so(r.coc),
        nhan_tien: "cọc treo",
      },
    ],
  },
];

export async function NoiDungVongDoi({
  searchParams,
}: {
  searchParams: Promise<Tham>;
}) {
  const sp = await searchParams;
  const [may, tb] = await Promise.all([getKhoMa(), getThueBaoNo()]);

  const lay = (d: DongMay | DongTb) =>
    d.don === "may" ? may.filter(d.hop) : tb.filter(d.hop);

  const moi = KHAU.flatMap((k) => k.dong).find(
    (d) =>
      d.ma === // `xem` đã là tên tab của màn Điểm nghẽn; trùng thì URLSearchParams lấy giá
      // trị đầu và ngăn kéo không bao giờ mở. Dùng `vd` cho riêng vòng đời.
      mot(sp.vd),
  );

  return (
    <>
      <p className="muted">
        Năm khâu của một cái máy: nhập kho → cho thuê → ra cước → thu tiền → huỷ
        và đòi về. Mỗi khâu rò một kiểu khác nhau nên để liền mạch ở đây thay vì
        rải ra năm màn hình. Dòng <span className="chip do">đỏ</span> là chỗ
        tiền đang chảy ra ngoài. Bấm một dòng để xem danh sách, không nhảy
        trang.
      </p>

      <p className="muted">
        Hai cột <b>máy wifi</b> và <b>SIM</b> quyết định việc phải làm ở khâu 5:
        máy wifi ở khách mà dịch vụ dừng thì <b>phải lấy về kho</b> — nó là tài
        sản, có cọc, có vòng đời nhập rồi lại xuất.{" "}
        <b>
          SIM thì không cần lấy về kho: xuất kho là xong, không có bước nhập
          lại.
        </b>{" "}
        Dòng nào đếm thuê bao thì hai cột này để gạch, vì thuê bao không có loại
        thiết bị.
      </p>

      {KHAU.map((k) => (
        <section key={k.so}>
          <h2>
            {k.so} · {k.ten}
          </h2>
          <div className="scroller">
            <table className="bang-thang">
              <thead>
                <tr>
                  <th className="num">Số lượng</th>
                  <th>Chỉ số</th>
                  {NHOM.map((k) => (
                    <th key={k} className="num">
                      <span className={`chip ${MAU_NHOM_TB[k] ?? "tat"}`}>
                        {NHOM_TB[k]}
                      </span>
                    </th>
                  ))}
                  {LOAI.map((l) => (
                    <th key={l} className="num">
                      <span className={`chip ${MAU_LOAI_KHACH[l] ?? "tat"}`}>
                        {LOAI_KHACH[l] ?? l}
                      </span>
                    </th>
                  ))}
                  <th className="num">Không rõ</th>
                  <th
                    className="num"
                    title="Đã trừ đại lý — đại lý tự vận hành, không thuộc phạm vi mình theo dõi"
                  >
                    Cần xử lý
                  </th>
                  <th className="num">Tiền</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {k.dong.map((d) => {
                  const rows = lay(d);
                  const tien = d.tien
                    ? rows.reduce(
                        (t, r) =>
                          t + (d.tien as (x: typeof r) => number)(r as never),
                        0,
                      )
                    : null;
                  return (
                    <tr key={d.ma}>
                      <td
                        className={`num mono${d.ro && rows.length > 0 ? " bad" : ""}`}
                      >
                        {n(rows.length)}
                        <div className="muted">
                          {d.don === "may" ? "máy" : "thuê bao"}
                        </div>
                      </td>
                      <td>
                        {d.ro && <span className="chip do">rò</span>} {d.ten}
                        <div className="muted">{d.y}</div>
                        {d.don === "may" && d.ro && (
                          <div className="muted">
                            file xếp vào:{" "}
                            {gomMuc(rows as KhoMa[])
                              .map(([k, v]) => `${k} ${n(v)}`)
                              .join(" · ")}
                          </div>
                        )}
                      </td>
                      {NHOM.map((k) => (
                        <td key={k} className="num mono muted">
                          {d.don === "may"
                            ? n(
                                (rows as KhoMa[]).filter((r) => r.nhom_tb === k)
                                  .length,
                              )
                            : "—"}
                        </td>
                      ))}
                      {LOAI.map((l) => (
                        <td key={l} className="num mono muted">
                          {k.so === "1"
                            ? "—"
                            : n(
                                (
                                  rows as { loai_khach: string | null }[]
                                ).filter((r) => r.loai_khach === l).length,
                              )}
                        </td>
                      ))}
                      <td className="num mono muted">
                        {k.so === "1"
                          ? "—"
                          : n(
                              (rows as { loai_khach: string | null }[]).filter(
                                (r) => r.loai_khach === null,
                              ).length,
                            )}
                      </td>
                      <td className={`num mono${d.ro ? " bad" : " muted"}`}>
                        {d.ro ? (
                          <>
                            {n(
                              (
                                rows as {
                                  loai_khach: string | null;
                                  nhom_tb?: string;
                                }[]
                              ).filter(
                                (r) =>
                                  r.loai_khach !== "AGENCY" &&
                                  !(
                                    "thu_hoi" in d &&
                                    d.thu_hoi &&
                                    r.nhom_tb === "SIM"
                                  ),
                              ).length,
                            )}
                            {"thu_hoi" in d && d.thu_hoi && (
                              <div className="muted">
                                đã trừ SIM — SIM không phải lấy về kho
                              </div>
                            )}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="num mono">
                        {tien === null || tien === 0 ? (
                          <span className="muted">—</span>
                        ) : (
                          <>
                            {n(tien)}
                            <div className="muted">{d.nhan_tien}</div>
                          </>
                        )}
                      </td>
                      <td className="khong-xuong-dong">
                        {rows.length > 0 && (
                          <Link
                            href={them(
                              "/diem-nghen?xem=dong-chay&he=cam-tay",
                              `vd=${d.ma}`,
                            )}
                          >
                            xem →
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {/* Các dòng trong một khâu CHỒNG nhau — "trong kho mà chưa từng
                    cho thuê" nằm trong "đang nằm trong kho" — nên tổng phải là
                    HỢP, không phải phép cộng. Cộng thẳng là đếm hai lần. */}
                {(() => {
                  const hop = k.dong.some((d) => d.don === "may")
                    ? may.filter((r) =>
                        k.dong.some(
                          (d) =>
                            d.don === "may" &&
                            (d.hop as (x: KhoMa) => boolean)(r),
                        ),
                      )
                    : null;
                  const hopTb = k.dong.some((d) => d.don === "tb")
                    ? tb.filter((r) =>
                        k.dong.some(
                          (d) =>
                            d.don === "tb" &&
                            (d.hop as (x: ThueBaoNo) => boolean)(r),
                        ),
                      )
                    : null;
                  const dem = (l: string) =>
                    (hop?.filter((r) => r.loai_khach === l).length ?? 0) +
                    (hopTb?.filter((r) => r.loai_khach === l).length ?? 0);
                  return (
                    <tr>
                      <td className="num mono">
                        <b>{n((hop?.length ?? 0) + (hopTb?.length ?? 0))}</b>
                        <div className="muted">
                          {[
                            hop && `${n(hop.length)} máy`,
                            hopTb && `${n(hopTb.length)} thuê bao`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      </td>
                      <td>
                        <b>Tổng khâu {k.so}</b>
                        <div className="muted">
                          đếm mỗi mã một lần — các dòng trên chồng nhau nên đây
                          là hợp, không phải phép cộng
                        </div>
                      </td>
                      {NHOM.map((nh) => (
                        <td key={nh} className="num mono">
                          {hop ? (
                            <b>
                              {n(hop.filter((r) => r.nhom_tb === nh).length)}
                            </b>
                          ) : (
                            "—"
                          )}
                        </td>
                      ))}
                      {LOAI.map((l) => (
                        <td key={l} className="num mono">
                          {k.so === "1" ? "—" : <b>{n(dem(l))}</b>}
                        </td>
                      ))}
                      <td className="num mono">
                        {k.so === "1" ? (
                          "—"
                        ) : (
                          <b>
                            {n(
                              (hop?.filter((r) => r.loai_khach === null)
                                .length ?? 0) +
                                (hopTb?.filter((r) => r.loai_khach === null)
                                  .length ?? 0),
                            )}
                          </b>
                        )}
                      </td>
                      <td className="num mono muted">—</td>
                      <td className="num mono muted">—</td>
                      <td />
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <p className="muted khoi-ghi-chu">
        Khâu thu tiền chỉ cộng hoá đơn có gắn thuê bao. Hoá đơn không gắn thuê
        bao — chủ yếu là hoá đơn bán hàng — không nằm trong đây, nên số đã thu ở
        trang này nhỏ hơn tổng hoá đơn toàn hệ.
      </p>

      {moi &&
        (moi.don === "may" ? (
          <ChiTietNhom
            ten={moi.ten}
            mo_ta={moi.y}
            rows={may.filter(moi.hop)}
            dongLai="/diem-nghen?xem=dong-chay&he=cam-tay"
            baseHref={them(
              "/diem-nghen?xem=dong-chay&he=cam-tay",
              `vd=${moi.ma}`,
            )}
            lk={mot(sp.lk)}
            vt={mot(sp.vt)}
          />
        ) : (
          <ChiTietThueBao
            ten={moi.ten}
            mo_ta={moi.y}
            rows={tb.filter(moi.hop)}
            dongLai="/diem-nghen?xem=dong-chay&he=cam-tay"
          />
        ))}
    </>
  );
}
