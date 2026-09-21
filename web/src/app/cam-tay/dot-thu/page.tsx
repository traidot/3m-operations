import Link from "next/link";
import { Bars } from "../../wifi/bars";
import { ChiTietDot } from "./chi-tiet";
import { getDotThu } from "@/lib/queries";
import { LOAI_KHACH, MAU_LOAI_KHACH } from "@/lib/nhan";

export const dynamic = "force-dynamic";

const n = (v: string | number | null) =>
  v === null ? "—" : Math.round(Number(v)).toLocaleString("vi-VN");

type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Số tháng vẽ lên biểu đồ; cũ hơn nữa thì bảng bên dưới vẫn có đủ. */
const SO_THANG_VE = 24;

export default async function Page({ searchParams }: { searchParams: Promise<Tham> }) {
  const sp = await searchParams;
  const rows = await getDotThu();
  const ky = mot(sp.ky);

  const cong = (k: keyof (typeof rows)[number]) =>
    rows.reduce((t, r) => t + Number(r[k] ?? 0), 0);

  // Biểu đồ đi từ cũ sang mới; bảng thì mới nhất lên đầu.
  const ve = [...rows].reverse().slice(-SO_THANG_VE);

  return (
    <main>
      <h1>Đợt thu cước wifi cầm tay</h1>
      <p className="muted">
        Mỗi tháng một đợt, từ <b>{rows.at(-1)?.ky}</b> tới hết năm nay (<b>{rows[0]?.ky}</b>) —{" "}
        {n(cong("so_ky"))} kỳ cước, {n(cong("phai_thu"))} yên phải thu,{" "}
        {n(cong("da_thu"))} đã thu. Tiền đếm theo <b>kỳ cước</b> chứ không theo máy: có kỳ
        nối vào hai mã thiết bị vì thuê bao đổi máy giữa chừng, đếm theo máy là nhân đôi.
        Bấm một tháng để xem từng kỳ, không nhảy trang.
      </p>

      <div className="the-hang gon">
        <div className="the-so">
          <div className="the-ten">Đã thu</div>
          <div className="the-gia-tri mono">{n(cong("da_thu"))}</div>
          <div className="the-phu">
            {((cong("da_thu") / Math.max(cong("phai_thu"), 1)) * 100).toFixed(1)}% số phải thu
          </div>
        </div>
        <div className="the-so">
          <div className="the-ten">Đang đòi</div>
          <div className="the-gia-tri mono">{n(cong("dang_doi"))}</div>
          <div className="the-phu">hoá đơn đã phát hành, chưa thấy tiền</div>
        </div>
        <div className="the-so">
          <div className="the-ten">Đã chốt không thu được</div>
          <div className="the-gia-tri mono bad">{n(cong("bo_thu"))}</div>
          <div className="the-phu">
            {((cong("bo_thu") / Math.max(cong("phai_thu"), 1)) * 100).toFixed(1)}% số phải thu
          </div>
        </div>
        <div className="the-so">
          <div className="the-ten">Số đợt</div>
          <div className="the-gia-tri mono">{n(rows.length)}</div>
          <div className="the-phu">tháng có ít nhất một kỳ cước</div>
        </div>
      </div>

      <h2>Phải thu và đã thu theo tháng</h2>
      <Bars
        nhan={ve.map((r) => r.ky)}
        chuoi={[
          { ten: "Phải thu", mau: "var(--muted)", gia_tri: ve.map((r) => Number(r.phai_thu)) },
          { ten: "Đã thu", mau: "var(--ok)", gia_tri: ve.map((r) => Number(r.da_thu)) },
          { ten: "Không thu được", mau: "var(--do)", gia_tri: ve.map((r) => Number(r.bo_thu)) },
        ]}
      />

      <h2>Từng đợt</h2>
      <div className="scroller">
        <table className="bang-thang">
          <thead>
            <tr>
              <th>Tháng</th>
              <th className="num">Kỳ cước</th>
              <th className="num">Phải thu</th>
              <th className="num">Đã thu</th>
              <th className="num">Đang đòi</th>
              <th className="num">Không thu được</th>
              <th>Tỉ lệ thu</th>
              {["CUSTOMER", "COLLABORATOR", "AGENCY"].map((l) => (
                <th key={l} className="num">
                  <span className={`chip ${MAU_LOAI_KHACH[l] ?? "tat"}`}>{LOAI_KHACH[l]}</span>
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const ty = r.ty_le_thu === null ? null : Number(r.ty_le_thu);
              return (
                <tr key={r.ky} className={ky === r.ky ? "dang-mo" : undefined}>
                  <td className="mono">
                    {r.ky}
                    {r.ky_tuong_lai && <div className="chip cho">kỳ tương lai</div>}
                  </td>
                  <td className="num mono muted">
                    {n(r.so_ky)}
                    <div>{n(r.so_may)} máy</div>
                  </td>
                  <td className="num mono">{n(r.phai_thu)}</td>
                  <td className="num mono">{n(r.da_thu)}</td>
                  <td className={`num mono${Number(r.dang_doi) > 0 ? "" : " muted"}`}>
                    {Number(r.dang_doi) > 0 ? n(r.dang_doi) : "—"}
                  </td>
                  <td className={`num mono${Number(r.bo_thu) > 0 ? " bad" : " muted"}`}>
                    {Number(r.bo_thu) > 0 ? n(r.bo_thu) : "—"}
                  </td>
                  <td>
                    {ty === null ? (
                      <span className="muted">—</span>
                    ) : (
                      <span className="bar">
                        <span
                          className={`bar-fill${ty < 90 && !r.ky_tuong_lai ? " xau" : ""}`}
                          style={{ width: `${Math.min(ty, 100)}%` }}
                        />
                        <span className="bar-label mono">{ty}%</span>
                      </span>
                    )}
                  </td>
                  <td className="num mono muted">{n(r.ky_khach_le)}</td>
                  <td className="num mono muted">{n(r.ky_ctv)}</td>
                  <td className="num mono muted">{n(r.ky_dai_ly)}</td>
                  <td className="khong-xuong-dong">
                    <Link href={`/cam-tay/dot-thu?ky=${r.ky}`}>xem →</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="muted khoi-ghi-chu">
        Tháng đánh dấu <b>kỳ tương lai</b> là cước đã phát hành trước cho tháng chưa tới —
        tỉ lệ thu thấp ở đó là bình thường, không phải nợ. Cột ba loại khách đếm số kỳ, không
        phải tiền; tiền theo loại khách nằm trong ngăn kéo của từng tháng.
      </p>

      <p className="muted khoi-ghi-chu">
        <b>134 kỳ cước · 463.782 yên cũng bị loại</b> vì kỳ đó đã lập lại hoá đơn: hoá đơn
        cũ hỏng, hoá đơn mới đã thu, nhưng dòng cước của hoá đơn cũ vẫn nằm trong sổ. Đếm cả
        hai thì vừa thổi phồng phải thu vừa báo nhầm là không đòi được.
      </p>

      <p className="muted khoi-ghi-chu">
        <b>60 kỳ cước · 23.000 yên đã bị loại khỏi mọi con số trên trang này</b> — chúng
        thuộc thuê bao đã xoá ở nguồn, hồ sơ dịch vụ không còn, chỉ còn trơ lại cái kỳ cước.
        Chỗ này lộ ra do đồng bộ lọc bản ghi đã xoá cho bảng thuê bao nhưng không lọc cho
        bảng kỳ cước. Dữ liệu vẫn giữ trong kho ở view riêng để đối chiếu, chỉ không cộng
        vào đâu cả.
      </p>

      <p className="muted khoi-ghi-chu">
        <b>Trang này đếm KỲ CƯỚC, trang Tổng quan đếm HOÁ ĐƠN — đừng so thẳng hai con số.</b>{" "}
        Toàn bộ hoá đơn cầm tay là 97.201.283, toàn bộ kỳ cước là 84.200.423; chênh
        13.000.860 là phần hoá đơn không phải tiền cước — cọc, bán máy, phí đăng ký. Thêm
        nữa 3.061 hoá đơn không ghi kỳ nên trang Tổng quan xếp chúng vào tháng phát hành,
        còn trang này không có chúng.
      </p>

      <p className="muted khoi-ghi-chu">
        Bảng dừng ở hết năm nay. Sổ bên nguồn còn kỳ tới tận 2027-09 vì cước phát hành
        trước, nhưng mấy tháng đó chỉ lác đác vài kỳ — 9 tháng, 62 kỳ, 157.416 yên — kéo dài
        bảng ra mà không nói lên điều gì.
      </p>

      {ky && (
        <ChiTietDot
          ky={ky}
          lk={mot(sp.lk)}
          hd={mot(sp.hd)}
          dongLai="/cam-tay/dot-thu"
        />
      )}
    </main>
  );
}
