import Link from "next/link";
import { ThanBam } from "../../than-bam";
import { ChipLoaiKhach } from "../../chip";
import { ChiTietMay } from "./chi-tiet";
import { getTelecomMay, type TelecomMay } from "@/lib/queries";
import { COC, MAY } from "@/lib/nhan";

export const dynamic = "force-dynamic";

const n = (v: string | null) => (v === null ? "—" : Number(v).toLocaleString("vi-VN"));

type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const cong = (rows: TelecomMay[], k: keyof TelecomMay) =>
  rows.reduce((t, r) => t + Number(r[k] ?? 0), 0);

/** Lọc theo việc phải làm, không phải theo trạng thái thô của nguồn. */
const LOC: Record<string, { ten: string; hop: (r: TelecomMay) => boolean }> = {
  chua_ra_cuoc: {
    ten: "chưa ra cước",
    hop: (r) => r.chua_ra_cuoc,
  },
  con_no: { ten: "còn nợ cước", hop: (r) => Number(r.chua_thu) > 0 },
  chua_tra: { ten: "chưa trả máy", hop: (r) => r.trang_thai === "NOT_RETURNED" },
  dang_thue: { ten: "đang thuê", hop: (r) => r.trang_thai === "RENTING" },
  da_tra: { ten: "đã trả", hop: (r) => r.trang_thai === "RETURNED" },
};

