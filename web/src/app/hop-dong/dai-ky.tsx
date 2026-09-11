import { KY_CUOC } from "@/lib/nhan";

const LOP: Record<string, string> = {
  DA_THU: "da-thu",
  MIEN_PHI: "mien-phi",
  CHO_DUYET: "cho-duyet",
  GHI_CHU: "ghi-chu",
  NO: "no",
  NA: "na",
};

/** 12 ô cho 12 tháng của năm hiện tại, ô trống là tháng ngoài khoảng hợp đồng. */
export function DaiKy({ cac_ky, nam }: { cac_ky: string[] | undefined; nam: number }) {
  if (!cac_ky) return <span className="muted">—</span>;
  return (
    <span className="dai-ky">
      {cac_ky.map((tt, i) => (
        <i
          key={i}
          className={`o-ky ${LOP[tt] ?? "na"}`}
          title={`${nam}-${String(i + 1).padStart(2, "0")}: ${
            tt === "NA" ? "ngoài khoảng đóng cước" : (KY_CUOC[tt] ?? tt)
          }`}
        />
      ))}
    </span>
  );
}
