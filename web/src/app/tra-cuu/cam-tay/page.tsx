import Link from "next/link";
import { NoiDungKhach } from "../../cam-tay/khach/noi-dung";
import { NoiDungMay } from "../../cam-tay/may/noi-dung";

export const dynamic = "force-dynamic";

type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? "";

const TAB = [
  { ma: "khach", ten: "Khách và dịch vụ" },
  { ma: "may", ten: "Máy cho thuê" },
] as const;

/**
 * Tra cứu bên wifi cầm tay — hai thực thể, hai tab.
 *
 * Hai tab là hai bảng hoàn toàn khác nhau chứ không phải một bảng lọc khác đi:
 * khách gom theo người và cộng nợ theo người, máy gom theo IMEI và tính cước
 * theo khoảng máy nằm ở nhà khách. Đặt chung một màn vì người tra thường không
 * biết trước mình cần tra bằng tên khách hay bằng mã máy.
 *
 * Đổi tab thì BỎ hết tham số cũ: hai bên dùng trùng tên `q` và `xem` nhưng
 * hiểu khác nhau, mang sang thì ô tìm kiếm có sẵn chữ của bảng kia.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Tham>;
}) {
  const sp = await searchParams;
  const tab = TAB.some((t) => t.ma === mot(sp.tab)) ? mot(sp.tab) : "khach";

  return (
    <main>
      <h1>Tra cứu · wifi cầm tay</h1>

      <div className="nhom-loc">
        <div className="muted nhan-nhom">Tra theo</div>
        <p className="actions">
          {TAB.map((t) => (
            <Link key={t.ma} href={`/tra-cuu/cam-tay?tab=${t.ma}`}>
              <button type="button" className={tab === t.ma ? "primary" : undefined}>
                {t.ten}
              </button>
            </Link>
          ))}
        </p>
      </div>

      {tab === "khach" ? (
        <NoiDungKhach searchParams={Promise.resolve(sp)} />
      ) : (
        <NoiDungMay searchParams={Promise.resolve(sp)} />
      )}
    </main>
  );
}
