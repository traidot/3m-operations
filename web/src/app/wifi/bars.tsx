/**
 * Biểu đồ cột nhóm, vẽ thẳng bằng SVG — không kéo thư viện về cho vài cái cột.
 * Mọi chuỗi trên cùng một trục nên chỉ dùng khi chúng cùng đơn vị.
 */
export type Series = { ten: string; mau: string; gia_tri: (number | null)[] };

export function Bars({
  nhan,
  chuoi,
  dinhDang = (v) => v.toLocaleString("vi-VN"),
  cao = 200,
}: {
  nhan: string[];
  chuoi: Series[];
  dinhDang?: (v: number) => string;
  cao?: number;
}) {
  const rong = 720;
  const leTrai = 8;
  const leDuoi = 34;
  const leTren = 8;
  const dat = cao - leDuoi - leTren;

  const dinh = Math.max(
    1,
    ...chuoi.flatMap((s) => s.gia_tri.map((v) => v ?? 0)),
  );

  const oRong = (rong - leTrai * 2) / Math.max(nhan.length, 1);
  // Nhãn ngày chen nhau khi có 30 cột, thưa bớt cho vừa chỗ.
  const buoc = Math.max(1, Math.ceil(34 / Math.max(oRong, 1)));
  const cotRong = Math.min(18, (oRong - 10) / chuoi.length);

  return (
    <figure className="chart">
      {/* Không dùng thẻ title trong SVG: React nhấc nó lên head của trang, làm
          lệch giữa server và client. Mô tả để ở aria-label, số chi tiết nằm ở
          bảng bên dưới. */}
      <svg
        viewBox={`0 0 ${rong} ${cao}`}
        role="img"
        width="100%"
        aria-label={`${chuoi.map((s) => s.ten).join(", ")} theo tháng`}
      >
        <line
          className="truc"
          x1={leTrai}
          y1={leTren + dat}
          x2={rong - leTrai}
          y2={leTren + dat}
        />

        {nhan.map((thang, i) => {
          const goc = leTrai + i * oRong + (oRong - cotRong * chuoi.length) / 2;
          return (
            <g key={thang}>
              {chuoi.map((s, j) => {
                const v = s.gia_tri[i] ?? 0;
                const h = Math.max(v > 0 ? 1.5 : 0, (v / dinh) * dat);
                return (
                  <rect
                    key={s.ten}
                    x={goc + j * cotRong}
                    y={leTren + dat - h}
                    width={cotRong - 2}
                    height={h}
                    fill={s.mau}
                  />
                );
              })}
              {i % buoc === 0 && (
                <text
                  className="nhan-truc"
                  x={leTrai + i * oRong + oRong / 2}
                  y={cao - 18}
                  textAnchor="middle"
                >
                  {thang.slice(5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <figcaption>
        {chuoi.map((s) => (
          <span key={s.ten} className="chu-thich">
            <span className="o-mau" style={{ background: s.mau }} />
            {s.ten}
          </span>
        ))}
        <span className="dinh-truc">cao nhất {dinhDang(dinh)}</span>
      </figcaption>
    </figure>
  );
}
