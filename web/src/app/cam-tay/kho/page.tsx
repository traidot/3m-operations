import Link from "next/link";
import { getKhoLanNhap, getKhoMa, type KhoMa } from "@/lib/queries";
import { ChiTietNhom, type Chieu } from "./chi-tiet";
import { VIEC } from "./viec";
import { KHO_PM, LOAI_KHACH, MAU_LOAI_KHACH, MAY_CUOC } from "@/lib/nhan";

const KHO_MA: Record<string, string> = { ...KHO_PM, PM_KHONG_CO: "phần mềm không có mã" };

export const dynamic = "force-dynamic";

const n = (v: string | number | null) =>
  v === null ? "—" : Number(v).toLocaleString("vi-VN");

type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Ba khối của phần file có mà phần mềm không có, tách theo số thứ tự kết luận. */
const KHOI_NGOAI = [
  { ma: "ra-khoi", ten: "Đã ra khỏi công ty", y: "trả lại nhà cung cấp", hop: (k: string) => k === "01" },
  { ma: "sim-dung", ten: "SIM đã dừng", y: "đã huỷ hoặc trả lại nhà mạng", hop: (k: string) => k === "05" || k === "06" },
  { ma: "con-lai", ten: "Còn lại, phải xử lý", y: "sổ có hoặc kiểm kho thấy", hop: (k: string) => !["01", "05", "06"].includes(k) },
];

/** Mã chỉ nằm trên file, phần mềm không có ở bất kỳ bảng nào. */
const chiOFile = (r: KhoMa) => r.file_co && !r.pm_co;

const maKetLuan = (s: string | null) => (s ?? "").slice(0, 2);

/** Thứ tự cố định để bảng không nhảy chỗ giữa hai lần tải. */
const LOAI = ["CUSTOMER", "COLLABORATOR", "AGENCY", ""];

/** Chiều gom số cho ngăn kéo của bước đông mã. */
const CHIEU: Record<string, Chieu> = {
  choDung: { ten: "Theo chỗ đứng", lay: (r) => KHO_MA[r.cho_dung] ?? r.cho_dung },
  doiMay: { ten: "Theo đời máy", lay: (r) => r.doi_may ?? "không rõ đời" },
  kho: { ten: "Theo kho trên phiếu gần nhất", lay: (r) => r.warehouse_name ?? "chưa có phiếu nào" },
  cuoc: {
    ten: "Theo tình trạng cước",
    lay: (r) =>
      r.tinh_trang_cuoc
        ? (MAY_CUOC[r.tinh_trang_cuoc] ?? r.tinh_trang_cuoc)
        : "không có hồ sơ cho thuê",
  },
  khach: { ten: "Theo loại khách", lay: (r) => LOAI_KHACH[r.loai_khach ?? ""] ?? "không rõ loại" },
  file: {
    ten: "Bản đối chiếu có nhắc tới không",
    lay: (r) => (r.file_co ? (r.file_ket_luan ?? "có, không ghi kết luận") : "file không nhắc tới"),
  },
};

/**
 * Bốn bước của phễu, đúng vòng nghiệp vụ: nhập về kho → vận hành trên phần mềm
 * → có khách và dịch vụ → thu được cước. Định nghĩa ở đây để thẻ và ngăn kéo
 * dùng chung một luật.
 */
const BUOC: {
  ma: string; ten: string; mo_ta: string; mau: string;
  hop: (r: KhoMa) => boolean;
  /** Bước đông mã thì gom số theo mấy chiều này thay vì liệt kê. */
  gom?: string[];
}[] = [
  {
    ma: "1",
    ten: "Phần mềm biết",
    mo_ta: "mã thiết bị có chứng từ trong phần mềm",
    mau: "var(--muted)",
    hop: (r) => r.pm_co,
    gom: ["choDung", "doiMay", "kho", "file"],
  },
  {
    ma: "2",
    ten: "Đang ở khách",
    mo_ta: "phiếu gần nhất là phiếu xuất, hoặc hồ sơ cho thuê còn mở",
    mau: "var(--lam)",
    hop: (r) => r.cho_dung === "O_KHACH",
    gom: ["cuoc", "doiMay", "khach", "file"],
  },
  {
    ma: "3",
    ten: "Có gắn dịch vụ",
    mo_ta: "máy ở khách và có thuê bao — hồ sơ cho thuê hoặc bản ghi gắn thuê bao",
    mau: "var(--lam)",
    hop: (r) => r.cho_dung === "O_KHACH" && r.co_thue_bao,
  },
  {
    ma: "4",
    ten: "Đang thu được cước",
    mo_ta: "máy ở khách và tháng này có kỳ cước",
    mau: "var(--ok)",
    hop: (r) => r.cho_dung === "O_KHACH" && r.tinh_trang_cuoc === "DANG_RA_CUOC",
  },
];

