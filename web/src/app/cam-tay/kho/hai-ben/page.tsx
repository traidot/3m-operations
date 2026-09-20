import Link from "next/link";
import { ChiTietNhom, type Chieu } from "../chi-tiet";
import { getKhoLanNhap, getKhoMa, type KhoMa } from "@/lib/queries";
import { KHO_PM, LOAI_KHACH, LOAI_MA, MAU_LOAI_KHACH, MAY_CUOC } from "@/lib/nhan";

const KHONG_RO = "khong-ro";

/** Thứ tự cố định để bảng không nhảy chỗ giữa hai lần tải. */
const LOAI = ["CUSTOMER", "COLLABORATOR", "AGENCY", KHONG_RO];

export const dynamic = "force-dynamic";

const n = (v: string | number | null) =>
  v === null ? "—" : Number(v).toLocaleString("vi-VN");

type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const KHO_MA: Record<string, string> = { ...KHO_PM, PM_KHONG_CO: "phần mềm không có mã" };

const CHIEU: Record<string, Chieu> = {
  loaiMa: { ten: "Theo loại định danh", lay: (r) => LOAI_MA[r.loai_ma] ?? r.loai_ma },
  choDung: { ten: "Theo chỗ đứng", lay: (r) => KHO_MA[r.cho_dung] ?? r.cho_dung },
  doiMay: { ten: "Theo đời máy", lay: (r) => r.doi_may ?? "không rõ đời" },
  kho: {
    ten: "Theo kho trên phiếu gần nhất",
    lay: (r) => r.warehouse_name ?? "chưa có phiếu nào",
  },
  cuoc: {
    ten: "Theo tình trạng cước",
    lay: (r) =>
      r.tinh_trang_cuoc
        ? (MAY_CUOC[r.tinh_trang_cuoc] ?? r.tinh_trang_cuoc)
        : "không có hồ sơ cho thuê",
  },
  khach: {
    ten: "Theo loại khách",
    lay: (r) => LOAI_KHACH[r.loai_khach ?? ""] ?? "không rõ loại",
  },
  nguoiGiuFile: { ten: "Theo người giữ ghi ở sổ", lay: (r) => r.file_nguoi_giu ?? "sổ không ghi" },
  nhomFile: { ten: "Theo nhóm hàng ở file", lay: (r) => r.file_nhom_hang ?? "—" },
  ketLuanFile: { ten: "Theo kết luận ở file", lay: (r) => r.file_ket_luan ?? "—" },
  viTriSo: { ten: "Theo vị trí trong sổ", lay: (r) => r.file_vi_tri_so ?? "không có trong sổ" },
};

/**
 * Ba phần loại trừ nhau, cộng lại đúng bằng hợp của hai bên. Không bên nào là
 * thước đo của bên nào — file là bản tổng hợp làm tay ở ngoài, chưa ai chứng
 * minh nó đúng; phần mềm thì chỉ biết cái đã được nhập vào.
 */
const PHAN: {
  ma: string;
  ten: string;
  mo_ta: string;
  mau: string;
  canh_bao?: string;
  gom: string[];
  kem: boolean;
  chiFile?: boolean;
  hop: (r: KhoMa) => boolean;
}[] = [
  {
    ma: "chi-file",
    ten: "Chỉ file có",
    mo_ta: "phần mềm không có mã này ở bất kỳ bảng nào bên nguồn",
    mau: "var(--do)",
    canh_bao:
      "Đã quét 11 cột chứa mã thiết bị trên 59 bảng bên nguồn, kể cả dòng đã xoá mềm. Nhóm này chỉ tồn tại trên bản đối chiếu làm tay, không có gì để đối chứng.",
    gom: ["loaiMa", "ketLuanFile", "nhomFile", "nguoiGiuFile"],
    kem: true,
    chiFile: true,
    hop: (r) => r.file_co && !r.pm_co,
  },
  {
    ma: "ca-hai",
    ten: "Cả hai bên có",
    mo_ta: "cùng một mã xuất hiện ở cả phần mềm lẫn bản đối chiếu",
    mau: "var(--ok)",
    gom: ["khach", "loaiMa", "choDung", "cuoc", "viTriSo", "doiMay"],
    kem: false,
    hop: (r) => r.file_co && r.pm_co,
  },
  {
    ma: "chi-pm",
    ten: "Chỉ phần mềm có",
    mo_ta: "phần mềm có chứng từ, bản đối chiếu không nhắc tới",
    mau: "var(--lam)",
    canh_bao:
      "97% nhóm này là H1 và U3 — hai đời máy mà danh sách nhóm hàng của file (U20, MR1, WIMAX, SB, Datacall) không hề có. Nói cách khác file thiếu hẳn lô H1 và U3, chứ không phải bỏ sót lẻ tẻ. Và 1.198 cái trong số đó đang nằm ở tay khách.",
    gom: ["khach", "loaiMa", "choDung", "doiMay", "kho", "cuoc"],
    kem: true,
    hop: (r) => r.pm_co && !r.file_co,
  },
];

