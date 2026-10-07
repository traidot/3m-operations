import Link from "next/link";
import { NoiDungKhach } from "../../cam-tay/khach/noi-dung";
import { NoiDungMay } from "../../cam-tay/may/noi-dung";
import { NoiDungKho } from "../../cam-tay/kho/noi-dung";
import { NoiDungHaiBen } from "../../cam-tay/kho/hai-ben/noi-dung";
import { NoiDungKhoDanhSach } from "../../cam-tay/kho/danh-sach/noi-dung";
import { NoiDungTongQuanCamTay } from "../../cam-tay/noi-dung";

export const dynamic = "force-dynamic";

type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? "";

const TAB = [
  { ma: "tong-quan", ten: "Tổng quan" },
  { ma: "khach", ten: "Khách và dịch vụ" },
  { ma: "may", ten: "Máy cho thuê" },
  { ma: "kho", ten: "Kho" },
] as const;

/** Tab kho có ba góc nhìn, không phải ba bộ lọc của cùng một bảng. */
const KHO = [
  { ma: "tong-quan", ten: "Đối chiếu hai nguồn" },
  { ma: "hai-ben", ten: "Hai bên biết gì" },
  { ma: "danh-sach", ten: "Từng mã" },
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
  const tab = TAB.some((t) => t.ma === mot(sp.tab)) ? mot(sp.tab) : "tong-quan";
  // Tên tham số là `goc`, không phải `kho`: bảng "từng mã" đã dùng `kho` cho
  // tên kho vật lý (Takadanobaba, Ibaraki…), trùng thì lọc theo kho hỏng.
  const goc = KHO.some((k) => k.ma === mot(sp.goc)) ? mot(sp.goc) : "tong-quan";
  const dinhKem = Promise.resolve(sp);

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

      {tab === "kho" && (
        <div className="nhom-loc">
          <div className="muted nhan-nhom">Góc nhìn kho</div>
          <p className="actions">
            {KHO.map((k) => (
              <Link key={k.ma} href={`/tra-cuu/cam-tay?tab=kho&goc=${k.ma}`}>
                <button
                  type="button"
                  className={goc === k.ma ? "primary" : undefined}
                >
                  {k.ten}
                </button>
              </Link>
            ))}
          </p>
        </div>
      )}

      {tab === "tong-quan" && <NoiDungTongQuanCamTay searchParams={dinhKem} />}
      {tab === "khach" && <NoiDungKhach searchParams={dinhKem} />}
      {tab === "may" && <NoiDungMay searchParams={dinhKem} />}
      {tab === "kho" && goc === "tong-quan" && (
        <NoiDungKho searchParams={dinhKem} />
      )}
      {tab === "kho" && goc === "hai-ben" && (
        <NoiDungHaiBen searchParams={dinhKem} />
      )}
      {tab === "kho" && goc === "danh-sach" && (
        <NoiDungKhoDanhSach searchParams={dinhKem} />
      )}
    </main>
  );
}
