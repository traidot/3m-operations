import { Fragment } from "react";
import Link from "next/link";
import { Bars } from "../../wifi/bars";
import { Dong } from "../../hop-dong/dong";
import { ChiTietHuy } from "./chi-tiet";
import { getTelecomChurn, type TelecomChurn } from "@/lib/queries";
import { LOAI_KHACH } from "@/lib/nhan";
import { them } from "../../duong-dan";

const n = (v: string | number | null) =>
  v === null ? "—" : Number(v).toLocaleString("vi-VN");

type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Thứ tự cố định để cột không nhảy chỗ khi một loại vắng mặt cả tháng. */
const LOAI = ["CUSTOMER", "COLLABORATOR", "AGENCY", "CHUA_PHAN_LOAI"] as const;
const TEN_LOAI: Record<string, string> = { ...LOAI_KHACH, CHUA_PHAN_LOAI: "chưa phân loại" };
const SO_THANG_BIEU_DO = 18;

/** Cộng nhiều dòng loại khách thành một; tỉ lệ phải tính lại từ tổng. */
function gop(rows: TelecomChurn[]): TelecomChurn | null {
  if (rows.length === 0) return null;
  const tong = (k: "dau_ky" | "moi" | "huy" | "cuoi_ky") =>
    rows.reduce((t, r) => t + Number(r[k]), 0);
  const dau = tong("dau_ky");
  return {
    ...rows[0]!,
    loai_khach: "",
    dau_ky: String(dau),
    moi: String(tong("moi")),
    huy: String(tong("huy")),
    cuoi_ky: String(tong("cuoi_ky")),
    ty_le_huy: dau > 0 ? String(Math.round((1000 * tong("huy")) / dau) / 10) : null,
  };
}

