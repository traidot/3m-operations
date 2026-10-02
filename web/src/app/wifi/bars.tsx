"use client";

import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";

/**
 * Biểu đồ cột nhóm. Mọi chuỗi nằm chung một trục nên chỉ dùng khi chúng cùng
 * đơn vị.
 */
export type Series = {
  ten: string;
  mau: string;
  gia_tri: (number | null)[];
  /** Tên tham số URL. Có thì cột của chuỗi này bấm được, mở `?<mo>=<nhãn>`
   *  trên đường dẫn `moTai`. */
  mo?: string;
};

const so = (v: number) => v.toLocaleString("vi-VN");

/** Trục dọc phải gọn, không thì "1.430.000" đẩy cả biểu đồ sang phải. */
const TRIEU = 1_000_000;
const NGHIN = 1_000;
const gonTruc = (v: number) => {
  if (Math.abs(v) >= TRIEU) return `${(v / TRIEU).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}tr`;
  if (Math.abs(v) >= NGHIN) return `${(v / NGHIN).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}k`;
  return so(v);
};

/**
 * Nhãn trục hoành. Nhận ra nhãn ngày (YYYY-MM-DD) và nhãn kỳ (YYYY-MM) để cắt
 * cho vừa chỗ — trục đã nói rõ phạm vi, lặp lại năm ở từng cột chỉ tổ chật.
 * Tooltip thì ngược lại: chỉ hiện ở một cột nên ghi đủ ngày tháng.
 */
const NGAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const KY = /^(\d{4})-(\d{2})$/;
const nhanNgan = (v: string): string =>
  NGAY.exec(v)?.[3] ?? KY.exec(v)?.[2] ?? v;
const nhanDu = (v: string): string => {
  const d = NGAY.exec(v);
  return d ? `${d[3]}/${d[2]}` : v;
};

function Chu({ active, payload, label }: Partial<TooltipContentProps<number, string>>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <div className="chart-tip-ngay">{nhanDu(String(label))}</div>
      {payload.map((p) => (
        <div key={p.name} className="chart-tip-dong">
          <span className="o-mau" style={{ background: p.color }} />
          <span className="chart-tip-ten">{p.name}</span>
          <b>{so(Number(p.value ?? 0))}</b>
        </div>
      ))}
    </div>
  );
}

export function Bars({
  nhan,
  chuoi,
  cao = 200,
  moiNhan = false,
  moTai,
}: {
  nhan: string[];
  chuoi: Series[];
  cao?: number;
  /** Đường dẫn trang chứa biểu đồ, cần khi có chuỗi đặt `mo`. */
  moTai?: string;
  /** Hiện nhãn của MỌI cột, xoay nghiêng cho khỏi chen nhau. Dùng khi trục là
   *  ngày trong tháng — nhảy cóc hai ngày một thì không dò ra cột nào là ngày
   *  nào. */
  moiNhan?: boolean;
}) {
  const router = useRouter();
  const du_lieu = nhan.map((ten, i) => {
    const hang: Record<string, string | number> = { ten };
    for (const s of chuoi) hang[s.ten] = s.gia_tri[i] ?? 0;
    return hang;
  });

  // Nhãn xoay nghiêng ăn gấp đôi chiều cao của nhãn nằm ngang.
  const cheoCao = moiNhan ? 46 : 22;

  return (
    <figure className="chart">
      <ResponsiveContainer width="100%" height={cao + cheoCao}>
        <BarChart
          data={du_lieu}
          margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          // Chừa khoảng trống rộng giữa hai ngày, và các cột trong cùng một
          // ngày dính sát nhau: có vậy mắt mới đọc ra đâu là một cụm, thay vì
          // thấy một hàng cột đều tăm tắp không biết cột nào thuộc ngày nào.
          barCategoryGap="28%"
          barGap={1}
        >
          {/* Sọc nền xen kẽ theo ngày, vẽ trước nên nằm dưới cột. Lưới của
              recharts chỉ kẻ ở tâm mỗi cột, nên phải tự sinh toạ độ ranh giới
              ô — kẻ ở tâm thì sọc cắt đôi cụm cột, nhìn còn rối hơn không có. */}
          <CartesianGrid
            horizontal={false}
            stroke="transparent"
            verticalFill={["transparent", "var(--soc)"]}
            verticalCoordinatesGenerator={({ offset }) => {
              const o = offset.width / Math.max(nhan.length, 1);
              return Array.from({ length: nhan.length + 1 }, (_, i) => offset.left + i * o);
            }}
          />
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis
            dataKey="ten"
            tickFormatter={nhanNgan}
            interval={moiNhan ? 0 : "preserveStartEnd"}
            angle={moiNhan ? -60 : 0}
            textAnchor={moiNhan ? "end" : "middle"}
            height={cheoCao}
            tickLine={false}
            stroke="var(--line-strong)"
            tick={{ fill: "var(--muted)", fontSize: 11, fontFamily: "var(--mono)" }}
          />
          <YAxis
            width={44}
            tickFormatter={gonTruc}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted)", fontSize: 10, fontFamily: "var(--mono)" }}
          />
          <Tooltip
            content={<Chu />}
            // Vệt sáng chạy theo cột đang rê — không có nó thì không biết
            // tooltip đang nói về ngày nào.
            cursor={{ fill: "var(--surface-2)" }}
          />
          {chuoi.map((s) => {
            const bam = s.mo !== undefined && moTai !== undefined;
            return (
              <Bar
                key={s.ten}
                dataKey={s.ten}
                fill={s.mau}
                maxBarSize={18}
                radius={[2, 2, 0, 0]}
                cursor={bam ? "pointer" : undefined}
                // Cột 0 không mở gì được, bấm vào ra ngăn kéo rỗng thì người
                // dùng tưởng hỏng.
                onClick={
                  bam
                    ? (o: { payload?: { ten?: string } }) => {
                        const ngay = o.payload?.ten;
                        const v = ngay === undefined ? 0 : Number(o.payload?.[s.ten as never] ?? 0);
                        if (ngay !== undefined && v > 0) {
                          router.push(`${moTai}?${s.mo}=${ngay}`, { scroll: false });
                        }
                      }
                    : undefined
                }
              />
            );
          })}
        </BarChart>
      </ResponsiveContainer>
      {/* Chú thích tự dựng, không dùng Legend của recharts: nó xếp lại thứ tự
          khác với thứ tự cột, đọc xong nhìn sang biểu đồ lại phải dò. */}
      <figcaption>
        {chuoi.map((s) => (
          <span key={s.ten} className="chu-thich">
            <span className="o-mau" style={{ background: s.mau }} />
            {s.ten}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
