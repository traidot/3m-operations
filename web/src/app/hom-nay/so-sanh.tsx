/** Lệch bao nhiêu phần trăm so với cùng kỳ; null khi nền quá nhỏ để chia. */
const lech = (nay: number, truoc: number) =>
  truoc < 1 ? null : Math.round(((nay - truoc) / truoc) * 100);

/**
 * "+18%" / "−48%", tô màu theo chiều tốt hay xấu.
 *
 * `tangLaTot` phải nói rõ ở từng chỗ dùng: doanh thu tăng là tốt, huỷ tăng là
 * xấu, mà cả hai đều là "tăng".
 */
export function SoSanh({
  nay,
  truoc,
  tangLaTot,
}: {
  nay: number;
  truoc: number;
  tangLaTot: boolean;
}) {
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
