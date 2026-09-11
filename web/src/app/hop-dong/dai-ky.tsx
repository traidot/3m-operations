import { KY_CUOC } from "@/lib/nhan";
import type { YearStatus } from "@/lib/queries";

const LOP: Record<string, string> = {
  DA_THU: "da-thu",
  MIEN_PHI: "mien-phi",
  CHO_DUYET: "cho-duyet",
  GHI_CHU: "ghi-chu",
  NO: "no",
  NA: "na",
};

/**
 * 12 ô T01–T12 của năm hiện tại.
 *
 * Đoạn hợp đồng phủ là một khối liền, bo tròn ở đầu và đuôi thật của hợp
 * đồng; cạnh không bo là đoạn chạy tiếp sang năm khác. Tháng ngoài hợp đồng
 * mờ hẳn đi. Không cần vạch đánh dấu vì chính khối đã là mốc.
 */
export function DaiKy({ nam }: { nam: YearStatus | undefined }) {
  if (!nam) return null;

  return (
    <span className="dai-ky">
      {nam.cac_ky.map((tt, i) => {
        const thang = i + 1;
        const trong =
          nam.tu_thang !== null &&
          nam.den_thang !== null &&
          thang >= nam.tu_thang &&
          thang <= nam.den_thang;

        const lop = [
          "o-ky",
          trong ? (LOP[tt] ?? "na") : "ngoai",
          trong && nam.co_mo_dau && thang === nam.tu_thang ? "mo-dau" : "",
          trong && nam.co_ket_thuc && thang === nam.den_thang ? "ket-thuc" : "",
        ].filter(Boolean);

        return (
          <span key={thang} className={lop.join(" ")} title={nhac(nam, thang, tt, trong)}>
            T{String(thang).padStart(2, "0")}
          </span>
        );
      })}
    </span>
  );
}

function nhac(nam: YearStatus, thang: number, tt: string, trong: boolean): string {
  const ky = `${nam.nam}-${String(thang).padStart(2, "0")}`;
  if (!trong) {
    return tt === "NA"
      ? `${ky}: ngoài thời hạn hợp đồng`
      : `${ky}: ${KY_CUOC[tt] ?? tt} — nhưng nằm ngoài thời hạn hợp đồng`;
  }
  const moc = [
    nam.co_mo_dau && thang === nam.tu_thang && "bắt đầu hợp đồng",
    nam.co_ket_thuc && thang === nam.den_thang && "kết thúc hợp đồng",
  ]
    .filter(Boolean)
    .join(", ");
  const trangThai = tt === "NA" ? "chưa tới hạn" : (KY_CUOC[tt] ?? tt);
  return `${ky}: ${trangThai}${moc ? ` — ${moc}` : ""}`;
}
