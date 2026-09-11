import Link from "next/link";
import { Dong } from "../../hop-dong/dong";
import { ChiTietKhach } from "./chi-tiet";
import {
  CONTRACTS_PER_PAGE,
  countTelecomCustomers,
  getSubsForParties,
  getTelecomCustomers,
  type CustomerFilter,
  type CustomerSub,
} from "@/lib/queries";
import { CANH_BAO_TELECOM, CANH_BAO_TELECOM_NANG, DICH_VU, HOP_DONG } from "@/lib/nhan";
import { Chip } from "../../chip";

export const dynamic = "force-dynamic";

const n = (v: string | null) => (v === null ? "—" : Number(v).toLocaleString("vi-VN"));

type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function Chon({ ten, nhan, chon, lua }: {
  ten: string; nhan: string; chon: string; lua: Record<string, string>;
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

/** Đại lý có tới 802 thuê bao, bày hết thì một khách chiếm cả trang. */
const TOI_DA_DICH_VU = 6;

/** Các dịch vụ của một khách, hiện thành dòng phụ ngay dưới dòng khách. */
function dichVu(
  kh: { party_id: string; so_thue_bao: string },
  tb: CustomerSub[],
  link: (doi: Record<string, string | undefined>) => string,
) {
  const hien = tb.slice(0, TOI_DA_DICH_VU);
  const con = tb.length - hien.length;

  return [
    ...hien.map((s) => (
      <tr key={`${kh.party_id}-${s.subscription_id}`} className="sub">
        <td>
          <a href={`/cam-tay/thue-bao?xem=${s.subscription_id}`}>
            {DICH_VU[s.service_type ?? ""] ?? s.service_type ?? "dịch vụ"}
          </a>
          {s.goi && <span className="muted"> · {s.goi}</span>}
          {s.ma_may && <span className="mono muted"> · {s.ma_may}</span>}
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
        <td className={`num mono${Number(s.con_no) > 0 ? " bad" : ""}`}>{n(s.con_no)}</td>
        <td className={`num mono${Number(s.tien_mat) > 0 ? " bad" : ""}`}>{n(s.tien_mat)}</td>
        <td />
      </tr>
    )),
    ...(con > 0
      ? [
          <tr key={`${kh.party_id}-them`} className="sub">
            <td colSpan={9}>
              <a href={link({ xem: kh.party_id })}>còn {con} dịch vụ nữa →</a>
            </td>
          </tr>,
        ]
      : []),
  ];
}

export default async function Page({ searchParams }: { searchParams: Promise<Tham> }) {
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
  const soTrang = Math.max(1, Math.ceil(tong / CONTRACTS_PER_PAGE));
  const trang = loc.trang!;
  const dangMo = mot(sp.xem);

  const link = (doi: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    if (loc.q) p.set("q", loc.q);
    if (loc.dichVu) p.set("dv", loc.dichVu);
    if (loc.canhBao) p.set("cb", loc.canhBao);
    if (loc.nhieuTb) p.set("nhieu", loc.nhieuTb);
    if (loc.loai) p.set("loai", loc.loai);
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
        Mỗi khách một dòng, các dịch vụ của khách nằm ngay dưới kèm trạng thái. Một khách
        có thể dùng nhiều dịch vụ cùng lúc nên nợ cộng theo người, không theo thuê bao.
        Tìm được cả theo mã máy. Có party là tài khoản CTV hoặc đại lý giữ hàng trăm thuê
        bao — lọc “từ 2 thuê bao” để thấy.
      </p>

      <form method="get">
        <div className="formgrid">
          <label>
            Tên, điện thoại hoặc mã máy
            <input type="search" name="q" defaultValue={loc.q} placeholder="tên khách, IMEI…" />
          </label>
          <Chon
            ten="loai"
            nhan="Loại khách"
            chon={loc.loai!}
            lua={{ CUSTOMER: "khách lẻ", COLLABORATOR: "cộng tác viên", AGENCY: "đại lý" }}
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
            <a href="/cam-tay/khach">
              <button type="button">Bỏ lọc</button>
            </a>
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
          <table className="bang-chon">
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
                <th className="num">Máy chưa trả</th>
              </tr>
            </thead>
            <tbody>
              {rows.flatMap((r) => [
                <Dong
                  key={r.party_id}
                  href={link({ xem: r.party_id })}
                  dangMo={r.party_id === dangMo}
                >
                  <td>
                    <Link href={link({ xem: r.party_id })} scroll={false}>
                      {r.khach}
                    </Link>
                    {r.dien_thoai && <div className="mono muted">{r.dien_thoai}</div>}
                  </td>
                  <td>
                    {r.loai_khach_chu}
                    {r.nhom_khach && <div className="muted">{r.nhom_khach}</div>}
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
                  <td className={`num mono${Number(r.con_no) > 0 ? " bad" : ""}`}>
                    {n(r.con_no)}
                  </td>
                  <td className={`num mono${Number(r.tien_mat) > 0 ? " bad" : ""}`}>
                    {n(r.tien_mat)}
                  </td>
                  <td className={`num mono${Number(r.may_chua_tra) > 0 ? " bad" : ""}`}>
                    {n(r.may_chua_tra)}
                  </td>
                </Dong>,
                ...dichVu(r, dichVuTheoKhach.get(r.party_id) ?? [], link),
              ])}
            </tbody>
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

      {dangMo && <ChiTietKhach id={dangMo} dongLai={link({ xem: undefined })} />}
    </main>
  );
}
