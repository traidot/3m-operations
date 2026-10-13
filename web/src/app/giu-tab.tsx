/**
 * Giữ tham số chọn màn khi gửi form tìm kiếm.
 *
 * Form GET thay sạch query string bằng đúng các ô nằm trong nó, nên `tab` và
 * `goc` — hai tham số trang cha đọc để biết đang hiện màn nào — rụng mất. Trang
 * rơi về tab đầu tiên, nhìn như bấm tìm kiếm là bị reset.
 */
export function GiuTab({
  sp,
}: {
  sp: Record<string, string | string[] | undefined>;
}) {
  return (
    <>
      {(["tab", "goc"] as const).map((k) => {
        const v = Array.isArray(sp[k]) ? sp[k][0] : sp[k];
        return v ? <input key={k} type="hidden" name={k} value={v} /> : null;
      })}
    </>
  );
}
