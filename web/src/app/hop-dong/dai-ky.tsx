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
 * 12 ô T01–T12 của năm hiện tại. Ô mờ là tháng ngoài khoảng đóng cước; vạch
 * đứng đánh dấu tháng hợp đồng bắt đầu và tháng kết thúc, để phân biệt ô mờ
 * đầu dải (chưa ký) với ô mờ cuối dải (đã ngừng, hoặc chưa tới hạn).
 */
export function DaiKy({ nam }: { nam: YearStatus | undefined }) {
  if (!nam) return null;

  return (
    <span className="dai-ky">
      {nam.cac_ky.map((tt, i) => {
        const thang = i + 1;
        const batDau = thang === nam.thang_bat_dau;
        const ketThuc = thang === nam.thang_ket_thuc;
        const moc = [batDau && "bắt đầu", ketThuc && "kết thúc"].filter(Boolean).join(", ");
        return (
          <span
            key={thang}
            className={[
              "o-ky",
              LOP[tt] ?? "na",
              batDau ? "bat-dau" : "",
              ketThuc ? "ket-thuc" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            title={`${nam.nam}-${String(thang).padStart(2, "0")}: ${
              tt === "NA" ? "ngoài khoảng đóng cước" : (KY_CUOC[tt] ?? tt)
            }${moc ? ` — ${moc} hợp đồng` : ""}`}
          >
            T{String(thang).padStart(2, "0")}
          </span>
        );
      })}
    </span>
  );
}
