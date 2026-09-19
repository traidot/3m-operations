import Link from "next/link";
import { ThanBam } from "../../than-bam";
import { ChipLoaiKhach } from "../../chip";
import { ChiTietMay } from "./chi-tiet";
import { getTelecomMay, type TelecomMay } from "@/lib/queries";
import { COC, MAY, MAY_CUOC } from "@/lib/nhan";

export const dynamic = "force-dynamic";

const n = (v: string | null) => (v === null ? "—" : Number(v).toLocaleString("vi-VN"));

type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const cong = (rows: TelecomMay[], k: keyof TelecomMay) =>
  rows.reduce((t, r) => t + Number(r[k] ?? 0), 0);

/**
 * Lọc theo việc phải làm, không phải theo trạng thái thô của nguồn. Bốn nhóm
 * đầu là bốn việc khác nhau, đừng gộp chung thành "chưa ra cước".
 */
const LOC: Record<string, { ten: string; hop: (r: TelecomMay) => boolean }> = {
  hut_cuoc: { ten: "hụt cước", hop: (r) => r.tinh_trang_cuoc === "HUT_CUOC" },
  tb_da_xoa: { ten: "thuê bao đã xoá", hop: (r) => r.tinh_trang_cuoc === "TB_DA_XOA" },
  chua_gan: { ten: "chưa gắn thuê bao", hop: (r) => r.tinh_trang_cuoc === "CHUA_GAN" },
  huy_chua_thu_may: {
    ten: "huỷ rồi, chưa thu máy",
    hop: (r) => r.tinh_trang_cuoc === "HUY_CHUA_THU_MAY",
  },
  dang_ra_cuoc: { ten: "đang ra cước", hop: (r) => r.tinh_trang_cuoc === "DANG_RA_CUOC" },
  con_no: { ten: "còn nợ cước", hop: (r) => Number(r.chua_thu) > 0 },
  chua_tra: { ten: "chưa trả máy", hop: (r) => r.trang_thai === "NOT_RETURNED" },
  da_tra: { ten: "đã trả", hop: (r) => r.trang_thai === "RETURNED" },
};

const dem = (rows: TelecomMay[], ma: string) =>
  rows.filter((r) => r.tinh_trang_cuoc === ma).length;

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
        máy giữa chừng, nên kỳ ngoài khoảng là cước của máy khác. Máy cầm tay <b>chính là dịch
        vụ</b>, nên máy còn nằm ở khách thì tháng nào cũng phải ra cước — cột Cước xếp mỗi
        máy vào đúng một trong sáu tình trạng. Bấm vào một dòng để xem từng kỳ. Không phân
        trang: cả {n(String(tatCa.length))} máy nằm trên một trang.
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
          <div className="the-ten">Hụt cước</div>
          <div className="the-gia-tri mono bad">{n(String(dem(tatCa, "HUT_CUOC")))}</div>
          <div className="the-phu">
            máy còn ngoài, thuê bao vẫn chạy mà không ra cước — ước tính{" "}
            {n(String(cong(tatCa, "tien_hut_uoc")))} yên
          </div>
        </div>
      </div>

      <p className="stale">
        <b>
          {n(String(tatCa.filter((r) => r.trang_thai !== "RETURNED").length))} máy còn nằm ở
          khách, nhưng chỉ {n(String(dem(tatCa, "DANG_RA_CUOC")))} cái đang ra cước.
        </b>{" "}
        {n(String(tatCa.length - dem(tatCa, "DANG_RA_CUOC") - dem(tatCa, "DA_TRA")))} cái còn
        lại là bốn việc khác nhau:{" "}
        <b>{n(String(dem(tatCa, "HUT_CUOC")))}</b> máy thuê bao vẫn ACTIVE mà ngừng ra cước —
        đây là tiền, ước tính {n(String(cong(tatCa, "tien_hut_uoc")))} yên;{" "}
        <b>{n(String(dem(tatCa, "HUY_CHUA_THU_MAY")))}</b> máy thuê bao đã huỷ nên không ra
        cước là đúng, nhưng máy chưa đòi về được và{" "}
        {n(String(cong(tatCa.filter((r) => r.tinh_trang_cuoc === "HUY_CHUA_THU_MAY" && r.trang_thai_coc === "PENDING"), "coc")))}{" "}
        yên cọc vẫn đang treo; <b>{n(String(dem(tatCa, "CHUA_GAN")))}</b> máy đưa ra mà chưa
        mở dịch vụ lần nào; <b>{n(String(dem(tatCa, "TB_DA_XOA")))}</b> máy có gắn thuê bao
        nhưng hồ sơ thuê bao đã bị xoá bên nguồn.
      </p>

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
                <th>Cước</th>
                <th>Tình trạng máy</th>
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
                  <td className="mono">{r.imei}</td>
                  <td>
                    <span
                      className={`chip ${
                        r.tinh_trang_cuoc === "HUT_CUOC"
                          ? "xau"
                          : r.tinh_trang_cuoc === "DANG_RA_CUOC" || r.tinh_trang_cuoc === "DA_TRA"
                            ? "ok"
                            : "cho"
                      }`}
                    >
                      {MAY_CUOC[r.tinh_trang_cuoc] ?? r.tinh_trang_cuoc}
                    </span>
                    {Number(r.thang_hut) > 0 && (
                      <div className="mono muted">
                        {n(r.thang_hut)} tháng
                        {Number(r.tien_hut_uoc) > 0 && ` · ~${n(r.tien_hut_uoc)}`}
                      </div>
                    )}
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
