import { KY_CUOC } from "@/lib/nhan";
import type { YearStatus } from "@/lib/queries";

const LOP_CO_DINH: Record<string, string> = {
  DA_THU: "da-thu",
  MIEN_PHI: "mien-phi",
  CHO_DUYET: "cho-duyet",
  GHI_CHU: "ghi-chu",
  NO: "no",
  CHUA_DEN_HAN: "chua-den-han",
  CHO_COC: "cho-coc",
  NA: "na",
};

/**
 * 12 ô T01–T12 của năm hiện tại.
 *
 * Đoạn hợp đồng phủ là một khối liền, bo tròn ở đầu và đuôi thật của hợp
 * đồng; cạnh không bo là đoạn chạy tiếp sang năm khác. Tháng ngoài hợp đồng
 * mờ hẳn đi. Không cần vạch đánh dấu vì chính khối đã là mốc.
 */
export function DaiKy({
  nam,
  lop = LOP_CO_DINH,
  nhan = KY_CUOC,
}: {
  nam: YearStatus | undefined;
  lop?: Record<string, string>;
  nhan?: Record<string, string>;
}) {
  if (!nam) return null;
  // Thuê bao không dính năm nay thì dải toàn ô mờ, chẳng nói gì mà vẫn tốn 12
  // thẻ mỗi dòng — trang đại lý có hàng trăm dòng như thế.
  if (nam.tu_thang === null) return null;

  return (
    <span className="dai-ky">
      {nam.cac_ky.map((tt, i) => {
        const thang = i + 1;
        const trong =
          nam.tu_thang !== null &&
          nam.den_thang !== null &&
          thang >= nam.tu_thang &&
          thang <= nam.den_thang;

        const lopO = [
          "o-ky",
          trong ? (lop[tt] ?? "na") : "ngoai",
          trong && nam.co_mo_dau && thang === nam.tu_thang ? "mo-dau" : "",
          trong && nam.co_ket_thuc && thang === nam.den_thang ? "ket-thuc" : "",
        ].filter(Boolean);

        return (
          <span
            key={thang}
            className={lopO.join(" ")}
            title={nhac(nam, thang, tt, trong, nhan)}
          >
            T{String(thang).padStart(2, "0")}
          </span>
        );
      })}
    </span>
  );
}

function nhac(
  nam: YearStatus,
  thang: number,
  tt: string,
  trong: boolean,
  nhan: Record<string, string>,
): string {
  const ky = `${nam.nam}-${String(thang).padStart(2, "0")}`;
  if (!trong) {
    return tt === "NA"
      ? `${ky}: ngoài thời hạn hợp đồng`
      : `${ky}: ${nhan[tt] ?? tt} — nhưng nằm ngoài thời hạn hợp đồng`;
  }
  const moc = [
    nam.co_mo_dau && thang === nam.tu_thang && "bắt đầu hợp đồng",
    nam.co_ket_thuc && thang === nam.den_thang && "kết thúc hợp đồng",
  ]
    .filter(Boolean)
    .join(", ");
  const trangThai = tt === "NA" ? "chưa tới hạn" : (nhan[tt] ?? tt);
  return `${ky}: ${trangThai}${moc ? ` — ${moc}` : ""}`;
}
