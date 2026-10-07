/**
 * Nối một tham số vào đường dẫn có thể đã sẵn phần truy vấn.
 *
 * Mọi bảng đều nhận đường dẫn màn chứa nó (`moTai`) rồi tự gắn tham số mở ngăn
 * kéo. Lúc màn còn nằm ở URL trần thì `?` chạy đúng, nhưng khi màn đó bị gộp
 * vào một màn khác dưới dạng tab thì `moTai` đã mang sẵn `?tab=...`, và nối
 * thêm `?` nữa ra hai dấu hỏi — trình duyệt coi phần sau là một tham số dài vô
 * nghĩa, mọi bộ lọc im lặng biến mất. Lỗi này đã xảy ra hai lần.
 */
export const them = (goc: string, tham: string) =>
  `${goc}${goc.includes("?") ? "&" : "?"}${tham}`;
