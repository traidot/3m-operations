import { Chip } from "../chip";
import { NganKeo } from "../ngan-keo";
import {
  getContract,
  getContractPeriods,
  getContractUrl,
  type ContractPeriod,
} from "@/lib/queries";
import {
  CANH_BAO,
  CANH_BAO_NANG,
  HOP_DONG,
  KHONG_SINH_KY,
  KY_CUOC,
  LAP_DAT,
  LY_DO_HUY,
  TINH_TRANG_CUOC,
} from "@/lib/nhan";

const n = (v: string | null) =>
  v === null ? "—" : Number(v).toLocaleString("vi-VN");

/** Kỳ chưa thu và kỳ mới chỉ ghi chú đều là việc còn dang dở, tô đỏ. */
const DO = new Set(["NO", "CHO_DUYET", "GHI_CHU"]);

/** Cùng một trạng thái "NO" nhưng ba nghĩa khác nhau, tách ra ở đây. */
function nhanKy(k: ContractPeriod): { chu: string; do: boolean } {
  if (k.trang_thai !== "NO") {
    return { chu: KY_CUOC[k.trang_thai] ?? k.trang_thai, do: DO.has(k.trang_thai) };
  }
  if (Number(k.coc_cho_duyet) > 0) return { chu: KY_CUOC.CHO_COC!, do: false };
  if (!k.qua_han) return { chu: KY_CUOC.CHUA_DEN_HAN!, do: false };
  return { chu: KY_CUOC.NO!, do: true };
}

function O({
  ten,
  gia_tri,
  do: tomau,
  children,
}: {
  ten: string;
  gia_tri?: string;
  do?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <dt>{ten}</dt>
      <dd className={tomau ? "bad" : undefined}>{children ?? gia_tri}</dd>
    </div>
  );
}

