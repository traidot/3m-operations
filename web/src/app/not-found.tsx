import Link from "next/link";

/**
 * Trang không có thật.
 *
 * Gần hết đường dẫn cũ đã bị gộp vào tab của bảy màn mới, nên người gõ lại
 * địa chỉ cũ hoặc mở bookmark cũ sẽ rơi vào đây. Vì vậy trang này phải dẫn
 * đường chứ không chỉ báo lỗi.
 */
export default function KhongThay() {
  return (
    <main>
      <h1>Không có trang này</h1>
      <p className="muted">
        Địa chỉ vừa mở không tồn tại. Nhiều màn cũ đã gộp lại thành tab bên
        trong bảy màn dưới đây, nên bookmark cũ thường rơi vào đây.
      </p>
      <ul>
        <li>
          <Link href="/diem-nghen">Điểm nghẽn</Link> — việc đang tắc ở trạm
          nào, gồm cả phần &ldquo;hôm nay&rdquo; và dòng chảy theo tháng
        </li>
        <li>
          <Link href="/viec-hom-nay/co-dinh">Việc hôm nay · cố định</Link> và{" "}
          <Link href="/viec-hom-nay/cam-tay">cầm tay</Link> — hàng đợi, công
          nợ, dự kiến huỷ
        </li>
        <li>
          <Link href="/tien/co-dinh">Tiền · cố định</Link> và{" "}
          <Link href="/tien/cam-tay">cầm tay</Link> — dòng tiền, cước theo
          tháng, lỗ hổng
        </li>
        <li>
          <Link href="/tra-cuu/co-dinh">Tra cứu · cố định</Link> và{" "}
          <Link href="/tra-cuu/cam-tay">cầm tay</Link> — hợp đồng, khách, máy,
          kho
        </li>
      </ul>
    </main>
  );
}
