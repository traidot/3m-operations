import Link from "next/link";
import { Dong } from "../../hop-dong/dong";
import { ChiTietKhach } from "./chi-tiet";
import { ChiTietThueBao } from "../thue-bao/chi-tiet";
import {
  CONTRACTS_PER_PAGE,
  countTelecomCustomers,
  getDevicesForSubs,
  getSubsForParties,
  getTelecomCustomers,
  getTelecomYearStatus,
  type CustomerFilter,
  type CustomerSub,
  type TelecomDevice,
  type YearStatus,
} from "@/lib/queries";
import {
  CANH_BAO_TELECOM,
  CANH_BAO_TELECOM_NANG,
  DICH_VU,
  COC,
  HOP_DONG,
  KY_TELECOM,
  LOP_KY_TELECOM,
  MAY,
} from "@/lib/nhan";
import { Chip, ChipLoaiKhach } from "../../chip";
import { LOAI_KHACH, MAU_DICH_VU, MAU_TRANG_THAI } from "@/lib/nhan";
import { DaiKy } from "../../hop-dong/dai-ky";

export const dynamic = "force-dynamic";

const n = (v: string | null) =>
  v === null ? "—" : Number(v).toLocaleString("vi-VN");

type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? "";

function Chon({
  ten,
  nhan,
  chon,
  lua,
}: {
  ten: string;
  nhan: string;
  chon: string;
  lua: Record<string, string>;
}) {
  return (
    <label>
      {nhan}
      <span className="o-chon">
        <select name={ten} defaultValue={chon}>
          <option value="">tất cả</option>
          {Object.entries(lua).map(([ma, chu]) => (
            <option key={ma} value={ma}>
              {chu}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

/**
 * Nguồn có hai trường gần trùng nhau: customerType (vai trò) và customerGroup
 * (nhóm nghiệp vụ). Phần lớn khách thì nhóm chỉ nói lại đúng vai trò — "khách
 * lẻ" với "khách hàng lẻ" — nên bày cả hai là bày thừa một dòng.
 *
 * Chỉ hiện nhóm khi nó nói thêm điều gì: nhóm wifi cố định, hoặc nhóm lệch với
 * vai trò (khách lẻ mà nằm trong nhóm đại lý — dữ liệu bên nguồn nhập lệch).
 */
const TRUNG_NGHIA: Record<string, string> = {
  CUSTOMER: "khách hàng lẻ",
  COLLABORATOR: "cộng tác viên",
  AGENCY: "khách hàng đại lý",
};

function tenNhom(nhom: string | null, loai: string | null): string | null {
  if (!nhom) return null;
  const gon = nhom.replace(/^NHÓM\s+/i, "").toLowerCase();
  return gon === TRUNG_NGHIA[loai ?? ""] ? null : gon;
}

/**
 * Khách thường bày hết dịch vụ. Riêng đại lý có tới 802 thuê bao: dựng ngần ấy
 * dòng làm trang mất 4-5 giây, nên cắt ở đây và mời sang ngăn kéo xem đủ.
 */
const TOI_DA_DICH_VU = 25;

/** Máy đang gắn và tiền cọc, hiện cạnh mã máy trên dòng dịch vụ. */
function May({ may }: { may: TelecomDevice | undefined }) {
  if (!may) return null;
  return (
    <span className="may-dong">
      {may.trang_thai_may && (
        <span className={`chip ${MAU_TRANG_THAI[may.trang_thai_may] ?? "tat"}`}>
          {MAY[may.trang_thai_may] ?? may.trang_thai_may}
        </span>
      )}
      {Number(may.coc ?? 0) > 0 && (
        <span className="mono muted">
          {" "}
          cọc {n(may.coc)}
          {may.trang_thai_coc &&
            ` (${COC[may.trang_thai_coc] ?? may.trang_thai_coc})`}
        </span>
      )}
    </span>
  );
}

/** Các dịch vụ của một khách, hiện thành dòng phụ ngay dưới dòng khách. */
function dichVu(
  kh: { party_id: string; so_thue_bao: string },
  tb: CustomerSub[],
  link: (doi: Record<string, string | undefined>) => string,
  theoNam: Map<string, YearStatus>,
  theoMay: Map<string, TelecomDevice>,
) {
  const hien = tb.slice(0, TOI_DA_DICH_VU);
  const con = tb.length - hien.length;

  const dong = hien.map((s) => (
    <Dong
      key={`${kh.party_id}-${s.subscription_id}`}
      href={link({ hd: s.subscription_id })}
      dangMo={false}
      lop="sub"
    >
      <td>
        <span className={`chip ${MAU_DICH_VU[s.service_type ?? ""] ?? "tat"}`}>
          {DICH_VU[s.service_type ?? ""] ?? s.service_type ?? "dịch vụ"}
        </span>
        {s.goi && <span className="muted"> · {s.goi}</span>}
        {s.ma_may && <span className="mono muted"> · {s.ma_may}</span>}
        <May may={theoMay.get(s.subscription_id)} />
        <DaiKy
          nam={theoNam.get(s.subscription_id)}
          lop={LOP_KY_TELECOM}
          nhan={KY_TELECOM}
        />
      </td>
      <td>
        <Chip ma={s.trang_thai} nhan={HOP_DONG} />
      </td>
      <td>
        {s.canh_bao.map((cb) => (
          <span
            key={cb}
            className={`tag ${CANH_BAO_TELECOM_NANG.has(cb) ? "critical" : "warn"}`}
          >
            {CANH_BAO_TELECOM[cb] ?? cb}
          </span>
        ))}
      </td>
      {/* Hai cột đếm thuê bao không có nghĩa ở dòng dịch vụ; để trống cho
            ba cột tiền bên phải vẫn dóng thẳng với dòng khách bên trên. */}
      <td colSpan={2} className="num mono muted">
        {n(s.gia_thang)}/tháng · kỳ {s.ky_gan_nhat_den?.slice(0, 7) ?? "—"}
      </td>
      <td className="num mono muted">{n(s.da_thu)}</td>
      <td className={`num mono${Number(s.con_no) > 0 ? " bad" : ""}`}>
        {n(s.con_no)}
      </td>
      <td className={`num mono${Number(s.tien_mat) > 0 ? " bad" : ""}`}>
        {n(s.tien_mat)}
      </td>
      <td />
    </Dong>
  ));

  if (con === 0) return dong;

  return [
    ...dong,
    <tr key={`${kh.party_id}-them`} className="sub">
      <td colSpan={9}>
        <Link href={link({ xem: kh.party_id })} scroll={false}>
          còn {con.toLocaleString("vi-VN")} dịch vụ nữa — xem tất cả →
        </Link>
      </td>
    </tr>,
  ];
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Tham>;
}) {
  const sp = await searchParams;
  const loc: CustomerFilter = {
    q: mot(sp.q),
    dichVu: mot(sp.dv),
    canhBao: mot(sp.cb),
    nhieuTb: mot(sp.nhieu),
    loai: mot(sp.loai),
    trang: Math.max(1, Number(mot(sp.trang)) || 1),
  };

  const [rows, tong] = await Promise.all([
    getTelecomCustomers(loc),
    countTelecomCustomers(loc),
  ]);
  const dichVuTheoKhach = await getSubsForParties(rows.map((r) => r.party_id));
  const maThueBao = [...dichVuTheoKhach.values()]
    .flat()
    .map((s) => s.subscription_id);
  const mayTheoThueBao = await getDevicesForSubs(maThueBao);
  const namTheoThueBao = await getTelecomYearStatus(
    [...dichVuTheoKhach.values()].flat().map((s) => s.subscription_id),
  );
  const soTrang = Math.max(1, Math.ceil(tong / CONTRACTS_PER_PAGE));
  const trang = loc.trang!;
  const dangMo = mot(sp.xem);
  const hoaDon = mot(sp.hd);

  const link = (doi: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    if (loc.q) p.set("q", loc.q);
    if (loc.dichVu) p.set("dv", loc.dichVu);
    if (loc.canhBao) p.set("cb", loc.canhBao);
    if (loc.nhieuTb) p.set("nhieu", loc.nhieuTb);
    if (loc.loai) p.set("loai", loc.loai);
    if (dangMo) p.set("xem", dangMo);
    if (hoaDon) p.set("hd", hoaDon);
    if (trang > 1) p.set("trang", String(trang));
    for (const [k, v] of Object.entries(doi)) {
      if (v === undefined) p.delete(k);
      else p.set(k, v);
    }
    const duoi = p.toString();
    return duoi ? `/cam-tay/khach?${duoi}` : "/cam-tay/khach";
  };

  return (
    <main>
      <h1>Khách wifi cầm tay</h1>
      <p className="muted">
        Mỗi khách một dòng, các dịch vụ của khách nằm ngay dưới kèm trạng thái.
        Một khách có thể dùng nhiều dịch vụ cùng lúc nên nợ cộng theo người,
        không theo thuê bao. Tìm được cả theo mã máy. Có party là tài khoản CTV
        hoặc đại lý giữ hàng trăm thuê bao — lọc “từ 2 thuê bao” để thấy.
      </p>

      <form method="get">
        <div className="formgrid">
          <label>
            Tên, điện thoại hoặc mã máy
            <input
              type="search"
              name="q"
              defaultValue={loc.q}
              placeholder="tên khách, IMEI…"
            />
          </label>
          <Chon
            ten="loai"
            nhan="Loại khách"
            chon={loc.loai!}
            lua={LOAI_KHACH}
          />
          <Chon ten="dv" nhan="Dịch vụ" chon={loc.dichVu!} lua={DICH_VU} />
          <Chon
            ten="cb"
            nhan="Cảnh báo"
            chon={loc.canhBao!}
            lua={{ CO: "có cảnh báo", ...CANH_BAO_TELECOM }}
          />
          <Chon
            ten="nhieu"
            nhan="Số thuê bao"
            chon={loc.nhieuTb!}
            lua={{ "1": "từ 2 thuê bao trở lên" }}
          />
          <div className="actions">
            <button className="primary" type="submit">
              Lọc
            </button>
            <Link href="/cam-tay/khach">
              <button type="button">Bỏ lọc</button>
            </Link>
          </div>
        </div>
      </form>

      <h2>
        {n(String(tong))} khách
        {soTrang > 1 ? ` — trang ${trang}/${soTrang}` : ""}
      </h2>

      {rows.length === 0 ? (
        <p className="empty">Không có khách nào khớp.</p>
      ) : (
        <div className="scroller">
          <table className="bang-nhom">
            <thead>
              <tr>
                <th>Khách</th>
                <th>Loại</th>
                <th>Cảnh báo</th>
                <th className="num">Thuê bao</th>
                <th className="num">Đang chạy</th>
                <th className="num">Đã thu</th>
                <th className="num">Còn nợ</th>
                <th className="num">Mất trắng</th>
                <th
                  className="num"
                  title="Thiết bị cho thuê bên nguồn đánh dấu NOT_RETURNED: hết hạn thuê mà chưa nhận lại máy, cọc vẫn treo"
                >
                  Máy chưa trả
                </th>
              </tr>
            </thead>
            {rows.map((r) => (
              <tbody key={r.party_id}>
                <Dong
                  key={r.party_id}
                  href={link({ xem: r.party_id })}
                  dangMo={r.party_id === dangMo}
                >
                  <td>
                    <Link href={link({ xem: r.party_id })} scroll={false}>
                      {r.khach}
                    </Link>
                    {r.dien_thoai && (
                      <div className="mono muted">{r.dien_thoai}</div>
                    )}
                  </td>
                  <td>
                    <ChipLoaiKhach ma={r.loai_khach} />
                    {tenNhom(r.nhom_khach, r.loai_khach) && (
                      <div className="muted">
                        {tenNhom(r.nhom_khach, r.loai_khach)}
                      </div>
                    )}
                  </td>
                  <td>
                    {r.canh_bao.length === 0 ? (
                      <span className="muted">—</span>
                    ) : (
                      r.canh_bao.map((cb) => (
                        <span
                          key={cb}
                          className={`tag ${CANH_BAO_TELECOM_NANG.has(cb) ? "critical" : "warn"}`}
                        >
                          {CANH_BAO_TELECOM[cb] ?? cb}
                        </span>
                      ))
                    )}
                  </td>
                  <td className="num mono">{n(r.so_thue_bao)}</td>
                  <td className="num mono muted">{n(r.dang_chay)}</td>
                  <td className="num mono">{n(r.da_thu)}</td>
                  <td
                    className={`num mono${Number(r.con_no) > 0 ? " bad" : ""}`}
                  >
                    {n(r.con_no)}
                  </td>
                  <td
                    className={`num mono${Number(r.tien_mat) > 0 ? " bad" : ""}`}
                  >
                    {n(r.tien_mat)}
                  </td>
                  <td
                    className={`num mono${Number(r.may_chua_tra) > 0 ? " bad" : ""}`}
                  >
                    {n(r.may_chua_tra)}
                  </td>
                </Dong>
                {dichVu(
                  r,
                  dichVuTheoKhach.get(r.party_id) ?? [],
                  link,
                  namTheoThueBao,
                  mayTheoThueBao,
                )}
              </tbody>
            ))}
          </table>
        </div>
      )}

      {soTrang > 1 && (
        <div className="actions">
          {trang > 1 && (
            <Link href={link({ trang: String(trang - 1), xem: undefined })}>
              <button type="button">← Trang trước</button>
            </Link>
          )}
          {trang < soTrang && (
            <Link href={link({ trang: String(trang + 1), xem: undefined })}>
              <button type="button">Trang sau →</button>
            </Link>
          )}
        </div>
      )}

      {hoaDon ? (
        <ChiTietThueBao id={hoaDon} dongLai={link({ hd: undefined })} />
      ) : (
        dangMo && (
          <ChiTietKhach
            id={dangMo}
            dongLai={link({ xem: undefined })}
            linkHoaDon={(sid) => link({ hd: sid })}
          />
        )
      )}
    </main>
  );
}
