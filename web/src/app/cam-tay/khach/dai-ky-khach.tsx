import { KY_TELECOM, LOAI_HOA_DON, LOP_KY_TELECOM } from "@/lib/nhan";
import type { YearStatusKhach } from "@/lib/queries";

/**
 * Dải 12 tháng của một KHÁCH, gồm mọi loại hoá đơn.
 *
 * Dải ở dòng thuê bao chỉ vẽ được hoá đơn cước. Đơn hàng và phí khác không
 * gắn thuê bao nào, nên nếu chỉ có dải kia thì khách nợ đơn hàng mang cờ "nợ
 * quá hạn" mà cả dãy ô trống trơn — nhìn như hệ bỏ sót.
 *
 * Mỗi ô ghi chú rõ đang nợ thứ gì, vì một ô đỏ không nói được là cước hay đơn
 * hàng mà hai thứ đó đòi theo cách khác nhau.
 */
export function DaiKyKhach({ nam }: { nam: YearStatusKhach | undefined }) {
  if (!nam || nam.tu_thang === null) return null;

  return (
    <span className="dai-ky">
      {nam.cac_ky.map((tt, i) => {
        const thang = i + 1;
        const loai = nam.cac_loai[i];
        const ky = `${nam.nam}-${String(thang).padStart(2, "0")}`;
        const tenLoai =
          loai === null || loai === undefined
            ? null
            : loai
                .split(", ")
                .map((l) => LOAI_HOA_DON[l] ?? l)
                .join(", ");

        return (
          <span
            key={thang}
            className={`o-ky ${tt === "NA" ? "ngoai" : (LOP_KY_TELECOM[tt] ?? "na")}`}
            title={
              tt === "NA"
                ? `${ky}: không có hoá đơn nào`
                : `${ky}: ${KY_TELECOM[tt] ?? tt}${tenLoai ? ` — ${tenLoai}` : ""}`
            }
          >
            T{String(thang).padStart(2, "0")}
          </span>
        );
      })}
    </span>
  );
}