export default async function Page({ searchParams }: { searchParams: Promise<Tham> }) {
  const sp = await searchParams;
  const tatCa = await getTelecomMay();

  const loc = mot(sp.loc) in LOC ? mot(sp.loc) : "";
  const tim = mot(sp.q).trim().toLowerCase();
  let rows = loc ? tatCa.filter(LOC[loc]!.hop) : tatCa;
  if (tim) {
    rows = rows.filter((r) =>
      [r.imei, r.ma_khach, r.khach, r.thue_bao_hien_tai]
        .some((v) => v?.toLowerCase().includes(tim)),
    );
  }

  const moMay = mot(sp.xem);
  const link = (t: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(t)) if (v) p.set(k, v);
    const duoi = p.toString();
    return duoi ? `/cam-tay/may?${duoi}` : "/cam-tay/may";
  };

  return (
    <main>
      <h1>Máy wifi cầm tay</h1>
      <p className="muted">
        Một dòng một <b>máy</b> — gom theo IMEI, kèm lịch sử thu cước của chính máy đó. Bên
        nguồn ghi từng <b>lượt cho thuê</b>: 3.048 bản ghi nhưng chỉ {n(String(tatCa.length))}{" "}
        máy, có cái cho thuê tới sáu lượt. Tình trạng lấy theo lượt mới nhất. Cước tính theo
        khoảng máy ở với từng thuê bao — một máy đi qua nhiều thuê bao, một thuê bao có thể đổi
        máy giữa chừng, nên kỳ ngoài khoảng là cước của máy khác. Bấm vào một dòng để xem từng
        kỳ. Không phân trang: cả {n(String(tatCa.length))} máy nằm trên một trang.
      </p>

      <div className="the-hang">
        <div className="the-so">
          <div className="the-ten">Máy đang ở ngoài</div>
          <div className="the-gia-tri mono">
            {n(String(tatCa.filter((r) => r.trang_thai !== "RETURNED").length))}
          </div>
          <div className="the-phu">
            {n(String(tatCa.filter((r) => r.trang_thai === "NOT_RETURNED").length))} cái quá hạn
            chưa trả
          </div>
        </div>
        <div className="the-so">
          <div className="the-ten">Cọc đang giữ</div>
          <div className="the-gia-tri mono">
            {n(String(cong(tatCa.filter((r) => r.trang_thai_coc === "PENDING"), "coc")))}
          </div>
          <div className="the-phu">
            {n(String(tatCa.filter((r) => r.trang_thai_coc === "PENDING").length))} máy
          </div>
        </div>
        <div className="the-so">
          <div className="the-ten">Cước chưa thu</div>
          <div className="the-gia-tri mono bad">{n(String(cong(tatCa, "chua_thu")))}</div>
          <div className="the-phu">
            trên tổng phải thu {n(String(cong(tatCa, "phai_thu")))}
          </div>
        </div>
        <div className="the-so">
          <div className="the-ten">Chưa ra cước</div>
          <div className="the-gia-tri mono bad">
            {n(String(tatCa.filter((r) => r.chua_ra_cuoc).length))}
          </div>
          <div className="the-phu">máy chưa trả mà không có kỳ nào</div>
        </div>
      </div>

      <form method="get">
        <div className="formgrid">
          <label>
            IMEI, mã khách, tên khách hoặc mã thuê bao
            <input type="text" name="q" defaultValue={mot(sp.q)} placeholder="IMEI, KH…" />
          </label>
          <div className="actions">
            <button className="primary" type="submit">
              Tìm
            </button>
            <Link href="/cam-tay/may">
              <button type="button">Bỏ lọc</button>
            </Link>
          </div>
        </div>
      </form>

      <p className="actions">
        <Link href={link({ q: mot(sp.q) || undefined })}>
          <button type="button" className={loc === "" ? "primary" : undefined}>
            Tất cả · {n(String(tatCa.length))}
          </button>
        </Link>
        {Object.entries(LOC).map(([ma, { ten, hop }]) => (
          <Link key={ma} href={link({ loc: ma, q: mot(sp.q) || undefined })}>
            <button type="button" className={loc === ma ? "primary" : undefined}>
              {ten} · {n(String(tatCa.filter(hop).length))}
            </button>
          </Link>
        ))}
      </p>

      <p className="muted">
        {n(String(rows.length))} máy
        {loc && ` · ${LOC[loc]!.ten}`}
        {tim && ` · tìm “${mot(sp.q)}”`}
      </p>

      {rows.length === 0 ? (
        <p className="empty">Không có máy nào khớp.</p>
      ) : (
        <div className="scroller">
          <table className="bang-thang">
            <thead>
              <tr>
                <th>IMEI</th>
                <th>Tình trạng</th>
                <th>Khách đang giữ</th>
                <th className="num">Cọc</th>
                <th className="num" title="Số lượt cho thuê của chính máy này, và số lượt gắn vào thuê bao">
                  Lượt
                </th>
                <th>Kỳ cước</th>
                <th className="num">Phải thu</th>
                <th className="num">Đã thu</th>
                <th className="num">Chưa thu</th>
              </tr>
            </thead>
            <ThanBam>
              {rows.map((r) => (
                <tr
                  key={r.imei}
                  data-href={link({ loc: loc || undefined, q: mot(sp.q) || undefined, xem: r.imei })}
                  className={moMay === r.imei ? "dang-mo" : undefined}
                >
                  <td className="mono">
                    {r.imei}
                    {r.chua_ra_cuoc && <div className="chip xau">chưa ra cước</div>}
                  </td>
                  <td>
                    <span className={`chip ${r.trang_thai === "NOT_RETURNED" ? "xau" : r.trang_thai === "RETURNED" ? "tat" : "ok"}`}>
                      {MAY[r.trang_thai ?? ""] ?? r.trang_thai ?? "—"}
                    </span>
                    <div className="mono muted">
                      {r.ngay_thue ?? "—"} → {r.ngay_tra ?? "chưa trả"}
                    </div>
                  </td>
                  <td>
                    {r.thue_bao_hien_tai ? (
                      <>
                        <span className="hai-dong">{r.khach}</span>
                        <div>
                          <ChipLoaiKhach ma={r.loai_khach} />
                        </div>
                      </>
                    ) : (
                      <span className="muted">chưa gắn thuê bao</span>
                    )}
                  </td>
                  <td className="num mono">
                    {n(r.coc)}
                    <div className="muted">{COC[r.trang_thai_coc ?? ""] ?? "—"}</div>
                  </td>
                  <td className="num mono muted">
                    {n(r.so_luot_thue)} thuê
                    <div>{n(r.so_lan_gan)} gắn</div>
                  </td>
                  <td className="mono muted">
                    {r.ky_dau ? `${r.ky_dau} → ${r.ky_cuoi}` : "—"}
                    <div>{n(r.so_ky)} kỳ</div>
                  </td>
                  <td className="num mono">{n(r.phai_thu)}</td>
                  <td className="num mono muted">{n(r.da_thu)}</td>
                  <td className={`num mono${Number(r.chua_thu) > 0 ? " bad" : " muted"}`}>
                    {Number(r.chua_thu) > 0 ? n(r.chua_thu) : "—"}
                  </td>
                </tr>
              ))}
            </ThanBam>
          </table>
        </div>
      )}

      <p className="muted khoi-ghi-chu">
        Danh sách này chỉ gồm máy trong diện <b>cho thuê</b> bên nguồn. Lịch sử gắn máy ghi theo
        mã máy bất kể có thuộc diện cho thuê hay không, nên còn hơn một nghìn mã máy khác từng
        gắn thuê bao mà không có hồ sơ máy — thường là máy khách tự có. Một chỗ dữ liệu nguồn
        cần lưu ý: nhiều lượt thuê cũ vẫn để “đang thuê” dù máy đã cho người khác thuê lại, nên
        tình trạng phải đọc theo lượt mới nhất chứ không đếm theo bản ghi.
      </p>

      {moMay && (
        <ChiTietMay
          imei={moMay}
          dongLai={link({ loc: loc || undefined, q: mot(sp.q) || undefined })}
        />
      )}
    </main>
  );
}
