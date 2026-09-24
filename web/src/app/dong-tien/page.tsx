import Link from "next/link";
import { NganKeo } from "../ngan-keo";
import {
  getDotThuChotLuc, getDotThuCoDinhThang, getThangCoSoLieu, type DotThuCoDinh,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

const n = (v: string | number | null) =>
  v === null ? "—" : Number(v).toLocaleString("vi-VN");

type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const CHUA_GHI = "CHUA_GHI";
const TRU_COC = "cần trừ cọc";

/** Số tháng cho người dùng bấm chọn; xa hơn thì gõ thẳng vào ô. */
const SO_THANG_HIEN = 14;

const tong = (rows: DotThuCoDinh[]) =>
  rows.reduce((t, r) => t + Number(r.so_tien), 0);

/** Đợt về sớm hơn kỳ, đúng tháng của kỳ, hay muộn hơn. */
const nhip = (r: DotThuCoDinh) =>
  r.thang_tien_ve < r.ky ? "truoc" : r.thang_tien_ve === r.ky ? "dung" : "muon";

const TEN_TK: Record<string, string> = { [CHUA_GHI]: "(chưa ghi tài khoản)" };

export default async function Page({ searchParams }: { searchParams: Promise<Tham> }) {
  const sp = await searchParams;
  const [danhSachThang, chot] = await Promise.all([getThangCoSoLieu(), getDotThuChotLuc()]);
  const thang = mot(sp.thang) || danhSachThang.find((t) => t.thang <= new Date().toISOString().slice(0, 7))?.thang
    || danhSachThang[0]?.thang || new Date().toISOString().slice(0, 7);
  const tatCa = await getDotThuCoDinhThang(thang);
  const [, m] = thang.split("-");

  // Khối 1 — trục KỲ CƯỚC. Đúng bộ lọc của "Báo cáo thống kê cước phí" bên CMS,
  // nên tổng ở đây phải khớp từng đồng với ô "Tổng đã thu" của tháng đó.
  const theoKy = tatCa.filter((r) => r.ky === thang && r.vao_bao_cao_cuoc);
  // Khối 2 — trục NGÀY TIỀN VỀ. Cùng dòng tiền, câu hỏi khác.
  const theoTienVe = tatCa.filter((r) => r.thang_tien_ve === thang);

  const taiKhoan = [...new Set(theoKy.map((r) => r.tai_khoan))].sort(
    (a, b) => tong(theoKy.filter((r) => r.tai_khoan === b)) - tong(theoKy.filter((r) => r.tai_khoan === a)),
  );
  const tienNganHang = tong(theoKy.filter((r) => !r.can_tru_coc));

  const nhomKy = [
    { ma: "truoc", ten: "Kỳ trước — trả nợ kỳ cũ", rows: theoTienVe.filter((r) => r.ky < thang) },
    { ma: "dung", ten: `Kỳ ${thang} — đúng kỳ`, rows: theoTienVe.filter((r) => r.ky === thang) },
    { ma: "sau", ten: "Kỳ sau — khách nộp trước", rows: theoTienVe.filter((r) => r.ky > thang) },
  ];

  const mo = mot(sp.tk);
  const moRows = mo ? theoKy.filter((r) => r.tai_khoan === mo) : [];

  const thangGan = danhSachThang.slice(0, SO_THANG_HIEN).reverse();

  return (
    <main>
      <h1>Kỳ cước và dòng tiền · tháng {Number(m)}/{thang.slice(0, 4)}</h1>
      <p className="muted">
        Wifi cố định. Hai báo cáo bên CMS đo cùng một dòng tiền bằng <b>hai trục khác nhau</b> —
        một cái theo <b>kỳ cước</b> (tiền này là cước tháng nào), một cái theo <b>ngày tiền về</b>
        {" "}(tiền vào tháng nào). 3M thu trước một tháng nên hai trục lệch gần đúng một nhịp;
        đặt cạnh nhau ở đây để nhìn ra chỗ lệch chứ không phải để chúng bằng nhau.
      </p>
      <p className="muted">
        Số liệu chốt lúc{" "}
        <b>{chot[0]?.chot_luc?.slice(0, 16).replace("T", " ") ?? "chưa rõ"}</b> — bên CMS nhân
        viên vẫn đang nhập phiếu, nên so hai bên phải so cùng thời điểm.
      </p>

      <p className="actions">
        {thangGan.map((t) => (
          <Link key={t.thang} href={`/dong-tien?thang=${t.thang}`}>
            <button type="button" className={t.thang === thang ? "primary" : undefined}>
              {t.thang}
            </button>
          </Link>
        ))}
      </p>

      <h2>1 · Cước kỳ {thang} đã thu {n(tong(theoKy))} — về những tài khoản nào</h2>
      <p className="muted">
        Con số này dựng đúng bộ lọc của <b>Báo cáo thống kê cước phí</b> bên CMS, nên phải khớp
        từng đồng với ô &ldquo;Tổng đã thu&rdquo; của tháng {Number(m)}. Khác với báo cáo tài khoản
        thu của CMS, ở đây <b>không đợt nào bị bỏ rơi</b>: đợt chưa ghi tài khoản vẫn có dòng riêng.
        Bấm một tài khoản để xem từng đợt.
      </p>
      <div className="scroller">
        <table className="bang-thang">
          <thead>
            <tr>
              <th>Tài khoản</th>
              <th className="num">Số đợt</th>
              <th className="num">Thu trước tháng {Number(m)}</th>
              <th className="num">Thu trong tháng {Number(m)}</th>
              <th className="num">Thu sau tháng {Number(m)}</th>
              <th className="num">Tổng</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {taiKhoan.map((tk) => {
              const d = theoKy.filter((r) => r.tai_khoan === tk);
              const canh =
                tk === TRU_COC
                  ? "cọc khách nộp trước qua combini, nay trừ sang cước — giao dịch ngân hàng nằm ở tháng nộp cọc"
                  : tk === CHUA_GHI
                    ? "báo cáo tài khoản thu của CMS loại thẳng nhóm này"
                    : null;
              return (
                <tr key={tk}>
                  <td>
                    <Link href={`/dong-tien?thang=${thang}&tk=${encodeURIComponent(tk)}`}>
                      {TEN_TK[tk] ?? tk}
                    </Link>
                    {canh && <div className="muted">{canh}</div>}
                  </td>
                  <td className="num mono muted">{n(d.length)}</td>
                  {["truoc", "dung", "muon"].map((k) => (
                    <td key={k} className="num mono">
                      {n(tong(d.filter((r) => nhip(r) === k)))}
                    </td>
                  ))}
                  <td className="num mono">{n(tong(d))}</td>
                  <td className="khong-xuong-dong">
                    <Link href={`/dong-tien?thang=${thang}&tk=${encodeURIComponent(tk)}`}>
                      xem →
                    </Link>
                  </td>
                </tr>
              );
            })}
            <tr className="hang-tong">
              <td>
                <b>Tổng đã thu của kỳ {thang}</b>
              </td>
              <td className="num mono">{n(theoKy.length)}</td>
              {["truoc", "dung", "muon"].map((k) => (
                <td key={k} className="num mono">
                  {n(tong(theoKy.filter((r) => nhip(r) === k)))}
                </td>
              ))}
              <td className="num mono">{n(tong(theoKy))}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      <p className="muted">
        Trong đó <b>{n(tienNganHang)} có giao dịch ngân hàng gắn với chính kỳ này</b>;{" "}
        {n(tong(theoKy.filter((r) => r.can_tru_coc)))} còn lại là <b>cấn trừ cọc</b> — tiền
        thật, khách đã nộp trước qua combini, nhưng sao kê ghi ở tháng nộp cọc chứ không phải
        tháng này, nên đừng đi tìm nó trong sao kê của kỳ này. Cột &ldquo;thu trước&rdquo; là
        tiền đã về từ các tháng trước, cột &ldquo;thu sau&rdquo; nghĩa là kỳ này{" "}
        <b>vẫn đang thu tiếp</b> nên con số còn tăng.
      </p>

      <h2>2 · Tiền về trong tháng {Number(m)} là cước của kỳ nào</h2>
      <p className="muted">
        Đây là câu hỏi <b>khác</b> với khối 1, và là thứ báo cáo tài khoản thu của CMS đang trả
        lời. Cùng một dòng tiền nhưng cắt theo ngày tiền vào, nên tổng không bằng khối 1 — đó là
        bình thường, không phải lệch số.
      </p>
      <div className="scroller">
        <table className="bang-thang">
          <thead>
            <tr>
              <th>Nhóm kỳ</th>
              <th className="num">Số đợt</th>
              <th className="num">Số tiền</th>
              <th className="num">Tỉ lệ</th>
            </tr>
          </thead>
          <tbody>
            {nhomKy.map((g) => (
              <tr key={g.ma}>
                <td>{g.ten}</td>
                <td className="num mono muted">{n(g.rows.length)}</td>
                <td className="num mono">{n(tong(g.rows))}</td>
                <td className="num mono muted">
                  {((tong(g.rows) / Math.max(tong(theoTienVe), 1)) * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
            <tr className="hang-tong">
              <td>
                <b>Tổng tiền về trong tháng {Number(m)}</b>
              </td>
              <td className="num mono">{n(theoTienVe.length)}</td>
              <td className="num mono">{n(tong(theoTienVe))}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <h2>3 · Cờ cảnh báo</h2>
      <p className="muted">
        Hai cột tách riêng vì một đợt có thể thuộc khối này mà không thuộc khối kia.
      </p>
      <div className="scroller">
        <table className="bang-thang">
          <thead>
            <tr>
              <th>Cần xử lý</th>
              <th className="num">Ở khối 1 (kỳ {thang})</th>
              <th className="num">Ở khối 2 (tiền về T{Number(m)})</th>
              <th>Việc</th>
            </tr>
          </thead>
          <tbody>
            {[
              {
                ten: "Đợt chưa ghi tài khoản thu",
                hop: (r: DotThuCoDinh) => r.tai_khoan === CHUA_GHI,
                viec: "Người thu mở đợt, chọn tài khoản đã nhận tiền",
                nang: true,
              },
              {
                ten: "Đợt hoặc phiếu cha chưa duyệt",
                hop: (r: DotThuCoDinh) => r.cho_duyet,
                viec: "Duyệt nốt; soát các đợt số tiền lẻ trước khi duyệt",
                nang: true,
              },
              {
                ten: "Phiếu cha đã bị xoá ở nguồn",
                hop: (r: DotThuCoDinh) => r.phieu_da_xoa,
                viec: "Đợt còn sống mà phiếu cha mất — kiểm tra trên CMS",
                nang: true,
              },
              {
                ten: "Cấn trừ cọc — không phải tiền mặt",
                hop: (r: DotThuCoDinh) => r.can_tru_coc,
                viec: "Không phải lỗi, chỉ cần nhớ trừ ra khi đối chiếu ngân hàng",
                nang: false,
              },
            ].map((c) => {
              const a = tong(tatCa.filter((r) => r.ky === thang && r.vao_bao_cao_cuoc && c.hop(r)));
              const b = tong(tatCa.filter((r) => r.thang_tien_ve === thang && c.hop(r)));
              if (a === 0 && b === 0) return null;
              return (
                <tr key={c.ten}>
                  <td>{c.ten}</td>
                  <td className={`num mono${a > 0 && c.nang ? " bad" : ""}`}>{a === 0 ? "—" : n(a)}</td>
                  <td className={`num mono${b > 0 && c.nang ? " bad" : ""}`}>{b === 0 ? "—" : n(b)}</td>
                  <td className="muted">{c.viec}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="actions">
        <a href={`/dong-tien/xuat?thang=${thang}`}>
          <button type="button" className="primary">
            Xuất Excel tháng {Number(m)}
          </button>
        </a>
      </p>

      <p className="muted khoi-ghi-chu">
        Màn hình này <b>không dựng lại &ldquo;tổng phải thu&rdquo; và &ldquo;chưa thu&rdquo;</b> của
        CMS. Hai số đó tính theo luật dồn tích riêng bên đó (khoảng thu phí của từng hợp đồng,
        tháng miễn phí, khoản tất toán tay), dựng lại mà lệch một đồng thì hại hơn là không có —
        cần thì xem thẳng ở Báo cáo thống kê cước phí.
      </p>

      {mo && (
        <NganKeo dongLai={`/dong-tien?thang=${thang}`}>
          <h1>{TEN_TK[mo] ?? mo}</h1>
          <p className="muted">
            Cước kỳ {thang} đã thu qua tài khoản này: {n(tong(moRows))} yên, {n(moRows.length)} đợt.
          </p>
          <div className="scroller">
            <table>
              <thead>
                <tr>
                  <th>Mã hợp đồng</th>
                  <th>Địa chỉ lắp</th>
                  <th className="num">Cước tháng</th>
                  <th>Ngày thu</th>
                  <th className="num">Số tiền</th>
                  <th>Nhịp</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {moRows.map((r) => (
                  <tr key={r.source_id}>
                    <td className="mono">{r.ma_hd ?? "—"}</td>
                    <td className="muted">{r.dia_chi ?? "—"}</td>
                    <td className="num mono muted">{n(r.cuoc_thang)}</td>
                    <td className="mono">{r.ngay_thu ?? "chưa ghi ngày"}</td>
                    <td className="num mono">{n(r.so_tien)}</td>
                    <td className="muted">
                      {nhip(r) === "truoc"
                        ? `thu trước, từ ${r.thang_tien_ve}`
                        : nhip(r) === "muon"
                          ? `thu muộn, sang ${r.thang_tien_ve}`
                          : "đúng tháng"}
                    </td>
                    <td className="muted">
                      {r.cho_duyet ? <span className="chip cho">chờ duyệt</span> : r.trang_thai_dot}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </NganKeo>
      )}
    </main>
  );
}
