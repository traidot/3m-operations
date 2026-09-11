export type Stage = { ten: string; gia_tri: number | null; ghi_chu?: string };

/**
 * Phễu vẽ đúng tỉ lệ: bề rộng mỗi bậc theo giá trị thật.
 *
 * Nếu một bậc rộng hơn bậc trên thì phễu phình ra — cố tình để vậy. Ở đây hợp
 * đồng ký được nhiều hơn số đơn marketing tự khai, ép cho thon lại là giấu mất
 * chuyện đó.
 */
export function Funnel({ bac, dinhDang = (v) => v.toLocaleString("vi-VN") }: {
  bac: Stage[];
  dinhDang?: (v: number) => string;
}) {
  const rong = 720;
  const giua = rong / 2;
  const caoBac = 74;
  const khe = 6;
  const toiDa = Math.max(1, ...bac.map((b) => b.gia_tri ?? 0));
  const rongToiDa = 460;
  const rongToiThieu = 56;

  const beRong = (v: number | null) =>
    Math.max(rongToiThieu, ((v ?? 0) / toiDa) * rongToiDa);

  const cao = bac.length * (caoBac + khe);

  return (
    <figure className="chart pheu">
      <svg viewBox={`0 0 ${rong} ${cao}`} width="100%" role="img"
           aria-label={`Phễu ${bac.map((b) => b.ten).join(" → ")}`}>
        {bac.map((b, i) => {
          const tren = beRong(b.gia_tri);
          const duoi = beRong(bac[i + 1]?.gia_tri ?? b.gia_tri);
          const y = i * (caoBac + khe);
          const truoc = bac[i - 1]?.gia_tri ?? null;
          const tyLe =
            truoc && truoc > 0 && b.gia_tri !== null
              ? Math.round((b.gia_tri / truoc) * 1000) / 10
              : null;

          return (
            <g key={b.ten}>
              <polygon
                className={`bac bac-${i}`}
                points={[
                  `${giua - tren / 2},${y}`,
                  `${giua + tren / 2},${y}`,
                  `${giua + duoi / 2},${y + caoBac}`,
                  `${giua - duoi / 2},${y + caoBac}`,
                ].join(" ")}
              />

              <text className="pheu-ten" x={16} y={y + caoBac / 2 - 6}>{b.ten}</text>
              {b.ghi_chu && (
                <text className="pheu-ghi-chu" x={16} y={y + caoBac / 2 + 12}>{b.ghi_chu}</text>
              )}

              <text className="pheu-so" x={giua} y={y + caoBac / 2 + 5} textAnchor="middle">
                {b.gia_tri === null ? "—" : dinhDang(b.gia_tri)}
              </text>

              {tyLe !== null && (
                <text
                  className={`pheu-ty-le ${tyLe > 100 ? "phinh" : ""}`}
                  x={rong - 16}
                  y={y + caoBac / 2 + 5}
                  textAnchor="end"
                >
                  {tyLe > 100 ? `↑ ${tyLe}%` : `${tyLe}%`}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