/** Một bước của phễu: thanh dài theo tỉ lệ so với bước đầu. */
function Buoc({
  so, tong, ten, phu, mau, href,
}: {
  so: number; tong: number; ten: string; phu: string; mau: string; href: string;
}) {
  return (
    <Link className="pheu-o" href={href}>
      <div className="pheu-dau">
        <span>{ten}</span>
        <b className="mono">{n(so)}</b>
      </div>
      <div className="pheu-thanh">
        <span style={{ width: `${(so / Math.max(tong, 1)) * 100}%`, background: mau }} />
      </div>
      <div className="muted">{phu}</div>
    </Link>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<Tham> }) {
  const sp = await searchParams;
  const [tatCa, lan] = await Promise.all([getKhoMa(), getKhoLanNhap()]);

  const dem = (hop: (r: KhoMa) => boolean) => tatCa.filter(hop).length;

  // Phễu đi từ HIỆN TRẠNG PHẦN MỀM, không đi từ file: file là bản tổng hợp làm
  // tay ở ngoài, lấy nó làm gốc thì mặc nhiên coi nó đúng.
  const pmCo = dem((r) => r.pm_co);
  const oKhach = dem((r) => r.cho_dung === "O_KHACH");
  const coThueBao = dem((r) => r.cho_dung === "O_KHACH" && r.co_thue_bao);
  const dangThu = dem((r) => r.cho_dung === "O_KHACH" && r.tinh_trang_cuoc === "DANG_RA_CUOC");
  const trongKho = dem((r) => r.cho_dung === "TRONG_KHO");
  const fileRieng = dem((r) => r.file_co && !r.pm_co);

  const PHU = [
    "mã thiết bị có chứng từ trong phần mềm",
    `còn ${n(trongKho)} mã trong kho`,
    `${n(oKhach - coThueBao)} máy ở khách mà không gắn thuê bao nào`,
    `${n(oKhach - dangThu)} máy ở khách mà tháng này không ra cước`,
  ];

  const ds = (q: string) => `/cam-tay/kho/danh-sach${q ? `?${q}` : ""}`;
  const viec = VIEC.find((v) => v.ma === mot(sp.viec));
  const buoc = BUOC.find((b) => b.ma === mot(sp.buoc));
  const khoi = KHOI_NGOAI.find((k) => k.ma === mot(sp.khoi));
  const lk = mot(sp.lk);

  return (
    <main>
      <h1>Kho wifi cầm tay</h1>

      <p className="muted">
        Phễu dưới đây đi từ <b>hiện trạng phần mềm</b>. Bản đối chiếu làm tay đặt bên cạnh
        như một lời khai thứ hai chứ không phải thước đo — chưa ai chứng minh nó đúng.
        {lan && (
          <>
            {" "}
            Bản đang dùng: <b>{lan.ten_file}</b>, chốt ngày{" "}
            <b>{lan.sua_luc?.slice(0, 10) ?? "không rõ"}</b>, nhập lúc{" "}
            {lan.nhap_luc.slice(0, 16).replace("T", " ")}.
          </>
        )}
      </p>

      <div className="pheu">
        {BUOC.map((b, i) => (
          <Buoc
            key={b.ma}
            so={dem(b.hop)}
            tong={pmCo}
            mau={b.mau}
            ten={`${b.ma} · ${b.ten}`}
            phu={PHU[i]!}
            href={`/cam-tay/kho?buoc=${b.ma}`}
          />
        ))}
      </div>

      <h2>{n(oKhach)} máy ở khách là của loại khách nào</h2>
      <p className="muted">
        Loại khách đọc từ hồ sơ cho thuê, không có thì đọc từ thuê bao. Máy không gắn dịch
        vụ nào thì không có loại — chỉ biết ai nhận hàng trên phiếu xuất.
      </p>
      <div className="scroller">
        <table className="bang-thang">
          <thead>
            <tr>
              <th>Loại khách</th>
              <th className="num">Máy đang giữ</th>
              <th className="num">Đang ra cước</th>
              <th className="num">Thuê bao đã huỷ</th>
              <th className="num">Không gắn dịch vụ</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {LOAI.map((k) => {
              const d = tatCa.filter(
                (r) => r.cho_dung === "O_KHACH" && (r.loai_khach ?? "") === k,
              );
              if (d.length === 0) return null;
              return (
                <tr key={k || "khong-ro"}>
                  <td>
                    {k ? (
                      <span className={`chip ${MAU_LOAI_KHACH[k] ?? "tat"}`}>
                        {LOAI_KHACH[k] ?? k}
                      </span>
                    ) : (
                      <span className="muted">không biết loại</span>
                    )}
                  </td>
                  <td className="num mono">{n(d.length)}</td>
                  <td className="num mono">
                    {n(d.filter((r) => r.tinh_trang_cuoc === "DANG_RA_CUOC").length)}
                  </td>
                  <td className="num mono">
                    {n(d.filter((r) => r.tinh_trang_cuoc === "HUY_CHUA_THU_MAY").length)}
                  </td>
                  <td className="num mono">{n(d.filter((r) => !r.co_thue_bao).length)}</td>
                  <td className="khong-xuong-dong">
                    <Link href={ds(`cd=O_KHACH&lk=${k || "khong-ro"}`)}>xem →</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted">
        Đại lý gần như không ra cước là đúng — thu cước wifi cầm tay cho đại lý hiện không
        thuộc diện mình quản lý.
      </p>

      <h2>Phần mềm tự mâu thuẫn</h2>
      <p className="muted">
        Đọc bằng chứng từ của chính phần mềm, không cần tới file — nên sai là sai thật.
      </p>
      <BangViec nhom="pm" tatCa={tatCa} />

      <h2>Hai bên ghi khác nhau</h2>
      <p className="muted">
        Chưa kết luận được bên nào sai. Đây là chỗ đáng đi kiểm thực tế trước.
      </p>
      <BangViec nhom="so" tatCa={tatCa} />

      <h2>{n(fileRieng)} mã chỉ có trên file</h2>
      <p className="muted">
        Phần mềm <b>không có mã này ở bất kỳ bảng nào</b> — đã quét cả 11 cột chứa mã thiết
        bị trên 59 bảng bên nguồn, kể cả dòng đã xoá mềm. Nói cách khác chúng chỉ tồn tại
        trên bản đối chiếu làm tay. Bấm một dòng để xem danh sách.
      </p>
      <div className="scroller">
        <table className="bang-thang">
          <thead>
            <tr>
              <th className="num">Số mã</th>
              <th>Khối</th>
              <th className="num">Có trong sổ</th>
              <th className="num">Kiểm kho thấy</th>
              <th className="num">Ghi người giữ</th>
            </tr>
          </thead>
          <tbody>
            {KHOI_NGOAI.map((k) => {
              const d = tatCa.filter(
                (r) => chiOFile(r) && k.hop(maKetLuan(r.file_ket_luan)),
              );
              return (
                <tr key={k.ma}>
                  <td className="num mono">{n(d.length)}</td>
                  <td>
                    <Link href={`/cam-tay/kho?khoi=${k.ma}`}>{k.ten}</Link>
                    <div className="muted">{k.y}</div>
                  </td>
                  <td className="num mono">{n(d.filter((r) => r.file_vi_tri_so !== null).length)}</td>
                  <td className="num mono">{n(d.filter((r) => r.file_kiem_kho !== null).length)}</td>
                  <td className="num mono">{n(d.filter((r) => r.file_nguoi_giu !== null).length)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="actions">
        <Link href={ds("")}>
          <button type="button" className="primary">
            Danh sách đầy đủ {n(tatCa.length)} mã
          </button>
        </Link>
      </p>

      {viec && (
        <ChiTietNhom
          ten={viec.ten}
          mo_ta={viec.vi_sao}
          canh_bao={
            viec.nhom === "so"
              ? "Lệch ở đây chưa kết luận được bên nào sai — file là bản tổng hợp làm tay ở ngoài, chưa ai chứng minh nó đúng. Hai cột dưới là hai lời khai, không phải đúng với sai."
              : undefined
          }
          rows={tatCa.filter(viec.hop)}
          dongLai="/cam-tay/kho"
          baseHref={`/cam-tay/kho?viec=${viec.ma}`}
          lk={lk}
          themLink={ds(`viec=${viec.ma}`)}
        />
      )}

      {khoi && (
        <ChiTietNhom
          ten={khoi.ten}
          mo_ta={`${khoi.y} — phần mềm không có mã nào trong nhóm này`}
          canh_bao="Toàn bộ nhóm này chỉ tồn tại trên bản đối chiếu làm tay. Phần mềm không có mã ở bất kỳ bảng nào, nên không có gì để đối chứng — đúng hay sai phải đi kiểm thực tế."
          rows={tatCa.filter((r) => chiOFile(r) && khoi.hop(maKetLuan(r.file_ket_luan)))}
          dongLai="/cam-tay/kho"
          baseHref={`/cam-tay/kho?khoi=${khoi.ma}`}
          lk={lk}
          chiFile
        />
      )}

      {buoc && (
        <ChiTietNhom
          ten={`Bước ${buoc.ma} · ${buoc.ten}`}
          mo_ta={buoc.mo_ta}
          rows={tatCa.filter(buoc.hop)}
          dongLai="/cam-tay/kho"
          baseHref={`/cam-tay/kho?buoc=${buoc.ma}`}
          lk={lk}
          tomTat={buoc.gom?.map((k) => CHIEU[k]!)}
          themLink={ds(buoc.ma === "1" ? "" : "cd=O_KHACH")}
        />
      )}
    </main>
  );
}

/**
 * Bảng việc cần xử lý của một nhóm; bấm một dòng thì mở ngăn kéo ngay tại chỗ.
 *
 * Tách sẵn theo loại khách vì cùng một việc mà đại lý hay khách lẻ là hai câu
 * chuyện khác nhau — ví dụ "thuê bao huỷ mà máy chưa về" ở đại lý thì đòi cả lô,
 * ở khách lẻ thì đòi từng cái.
 */
function BangViec({ nhom, tatCa }: { nhom: "pm" | "so"; tatCa: KhoMa[] }) {
  return (
    <div className="scroller">
      <table className="bang-thang">
        <thead>
          <tr>
            <th className="num">Số mã</th>
            <th>Việc</th>
            {LOAI.map((k) => (
              <th key={k || "khong-ro"} className="num">
                {k ? (
                  <span className={`chip ${MAU_LOAI_KHACH[k] ?? "tat"}`}>
                    {LOAI_KHACH[k] ?? k}
                  </span>
                ) : (
                  "không rõ"
                )}
              </th>
            ))}
            <th />
          </tr>
        </thead>
        <tbody>
          {VIEC.filter((v) => v.nhom === nhom).map((v) => {
            const d = tatCa.filter(v.hop);
            return (
              <tr key={v.ma}>
                <td className={`num mono${d.length > 0 && v.nang ? " bad" : ""}`}>
                  {n(d.length)}
                </td>
                <td>
                  {v.ten}
                  <div className="muted">{v.vi_sao}</div>
                </td>
                {LOAI.map((k) => {
                  const so = d.filter((r) => (r.loai_khach ?? "") === k).length;
                  return (
                    <td key={k || "khong-ro"} className={`num mono${so === 0 ? " muted" : ""}`}>
                      {so === 0 ? "—" : n(so)}
                    </td>
                  );
                })}
                <td className="khong-xuong-dong">
                  {d.length > 0 && <Link href={`/cam-tay/kho?viec=${v.ma}`}>xem →</Link>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
