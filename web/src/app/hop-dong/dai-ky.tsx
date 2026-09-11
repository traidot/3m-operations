import { KY_CUOC } from "@/lib/nhan";

const LOP: Record<string, string> = {
  DA_THU: "da-thu",
  MIEN_PHI: "mien-phi",
  CHO_DUYET: "cho-duyet",
  GHI_CHU: "ghi-chu",
  NO: "no",
  NA: "na",
};

/** 12 ô T01–T12 của năm hiện tại, ô mờ là tháng ngoài khoảng đóng cước. */
export function DaiKy({ cac_ky, nam }: { cac_ky: string[] | undefined; nam: number }) {
  if (!cac_ky) return null;
  return (
    <span className="dai-ky">
      {cac_ky.map((tt, i) => {
        const thang = String(i + 1).padStart(2, "0");
        return (
          <span
            key={i}
            className={`o-ky ${LOP[tt] ?? "na"}`}
            title={`${nam}-${thang}: ${
              tt === "NA" ? "ngoài khoảng đóng cước" : (KY_CUOC[tt] ?? tt)
            }`}
          >
            T{thang}
          </span>
        );
      })}
    </span>
  );
}
