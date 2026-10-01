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
  moiNhan = false,
}: {
  nhan: string[];
  chuoi: Series[];
  dinhDang?: (v: number) => string;
  cao?: number;
  /** Hiện nhãn của MỌI cột, xoay nghiêng cho khỏi chen nhau. Dùng khi trục là
   *  ngày trong tháng — nhảy cóc hai ngày một thì không dò ra cột nào là ngày
   *  nào. */
  moiNhan?: boolean;
}) {
  const rong = 720;
  const leTrai = 8;
  // Nhãn xoay nghiêng chiếm nhiều chiều cao hơn nhãn nằm ngang.
  const leDuoi = moiNhan ? 44 : 34;
  const leTren = 8;
  const dat = cao - leDuoi - leTren;

  const dinh = Math.max(
    1,
    ...chuoi.flatMap((s) => s.gia_tri.map((v) => v ?? 0)),
  );

  const oRong = (rong - leTrai * 2) / Math.max(nhan.length, 1);
  // Nhãn ngày chen nhau khi có 30 cột, thưa bớt cho vừa chỗ — trừ khi người
  // gọi muốn thấy đủ, lúc đó xoay nghiêng thay vì bỏ bớt.
  const buoc = moiNhan ? 1 : Math.max(1, Math.ceil(34 / Math.max(oRong, 1)));
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
          // Cột hẹp vài pixel thì không ghi số lên được; rê chuột vào đâu trong
          // ô ngày cũng đọc được cả cụm. Không dùng thẻ title của SVG: React
          // nhấc nó lên head của trang. Thay bằng text ẩn sẵn, CSS cho hiện
          // khi hover — không cần JS, không lệch server với client.
          const chu =
            `${thang} · ` +
            chuoi.map((s) => `${s.ten} ${dinhDang(s.gia_tri[i] ?? 0)}`).join(" · ");
          // Ô ở mép thì neo chữ vào trong, không thì tooltip tràn khỏi khung.
          const neo = i < 5 ? "start" : i > nhan.length - 6 ? "end" : "middle";
          return (
            <g key={thang} className="o-ngay">
              <rect
                x={leTrai + i * oRong}
                y={leTren}
                width={oRong}
                height={dat}
                fill="transparent"
              />
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
              {i % buoc === 0 &&
                (moiNhan ? (
                  <text
                    className="nhan-truc"
                    x={leTrai + i * oRong + oRong / 2}
                    y={cao - 26}
                    textAnchor="end"
                    transform={`rotate(-60 ${leTrai + i * oRong + oRong / 2} ${cao - 26})`}
                  >
                    {/* Dùng nguyên nhãn người gọi truyền: ở chế độ này trục là
                        ngày trong tháng, cắt năm-tháng như nhánh kia thì mất
                        sạch chữ. */}
                    {thang}
                  </text>
                ) : (
                  <text
                    className="nhan-truc"
                    x={leTrai + i * oRong + oRong / 2}
                    y={cao - 18}
                    textAnchor="middle"
                  >
                    {thang.slice(5)}
                  </text>
                ))}
              <text
                className="tip"
                x={
                  neo === "start"
                    ? leTrai
                    : neo === "end"
                      ? rong - leTrai
                      : leTrai + i * oRong + oRong / 2
                }
                y={leTren + 10}
                textAnchor={neo}
              >
                {chu}
              </text>
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
