import { getDoiChieuCms } from "@/lib/queries";

const n = (v: string | null) => (v === null ? "—" : Number(v).toLocaleString("vi-VN"));

/**
 * Khối giải thích vì sao số của mình khác báo cáo CMS. Gấp lại mặc định: chỉ
 * cần tới khi có người cầm báo cáo bên đó sang hỏi.
 */
export async function DoiChieuCms() {
  const rows = await getDoiChieuCms();
  if (rows.length === 0) return null;

  const sot = rows.reduce((t, r) => t + Number(r.minh_them_khac), 0);
  const ganNhat = rows[0];
  const xaNhat = rows[rows.length - 1];

  return (
    <details className="doi-chieu">
      <summary>
        Đối chiếu với báo cáo “Thống kê cước phí” bên CMS — vì sao hai bên lệch
      </summary>

      <p className="muted">
        Luật của CMS, dò ngược từ bản xuất Excel: <b>ngày bắt đầu thu ≤ cuối tháng</b>, cước
        {" > "}0, đã lắp xong, và <b>trạng thái hợp đồng đang hoạt động</b>. Điều kiện cuối đọc
        trạng thái <b>hôm nay</b> chứ không phải hồi tháng đó — nên báo cáo CMS xoá hồi tố:
        hợp đồng huỷ tháng này thì biến mất khỏi cả những tháng trước. Tháng càng lùi càng hụt,
        từ {n(ganNhat?.huy_sau ?? null)} hợp đồng ở {ganNhat?.ky} lên{" "}
        {n(xaNhat?.huy_sau ?? null)} ở {xaNhat?.ky}.
      </p>

      <div className="scroller">
        <table className="bang-thang">
          <thead>
            <tr>
              <th rowSpan={2}>Kỳ</th>
              <th colSpan={2} className="nhom">Hợp đồng</th>
              <th colSpan={2} className="nhom">Chênh do đâu</th>
              <th colSpan={2} className="nhom">Tiền phải thu</th>
            </tr>
            <tr>
              <th className="num">Mình</th>
              <th className="num">Kiểu CMS</th>
              <th className="num" title="Mình có, CMS mất: hợp đồng đã huỷ sau tháng đó">
                Huỷ sau
              </th>
              <th className="num" title="CMS có, mình bỏ: đã qua ngày kết thúc thu nhưng chưa ai bấm huỷ">
                Hết hạn chưa huỷ
              </th>
              <th className="num">Mình</th>
              <th className="num">Kiểu CMS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ky}>
                <td className="mono">{r.ky}</td>
                <td className="num mono">{n(r.minh_hop_dong)}</td>
                <td className="num mono muted">{n(r.cms_hop_dong)}</td>
                <td className={`num mono${Number(r.huy_sau) > 0 ? " bad" : " muted"}`}>
                  {Number(r.huy_sau) > 0 ? `+${n(r.huy_sau)}` : "—"}
                </td>
                <td className="num mono muted">
                  {Number(r.het_han_chua_huy) + Number(r.cms_them_khac) > 0
                    ? `−${n(String(Number(r.het_han_chua_huy) + Number(r.cms_them_khac)))}`
                    : "—"}
                </td>
                <td className="num mono">{n(r.minh_tien)}</td>
                <td className="num mono muted">{n(r.cms_tien)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="muted khoi-ghi-chu">
        {sot === 0 ? (
          <>
            ✓ Chênh lệch giải thích hết bằng hai nguyên nhân trên, không còn dư ở tháng nào:
            số của mình = số kiểu CMS + huỷ sau − hết hạn chưa huỷ.
          </>
        ) : (
          <>
            ⚠ Còn {n(String(sot))} hợp đồng chênh mà hai nguyên nhân trên không giải thích
            được — luật dò ngược đang sót điều kiện nào đó.
          </>
        )}{" "}
        Bảng này <b>không</b> dùng để sửa số của mình. Luật của mình đúng hơn ở ba chỗ: xét
        theo trạng thái <b>tại tháng đó</b>, có kiểm mốc kết thúc thu, và bắt buộc lắp xong
        trước tháng đó. Đây chỉ là chỗ giải thích khi ai đó cầm báo cáo CMS sang hỏi.
      </p>
    </details>
  );
}
