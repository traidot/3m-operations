/**
 * Biểu đồ cột chồng nằm ngang — dùng khi cần thấy CƠ CẤU của từng nhóm chứ
 * không phải so độ lớn giữa các nhóm. Vẽ thẳng bằng SVG, không kéo thư viện.
 *
 * Mỗi hàng là một nhóm, chiều dài đoạn là tỉ lệ trong nhóm đó, còn tổng của
 * nhóm in bằng số ở cuối hàng. Làm vậy vì nhóm to nhỏ chênh nhau hàng chục lần
 * (2.000 với 2 mã): vẽ theo số tuyệt đối thì nhóm nhỏ mất hút thành một vạch.
 */
export type Phan = { ma: string; ten: string; mau: string };

const CAO_HANG = 26;
const CAO_COT = 14;
const LE_PHAI = 56;

export function ChongNgang({
  nhom,
  phan,
  rongNhan = 250,
}: {
  nhom: { ten: string; dem: Record<string, number> }[];
  phan: Phan[];
  rongNhan?: number;
}) {
  const rong = 720;
  const dat = rong - rongNhan - LE_PHAI;
  const cao = nhom.length * CAO_HANG;

  return (
    <figure className="chart">
      <svg
        viewBox={`0 0 ${rong} ${cao}`}
        role="img"
        width="100%"
        aria-label={`Cơ cấu theo ${phan.map((p) => p.ten).join(", ")}`}
      >
        {nhom.map((g, i) => {
          const tong = phan.reduce((t, p) => t + (g.dem[p.ma] ?? 0), 0);
          let x = rongNhan;
          return (
            <g key={g.ten}>
              <text
                className="nhan-hang"
                x={rongNhan - 8}
                y={i * CAO_HANG + CAO_COT}
                textAnchor="end"
              >
                {g.ten.length > 46 ? `${g.ten.slice(0, 45)}…` : g.ten}
              </text>
              {phan.map((p) => {
                const v = g.dem[p.ma] ?? 0;
                if (v === 0 || tong === 0) return null;
                const w = (v / tong) * dat;
                const o = x;
                x += w;
                return (
                  <rect
                    key={p.ma}
                    x={o}
                    y={i * CAO_HANG + 2}
                    width={Math.max(w, 1)}
                    height={CAO_COT - 2}
                    fill={p.mau}
                  />
                );
              })}
              <text
                className="tong-hang"
                x={rong - LE_PHAI + 8}
                y={i * CAO_HANG + CAO_COT}
              >
                {tong.toLocaleString("vi-VN")}
              </text>
            </g>
          );
        })}
      </svg>

      <figcaption>
        {phan.map((p) => (
          <span key={p.ma} className="chu-thich">
            <span className="o-mau" style={{ background: p.mau }} />
            {p.ten}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
