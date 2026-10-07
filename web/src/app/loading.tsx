/**
 * Màn chờ dùng chung.
 *
 * Mấy bảng ở đây gom vài nghìn dòng nên có trang mất một hai giây mới hiện.
 * Không có màn chờ thì trình duyệt đứng im ở trang cũ, người dùng bấm lại lần
 * nữa và càng lâu hơn.
 */
export default function DangTai() {
  return (
    <main>
      <p className="muted">Đang dựng số liệu…</p>
    </main>
  );
}