/** Chi tiết một hợp đồng, hiện trong ngăn kéo bên phải danh sách. */
export async function ChiTiet({
  id,
  dongLai,
}: {
  id: string;
  dongLai: string;
}) {
  const [hd, ky, url] = await Promise.all([
    getContract(id),
    getContractPeriods(id),
    getContractUrl(id),
  ]);

  // Hai mốc rời nhau bên nguồn: thu tới đâu và dịch vụ dừng lúc nào. Lệch bao
  // nhiêu ngày mới là thứ người xem cần, chứ không phải "có lệch".
  const lechKetThuc =
    hd?.fee_end_on && hd.ngay_huy
      ? Math.round(
          (Date.parse(hd.ngay_huy) - Date.parse(hd.fee_end_on)) / 86_400_000,
        )
      : null;
  const lechNang = hd?.canh_bao.includes("HUY_LECH_KY") ?? false;

  return (
    <NganKeo dongLai={dongLai}>
      <h1 className="mono">{hd?.contract_code ?? id}</h1>

      {!hd ? (
        <p className="empty">Không tìm thấy hợp đồng này.</p>
      ) : (
        <>
          <p className="muted">{hd.dia_chi ?? "chưa có địa chỉ lắp"}</p>

          {hd.canh_bao.length > 0 && (
            <p className="actions">
              {hd.canh_bao.map((cb) => (
                <span
                  key={cb}
                  className={`tag ${CANH_BAO_NANG.has(cb) ? "critical" : "warn"}`}
                >
                  {CANH_BAO[cb] ?? cb}
                </span>
              ))}
            </p>
          )}

          {/* Gom theo chuyện chứ không theo thứ tự tiện tay: hợp đồng là danh
              tính và vòng đời, giữa là dịch vụ và giá, phải là tiền. Ba khối
              đứng cạnh nhau nên thêm bớt ô lẻ cũng không xô lệch khối khác. */}
          <div className="nhom-tt">
            <section>
              <h3>Hợp đồng</h3>
              <dl>
                <O ten="trạng thái">
                  <Chip ma={hd.trang_thai_hop_dong} nhan={HOP_DONG} />
                </O>
                <O ten="phụ trách">
                  <span className={`chip ${hd.do_cong_ty ? "ctv" : "tat"}`}>
                    {hd.do_cong_ty ? "công ty" : "đại lý"}
                  </span>
                </O>
                <O ten="ngày ký" gia_tri={hd.ngay_ky ?? "—"} />
                <O ten="ngày huỷ" gia_tri={hd.ngay_huy ?? "chưa huỷ"} />
                {hd.kho_doi && (
                  <O ten="đánh giá">
                    <span className="chip xau">khách khó đòi</span>
                  </O>
                )}
              </dl>
            </section>

            <section>
              <h3>Lắp đặt và gói cước</h3>
              <dl>
                <O ten="lắp đặt">
                  <Chip ma={hd.trang_thai_lap_dat} nhan={LAP_DAT} />
                </O>
                <O ten="lắp xong" gia_tri={hd.ngay_lap_xong ?? "—"} />
                <O ten="gói" gia_tri={hd.goi_cuoc ?? "—"} />
                <O ten="cước/tháng" gia_tri={n(hd.cuoc_thang)} />
                <O ten="bắt đầu thu" gia_tri={hd.fee_start_on ?? "—"} />
                <O
                  ten="kết thúc thu"
                  gia_tri={hd.fee_end_on ?? "chưa đặt"}
                  do={lechNang}
                />
              </dl>
            </section>

            <section>
              <h3>Tiền</h3>
              <dl>
                <O ten="tình trạng">
                  <Chip ma={hd.tinh_trang_cuoc} nhan={TINH_TRANG_CUOC} />
                </O>
                <O
                  ten="tổng kỳ"
                  gia_tri={KHONG_SINH_KY.has(hd.tinh_trang_cuoc) ? "—" : n(hd.so_ky)}
                />
                <O ten="đã thu" gia_tri={n(hd.tong_da_thu)} />
                <O ten="nợ quá hạn" gia_tri={n(hd.con_no)} />
                {Number(hd.coc_cho_duyet) > 0 && (
                  <O ten="cọc chờ duyệt" gia_tri={n(hd.coc_cho_duyet)} />
                )}
                {Number(hd.so_ky_chua_den_han) > 0 && (
                  <O
                    ten="chưa tới hạn"
                    gia_tri={`${n(hd.tien_chua_den_han)} · ${n(hd.so_ky_chua_den_han)} kỳ`}
                  />
                )}
                <O
                  ten="còn phải đòi"
                  gia_tri={n(hd.con_no_sau_coc)}
                  do={Number(hd.con_no_sau_coc) > 0}
                />
              </dl>
            </section>
          </div>

          {lechNang && lechKetThuc !== null && (
            <p className="stale">
              Ngày kết thúc thu lệch ngày huỷ <b>{Math.abs(lechKetThuc)} ngày</b>:{" "}
              {lechKetThuc > 0
                ? `sổ ngừng thu từ ${hd.fee_end_on} nhưng dịch vụ tới ${hd.ngay_huy} mới dừng — mấy tháng ở giữa khách vẫn dùng mà không ra kỳ cước nào.`
                : `dịch vụ dừng từ ${hd.ngay_huy} nhưng sổ vẫn thu tới ${hd.fee_end_on} — phần sau ngày huỷ là thu thừa.`}
            </p>
          )}

          {hd.ly_do_huy && (
            <p className="ly-do">
              <b>Lý do huỷ</b>
              {hd.nhom_ly_do_huy &&
                ` (${LY_DO_HUY[hd.nhom_ly_do_huy] ?? hd.nhom_ly_do_huy})`}
              : “{hd.ly_do_huy}”
            </p>
          )}

          {hd.tinh_trang_cuoc === "CHUA_LAP" && (
            <p className="stale">
              Hợp đồng chưa lắp xong nên không phát sinh cước — 3M không thu gì
              với đơn đã ký mà không lắp được. Kỳ nào hiện dưới đây là dòng đã
              có sẵn trong sổ.
            </p>
          )}

          {hd.tinh_trang_cuoc === "CHUA_TINH_DUOC" && (
            <p className="stale">
              Hợp đồng này thiếu{" "}
              {hd.cuoc_thang === null ? "giá cước" : "ngày bắt đầu thu"} nên hệ
              thống không sinh được kỳ nào. Các kỳ dưới đây chỉ là những dòng đã
              có trong sổ, không biết còn thiếu tháng nào.
            </p>
          )}

          <h2>Cước từng tháng</h2>
          {ky.length === 0 ? (
            <p className="empty">Chưa có kỳ cước nào.</p>
          ) : (
            <div className="scroller">
              <table>
                <thead>
                  <tr>
                    <th>Kỳ</th>
                    <th>Trạng thái</th>
                    <th className="num">Phải thu</th>
                    <th className="num">Đã thu</th>
                    <th className="num">Cọc chờ</th>
                    <th>Kênh</th>
                    <th>Thu lúc</th>
                    <th>Người nhập</th>
                  </tr>
                </thead>
                <tbody>
                  {ky.map((k) => (
                    <tr key={k.ky}>
                      <td className="mono">
                        {k.ky}
                        {k.ngoai_ky_tinh && (
                          <span className="tag warn"> ngoài kỳ</span>
                        )}
                      </td>
                      <td className={nhanKy(k).do ? "bad" : undefined}>
                        {nhanKy(k).chu}
                      </td>
                      {/* Kỳ miễn phí: tiền đã được tha, không phải khoản thu
                          hụt. Vẫn hiện giá cước để biết tha bao nhiêu, nhưng
                          để mờ và không tô đỏ ô "đã thu". */}
                      <td className={`num mono${k.trang_thai === "MIEN_PHI" ? " muted" : ""}`}>
                        {n(k.phai_thu)}
                      </td>
                      <td
                        className={`num mono${
                          k.trang_thai !== "MIEN_PHI" &&
                          k.phai_thu !== null &&
                          k.tien !== null &&
                          Number(k.tien) < Number(k.phai_thu)
                            ? " bad"
                            : ""
                        }`}
                      >
                        {k.trang_thai === "MIEN_PHI" ? <span className="muted">—</span> : n(k.tien)}
                      </td>
                      <td className="num mono">
                        {Number(k.coc_cho_duyet) > 0 ? n(k.coc_cho_duyet) : "—"}
                      </td>
                      <td>{k.kenh || "—"}</td>
                      <td className="mono">{k.thu_luc?.slice(0, 10) ?? "—"}</td>
                      <td>{k.nguoi_nhap || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="muted">
            “Miễn phí” là tháng được tha cước: cột “phải thu” để mờ vì tiền đó
            không còn phải đòi, và kỳ đó không tính vào nợ. “Chỉ ghi chú” và
            “chờ duyệt” thì ngược lại — chưa tính là đã thu nên vẫn nằm trong
            nợ. “Ngoài kỳ” là dòng trong sổ ứng với tháng nằm ngoài khoảng hệ
            thống tính được — trả trước, nhập nhầm năm, hoặc hợp đồng chưa lắp
            nên không có khoảng nào để tính.
          </p>

          {url && (
            <div className="actions">
              <a href={url} target="_blank" rel="noreferrer">
                <button type="button">Mở bên CMS →</button>
              </a>
            </div>
          )}
        </>
      )}
    </NganKeo>
  );
}
