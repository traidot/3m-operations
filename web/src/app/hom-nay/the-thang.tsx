import Link from "next/link";
import type { ThangNay } from "@/lib/queries";

const n = (v: string | number) => Math.round(Number(v)).toLocaleString("vi-VN");

/** Lệch bao nhiêu phần trăm so với cùng kỳ; null khi nền quá nhỏ để chia. */
const lech = (nay: number, truoc: number) =>
  truoc < 1 ? null : Math.round(((nay - truoc) / truoc) * 100);

/** "+18%" / "−48%", kèm lớp màu theo chiều tốt hay xấu. */
function SoSanh({ nay, truoc, tangLaTot }: { nay: number; truoc: number; tangLaTot: boolean }) {
  const d = lech(nay, truoc);
  if (d === null) return <span className="muted">chưa so được</span>;
  const tot = d === 0 ? null : d > 0 === tangLaTot;
  return (
    <span className={tot === null ? "muted" : tot ? "ok" : "bad"}>
      {d > 0 ? "+" : ""}
      {d}%
    </span>
  );
}

/**
 * Bốn con số của tháng đang chạy.
 *
 * So với CÙNG SỐ NGÀY ĐẦU của tháng trước, không phải cả tháng trước: mùng 3
 * thì mới có ba ngày, so với cả tháng thì nhìn vào đâu cũng thấy sụt.
 *
 * Thu hồi thiết bị không có số vì nguồn chưa ghi nhận — thẻ nói thẳng điều đó
 * thay vì hiện 0, vốn đọc ra thành "đã thu hồi hết".
 */
export function TheThang({ t, moTai }: { t: ThangNay; moTai: string }) {
  const ngay = Number(t.ngay_da_qua);
  const thang = `${t.ky.slice(5, 7)}/${t.ky.slice(0, 4)}`;

  return (
    <section>
      <h2>
        Tháng {thang} <span className="muted">— {ngay} ngày đầu tháng</span>
      </h2>
      <p className="muted">
        Chỉ hợp đồng của công ty. So với <b>{ngay} ngày đầu</b> của tháng trước
        chứ không phải cả tháng — so với cả tháng thì đầu tháng nào cũng thấy sụt.
      </p>
      <div className="the-hang">
        <div className="the-so">
          <div className="the-ten">Doanh thu</div>
          <div className="the-gia-tri mono">{n(t.doanh_thu)}</div>
          <div className="the-phu">
            tiền thật về tài khoản ·{" "}
            <SoSanh nay={Number(t.doanh_thu)} truoc={Number(t.doanh_thu_cung_ky)} tangLaTot />{" "}
            so với {n(t.doanh_thu_cung_ky)} cùng kỳ
          </div>
        </div>
        <div className="the-so">
          <div className="the-ten">Huỷ</div>
          <div className="the-gia-tri mono">{n(t.huy)}</div>
          <div className="the-phu">
            hợp đồng ·{" "}
            <SoSanh nay={Number(t.huy)} truoc={Number(t.huy_cung_ky)} tangLaTot={false} /> so với{" "}
            {n(t.huy_cung_ky)} cùng kỳ · {n(t.ky_moi)} hợp đồng mới trong tháng
          </div>
        </div>
        <div className="the-so">
          <div className="the-ten">Cước tháng này chưa thu</div>
          <div className="the-gia-tri mono">{n(t.tien_chua_thu)}</div>
          <div className="the-phu">
            {n(t.ky_chua_thu)} kỳ cước của tháng {thang} chưa ai chốt — đầu tháng con
            số này luôn lớn vì kỳ vừa phát sinh, nó tụt dần khi người thu đi làm ·{" "}
            <Link href="/thu-cuoc">xem danh sách →</Link>
          </div>
        </div>
        <div className="the-so">
          <div className="the-ten">Thu hồi thiết bị</div>
          <div className="the-gia-tri mono muted">chưa có số</div>
          <div className="the-phu">
            CMS có sẵn bốn bảng cho việc này nhưng cả bốn đều rỗng, và hợp đồng chỉ
            ghi ngày <i>gửi thiết bị đi</i>, không có ngày nhận về. Muốn theo dõi thì
            phải ghi nhận ở CMS trước.
          </div>
        </div>
      </div>
    </section>
  );
}
