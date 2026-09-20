import Link from "next/link";
import { getKhoLanNhap, getKhoMa, type KhoMa } from "@/lib/queries";
import { ChiTietNhom } from "./chi-tiet";
import { VIEC } from "./viec";

export const dynamic = "force-dynamic";

const n = (v: string | number | null) =>
  v === null ? "—" : Number(v).toLocaleString("vi-VN");

type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Ba khối của phần file có mà phần mềm không có, tách theo số thứ tự kết luận. */
const KHOI_NGOAI = [
  { ten: "Đã ra khỏi công ty", y: "trả lại nhà cung cấp", hop: (k: string) => k === "01" },
  { ten: "SIM đã dừng", y: "đã huỷ hoặc trả lại nhà mạng", hop: (k: string) => k === "05" || k === "06" },
  { ten: "Còn lại, phải xử lý", y: "sổ có hoặc kiểm kho thấy", hop: (k: string) => !["01", "05", "06"].includes(k) },
];

const maKetLuan = (s: string | null) => (s ?? "").slice(0, 2);

/**
 * Bốn bước của phễu, đúng vòng nghiệp vụ: nhập về kho → vận hành trên phần mềm
 * → có khách và dịch vụ → thu được cước. Định nghĩa ở đây để thẻ và ngăn kéo
 * dùng chung một luật.
 */
const BUOC: { ma: string; ten: string; mo_ta: string; mau: string; hop: (r: KhoMa) => boolean }[] = [
  {
    ma: "1",
    ten: "Phần mềm biết",
    mo_ta: "mã thiết bị có chứng từ trong phần mềm",
    mau: "var(--muted)",
    hop: (r) => r.pm_co,
  },
  {
    ma: "2",
    ten: "Đang ở khách",
    mo_ta: "phiếu gần nhất là phiếu xuất, hoặc hồ sơ cho thuê còn mở",
    mau: "var(--lam)",
    hop: (r) => r.cho_dung === "O_KHACH",
  },
  {
    ma: "3",
    ten: "Có hồ sơ thuê bao",
    mo_ta: "máy ở khách và có bản ghi cho thuê, nên biết cọc và kỳ cước",
    mau: "var(--lam)",
    hop: (r) => r.cho_dung === "O_KHACH" && r.trang_thai_may !== null,
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
  const coThueBao = dem((r) => r.cho_dung === "O_KHACH" && r.trang_thai_may !== null);
  const dangThu = dem((r) => r.cho_dung === "O_KHACH" && r.tinh_trang_cuoc === "DANG_RA_CUOC");
  const trongKho = dem((r) => r.cho_dung === "TRONG_KHO");
  const fileRieng = dem((r) => r.file_co && !r.pm_co);

  const PHU = [
    "mã thiết bị có chứng từ trong phần mềm",
    `còn ${n(trongKho)} mã trong kho`,
    `${n(oKhach - coThueBao)} máy ở khách chỉ có phiếu xuất, không có hồ sơ`,
    `${n(oKhach - dangThu)} máy ở khách mà tháng này không ra cước`,
  ];

  const ds = (q: string) => `/cam-tay/kho/danh-sach${q ? `?${q}` : ""}`;
  const viec = VIEC.find((v) => v.ma === mot(sp.viec));
  const buoc = BUOC.find((b) => b.ma === mot(sp.buoc));

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

      <h2>{n(fileRieng)} mã file có mà phần mềm không có</h2>
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
                (r) => r.file_co && !r.pm_co && k.hop(maKetLuan(r.file_ket_luan)),
              );
              return (
                <tr key={k.ten}>
                  <td className="num mono">{n(d.length)}</td>
                  <td>
                    {k.ten}
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
          themLink={ds(`viec=${viec.ma}`)}
        />
      )}

      {buoc && (
        <ChiTietNhom
          ten={`Bước ${buoc.ma} · ${buoc.ten}`}
          mo_ta={buoc.mo_ta}
          rows={tatCa.filter(buoc.hop)}
          dongLai="/cam-tay/kho"
          themLink={ds(buoc.ma === "2" || buoc.ma === "3" || buoc.ma === "4" ? "cd=O_KHACH" : "")}
        />
      )}
    </main>
  );
}

/** Bảng việc cần xử lý của một nhóm; bấm một dòng thì mở ngăn kéo ngay tại chỗ. */
function BangViec({ nhom, tatCa }: { nhom: "pm" | "so"; tatCa: KhoMa[] }) {
  return (
    <div className="scroller">
      <table className="bang-thang">
        <thead>
          <tr>
            <th className="num">Số mã</th>
            <th>Việc</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {VIEC.filter((v) => v.nhom === nhom).map((v) => {
            const so = tatCa.filter(v.hop).length;
            return (
              <tr key={v.ma}>
                <td className={`num mono${so > 0 && v.nang ? " bad" : ""}`}>{n(so)}</td>
                <td>
                  {v.ten}
                  <div className="muted">{v.vi_sao}</div>
                </td>
                <td className="khong-xuong-dong">
                  {so > 0 && <Link href={`/cam-tay/kho?viec=${v.ma}`}>xem →</Link>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