/** Dải ba khúc: khúc giữa là phần chung, hai ngoặc trên dưới là hai bên. */
function Dai({ so }: { so: number[] }) {
  const tong = so.reduce((a, b) => a + b, 0);
  const w = (v: number) => (v / tong) * 100;
  const file = w(so[0]!) + w(so[1]!);
  const pm = w(so[1]!) + w(so[2]!);
  return (
    <div className="dai">
      <div className="dai-ngoac">
        <span style={{ width: `${file}%` }}>
          File · {n(so[0]! + so[1]!)}
        </span>
      </div>
      <div className="dai-than">
        {PHAN.map((p, i) => (
          <span key={p.ma} style={{ width: `${w(so[i]!)}%`, background: p.mau }} />
        ))}
      </div>
      <div className="dai-ngoac duoi">
        <span style={{ width: `${pm}%`, marginLeft: `${w(so[0]!)}%` }}>
          Phần mềm · {n(so[1]! + so[2]!)}
        </span>
      </div>
    </div>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<Tham> }) {
  const sp = await searchParams;
  const [tatCa, lan] = await Promise.all([getKhoMa(), getKhoLanNhap()]);

  const so = PHAN.map((p) => tatCa.filter(p.hop).length);
  const mo = PHAN.find((p) => p.ma === mot(sp.xem));
  const lk = mot(sp.lk);

  return (
    <main>
      <h1>Hai bên biết những gì</h1>
      <p className="muted">
        <Link href="/cam-tay/kho">← Về tổng quan kho</Link> · Bản đối chiếu làm tay và phần
        mềm chồng lên nhau ở giữa, mỗi bên còn một mảng riêng. Hợp hai bên là{" "}
        <b>{n(tatCa.length)}</b> mã thiết bị — không bên nào một mình nắm đủ.
        {lan && (
          <>
            {" "}
            File đang dùng: <b>{lan.ten_file}</b>, chốt ngày {lan.sua_luc?.slice(0, 10)}.
          </>
        )}
      </p>

      <Dai so={so} />

      <div className="the-hang gon">
        {PHAN.map((p, i) => (
          <Link key={p.ma} className="the-so" href={`/cam-tay/kho/hai-ben?xem=${p.ma}`}>
            <div className="the-ten">{p.ten}</div>
            <div className="the-gia-tri mono" style={{ color: p.mau }}>
              {n(so[i]!)}
            </div>
            <div className="the-phu">{p.mo_ta}</div>
          </Link>
        ))}
      </div>

      <p className="actions">
        <a href="/cam-tay/kho/hai-ben/xuat">
          <button type="button" className="primary">
            Xuất Excel cả ba phần
          </button>
        </a>
        <Link href="/cam-tay/kho/danh-sach">
          <button type="button">Danh sách đầy đủ {n(tatCa.length)} mã</button>
        </Link>
      </p>

      <h2>Theo loại định danh</h2>
      <p className="muted">
        Cột mã không đồng nhất: máy wifi dùng <b>IMEI 15 số</b>, SIM dùng <b>số điện thoại</b>
        {" "}(nguồn viết 10 số hoặc 11 số có 0 đầu, file luôn viết 10 số), một ít SIM lại dùng
        {" "}<b>ICCID 19–20 số</b>. Mọi chỗ nối đều bỏ số 0 đầu hai phía — đã kiểm là không mã
        nào có hai số 0 đầu, và 8 nhóm bị gộp đều đúng là một số viết hai kiểu.
      </p>
      <div className="scroller">
        <table className="bang-thang">
          <thead>
            <tr>
              <th>Loại định danh</th>
              <th className="num">Tổng</th>
              <th className="num">Cả hai bên</th>
              <th className="num">Chỉ file</th>
              <th className="num">Chỉ phần mềm</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(LOAI_MA)
              .filter((k) => tatCa.some((r) => r.loai_ma === k))
              .map((k) => {
                const d = tatCa.filter((r) => r.loai_ma === k);
                return (
                  <tr key={k}>
                    <td>{LOAI_MA[k]}</td>
                    <td className="num mono">{n(d.length)}</td>
                    <td className="num mono">{n(d.filter((r) => r.pm_co && r.file_co).length)}</td>
                    <td className="num mono">{n(d.filter((r) => r.file_co && !r.pm_co).length)}</td>
                    <td className="num mono">{n(d.filter((r) => r.pm_co && !r.file_co).length)}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      <h2>Theo loại khách</h2>
      <p className="muted">
        Loại khách chỉ đọc được ở phía phần mềm — nhóm chỉ-có-trên-file không có mã nào bên
        nguồn nên không có khách để phân loại.
      </p>
      <div className="scroller">
        <table className="bang-thang">
          <thead>
            <tr>
              <th>Loại khách</th>
              <th className="num">Tổng</th>
              {PHAN.map((p) => (
                <th key={p.ma} className="num">
                  {p.ten}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LOAI.map((k) => {
              const d = tatCa.filter((r) => (r.loai_khach ?? KHONG_RO) === k);
              if (d.length === 0) return null;
              return (
                <tr key={k}>
                  <td>
                    {k === KHONG_RO ? (
                      <span className="muted">không rõ loại</span>
                    ) : (
                      <span className={`chip ${MAU_LOAI_KHACH[k] ?? "tat"}`}>
                        {LOAI_KHACH[k] ?? k}
                      </span>
                    )}
                  </td>
                  <td className="num mono">{n(d.length)}</td>
                  {PHAN.map((p) => (
                    <td key={p.ma} className="num mono">
                      {n(d.filter(p.hop).length)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="stale">
        <b>19 mã ICCID không khớp được cái nào</b> — 4 cái file gọi SIM bằng ICCID trong khi
        phần mềm gọi bằng số điện thoại, 15 cái ngược lại. Không có bảng nào nối hai định
        danh nên không vá được bằng truy vấn. Thêm nữa nguồn tự làm hỏng một ICCID: file ghi
        8981200724307099648, nguồn ghi 8981200724307100000 — năm số cuối thành 0, dấu hiệu đi
        qua số thực; và nguồn còn 88981030000067947629 hai mươi số, gần như chắc gõ thừa số 8.
      </p>

      <p className="muted khoi-ghi-chu">
        Phép trừ dễ đọc nhầm: <b>file − chỉ-file = cả-hai</b>, ra {n(so[1]!)}, nhưng đó là
        phần <i>chung</i> chứ không phải toàn bộ phần mềm đang quản lý. Phần mềm quản lý{" "}
        {n(so[1]! + so[2]!)} mã, vì còn {n(so[2]!)} mã file không nhắc tới. Mọi chỗ nối hai
        bên đều bỏ số 0 đầu của mã, vì kho có 68 mã SIM để số 0 còn file thì không.
      </p>

      {mo && (
        <ChiTietNhom
          ten={mo.ten}
          mo_ta={mo.mo_ta}
          canh_bao={mo.canh_bao}
          rows={tatCa.filter(mo.hop)}
          dongLai="/cam-tay/kho/hai-ben"
          baseHref={`/cam-tay/kho/hai-ben?xem=${mo.ma}`}
          lk={lk}
          tomTat={mo.gom.map((k) => CHIEU[k]!)}
          kemDanhSach={mo.kem}
          chiFile={mo.chiFile}
          themLink="/cam-tay/kho/danh-sach"
        />
      )}
    </main>
  );
}
