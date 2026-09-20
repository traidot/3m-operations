import Link from "next/link";
import { getKhoLanNhap, getKhoMa, type KhoMa } from "@/lib/queries";
import { ChiTietViec } from "./chi-tiet";
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

  const ds = (q: string) => `/cam-tay/kho/danh-sach${q ? `?${q}` : ""}`;
  const viec = VIEC.find((v) => v.ma === mot(sp.viec));

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
        <Buoc
          so={pmCo} tong={pmCo} mau="var(--muted)"
          ten="1 · Phần mềm biết"
          phu={`mã thiết bị có chứng từ trong phần mềm`}
          href={ds("")}
        />
        <Buoc
          so={oKhach} tong={pmCo} mau="var(--lam)"
          ten="2 · Đang ở khách"
          phu={`còn ${n(trongKho)} mã trong kho`}
          href={ds("cd=O_KHACH")}
        />
        <Buoc
          so={coThueBao} tong={pmCo} mau="var(--lam)"
          ten="3 · Có hồ sơ thuê bao"
          phu={`${n(oKhach - coThueBao)} máy ở khách chỉ có phiếu xuất, không có hồ sơ`}
          href={ds("viec=khach_khong_ho_so")}
        />
        <Buoc
          so={dangThu} tong={pmCo} mau="var(--ok)"
          ten="4 · Đang thu được cước"
          phu={`${n(oKhach - dangThu)} máy ở khách mà tháng này không ra cước`}
          href={ds("cd=O_KHACH&cuoc=DANG_RA_CUOC")}
        />
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
        <ChiTietViec viec={viec} rows={tatCa.filter(viec.hop)} dongLai="/cam-tay/kho" />
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