export async function NoiDungHuy({ searchParams }: { searchParams: Promise<Tham> }) {
  const sp = await searchParams;
  const tatCa = await getTelecomChurn();

  const loai = LOAI.includes(mot(sp.loai) as (typeof LOAI)[number]) ? mot(sp.loai) : "";
  const loc = loai ? tatCa.filter((r) => r.loai_khach === loai) : tatCa;

  const cacThang = [...new Set(tatCa.map((r) => r.thang))].sort((a, b) => b.localeCompare(a));
  const thang = cacThang
    .map((t) => gop(loc.filter((r) => r.thang === t)))
    .filter((r): r is TelecomChurn => r !== null);

  const o = (t: string, l: string) => tatCa.find((r) => r.thang === t && r.loai_khach === l);
  const coLoai = LOAI.filter((l) => tatCa.some((r) => r.loai_khach === l && Number(r.huy) > 0));

  const moThang = /^\d{4}-\d{2}$/.test(mot(sp.thang)) ? mot(sp.thang) : "";
  const link = (t: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(t)) if (v) p.set(k, v);
    const duoi = p.toString();
    return duoi ? them("/diem-nghen?xem=dong-chay&he=cam-tay", duoi) : "/diem-nghen?xem=dong-chay&he=cam-tay";
  };

  // Tháng đang chạy dở không đem ra so: mới được nửa tháng thì tỉ lệ đọc ra thấp
  // hơn thật, mà nếu có đợt hết hạn đầu tháng thì lại cao hơn thật.
  const ganDay = thang.filter((r) => !r.thang_chua_xong).slice(0, 6);
  const tbTyLe = ganDay.length
    ? Math.round(
        (10 * ganDay.reduce((t, r) => t + Number(r.ty_le_huy ?? 0), 0)) / ganDay.length,
      ) / 10
    : null;
  const bieuDo = [...thang].reverse().slice(-SO_THANG_BIEU_DO);
  const thangNay = thang[0];

  return (
    <>
      <p className="muted">
        Tỉ lệ huỷ của một tháng tính trên tập <b>đang chạy đầu tháng đó</b>, không tính thuê
        bao mới vào rồi ra ngay trong tháng — cái đó đọc ở cột “mới”. Ngày ngừng lấy theo thứ
        tự: ngày huỷ ghi bên nguồn, không có thì ngày hết hạn, không có nữa thì kỳ cước cuối.
        Nguồn cầm tay không ghi lý do huỷ nên báo cáo này không có phần lý do.
      </p>

      <p className="actions">
        <Link href={link({ thang: moThang || undefined })}>
          <button type="button" className={loai === "" ? "primary" : undefined}>
            tất cả
          </button>
        </Link>
        {LOAI.filter((l) => tatCa.some((r) => r.loai_khach === l)).map((l) => (
          <Link key={l} href={link({ loai: l, thang: moThang || undefined })}>
            <button type="button" className={loai === l ? "primary" : undefined}>
              {TEN_LOAI[l] ?? l}
            </button>
          </Link>
        ))}
        {/* Thẻ a thường: trả về tệp tải xuống, không phải trang. */}
        <a href={`/cam-tay/huy/xuat?${new URLSearchParams(loai ? { loai } : {})}`} download>
          <button type="button">Xuất Excel</button>
        </a>
      </p>

      <div className="the-hang">
        <div className="the-so">
          <div className="the-ten">Tỉ lệ huỷ trung bình</div>
          <div className="the-gia-tri mono">{tbTyLe === null ? "—" : `${tbTyLe}%`}</div>
          <div className="the-phu">{ganDay.length} tháng gần nhất đã xong</div>
        </div>
        <div className="the-so">
          <div className="the-ten">Đang chạy</div>
          <div className="the-gia-tri mono">{n(thangNay?.cuoi_ky ?? null)}</div>
          <div className="the-phu">cuối {thangNay?.thang ?? "—"}</div>
        </div>
        <div className="the-so">
          <div className="the-ten">Huỷ tháng này</div>
          <div className="the-gia-tri mono bad">{n(thangNay?.huy ?? null)}</div>
          <div className="the-phu">
            {thangNay?.thang_chua_xong ? "tháng chưa xong" : "tháng đã xong"} · mới{" "}
            {n(thangNay?.moi ?? null)}
          </div>
        </div>
      </div>

      <h2>Mới và huỷ theo tháng</h2>
      <Bars
        nhan={bieuDo.map((r) => r.thang)}
        cao={170}
        chuoi={[
          { ten: "Mới", mau: "var(--ok)", gia_tri: bieuDo.map((r) => Number(r.moi)) },
          { ten: "Huỷ", mau: "var(--bad)", gia_tri: bieuDo.map((r) => Number(r.huy)) },
        ]}
      />

      <div className="scroller">
        <table className="bang-thang">
          <thead>
            <tr>
              <th>Tháng</th>
              <th className="num" title="Thuê bao đang chạy lúc đầu tháng">
                Đầu kỳ
              </th>
              <th className="num">Mới</th>
              <th className="num">Huỷ</th>
              <th className="num">Cuối kỳ</th>
              <th>Tỉ lệ huỷ</th>
            </tr>
          </thead>
          <tbody>
            {thang.map((r) => {
              const ty = r.ty_le_huy === null ? null : Number(r.ty_le_huy);
              return (
                <Dong
                  key={r.thang}
                  href={link({ loai: loai || undefined, thang: r.thang })}
                  dangMo={moThang === r.thang}
                >
                  <td className="mono">
                    {r.thang}
                    {r.thang_chua_xong && <span className="chip cam"> chưa xong</span>}
                  </td>
                  <td className="num mono muted">{n(r.dau_ky)}</td>
                  <td className="num mono">{n(r.moi)}</td>
                  <td className="num mono bad">{n(r.huy)}</td>
                  <td className="num mono">{n(r.cuoi_ky)}</td>
                  <td>
                    {ty === null ? (
                      <span className="muted">—</span>
                    ) : (
                      <span className="bar">
                        <span
                          className="bar-fill xau"
                          style={{ width: `${Math.min(ty * 2, 100)}%` }}
                        />
                        <span className="bar-label mono">{ty}%</span>
                      </span>
                    )}
                  </td>
                </Dong>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>Huỷ theo loại khách</h2>
      <p className="muted">
        Ba loại khách có nhịp huỷ khác hẳn nhau nên không cộng chung được. Đại lý huỷ theo đợt:
        tháng 3 và 4/2026 có 408 và 437 thuê bao cùng ngừng đúng ngày cuối tháng, 726 trong số
        đó của ba đại lý — Teki A Duân 623, Tuấn BĐS 62, Trưởng 41. Trộn vào thì tỉ lệ chung
        hai tháng đó vọt lên 26% và 34%, che mất nhịp thật của khách lẻ.
      </p>
      <div className="scroller">
        <table className="bang-thang">
          <thead>
            <tr>
              <th rowSpan={2}>Tháng</th>
              {coLoai.map((l) => (
                <th key={l} colSpan={2} className="nhom">
                  {TEN_LOAI[l] ?? l}
                </th>
              ))}
            </tr>
            <tr>
              {coLoai.map((l) => (
                <Fragment key={l}>
                  <th className="num">Huỷ</th>
                  <th className="num">Tỉ lệ</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {cacThang.map((t) => (
              <tr key={t}>
                <td className="mono">{t}</td>
                {coLoai.map((l) => {
                  const r = o(t, l);
                  const ty = r?.ty_le_huy === null || r === undefined ? null : Number(r.ty_le_huy);
                  return (
                    <Fragment key={`${t}-${l}`}>
                      <td className="num mono">{r && Number(r.huy) > 0 ? n(r.huy) : "—"}</td>
                      <td className={`num mono${ty !== null && ty >= 20 ? " bad" : " muted"}`}>
                        {ty === null ? "—" : `${ty}%`}
                      </td>
                    </Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="muted khoi-ghi-chu">
        Thanh tỉ lệ ở bảng trên vẽ theo thang 50% cho kín chỗ, nên thanh đầy nghĩa là huỷ từ
        một nửa số thuê bao trở lên. Tỉ lệ từ 20% trở lên tô đỏ. Tháng “chưa xong” mới chạy
        được một phần nên không đem ra so với tháng đủ.
      </p>

      {moThang && (
        <ChiTietHuy thang={moThang} loaiKhach={loai} dongLai={link({ loai: loai || undefined })} />
      )}
    </>
  );
}
