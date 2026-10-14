import ExcelJS from "exceljs";
import { getThuChuaCanTru } from "@/lib/queries";
import { KENH_THU, LOAI_KHACH } from "@/lib/nhan";

const so = (v: string | null) => (v === null ? null : Number(v));

/** Hai kiểu chưa cấn, cách sửa khác nhau nên phải đọc ra được trong file. */
const LY_DO: Record<string, string> = {
  CHUA_CAN_TRU: "Chưa cấn lần nào",
  CAN_TRU_HOA_DON_XOA: "Đã cấn nhưng hoá đơn bị xoá",
};

/**
 * Toàn bộ tiền cầm tay đã về mà chưa cấn vào hoá đơn nào.
 *
 * Không giới hạn 28 ngày như bảng tiền theo ngày: khoản treo lâu nhất mới là
 * khoản đáng đi đòi, mà nó thì nằm ngoài cửa sổ của bảng. Xếp theo số ngày
 * treo giảm dần, sẵn bộ lọc trên dòng đầu để lọc theo kênh hay loại khách.
 */
export async function GET() {
  const ds = await getThuChuaCanTru();

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Chưa cấn hoá đơn", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  ws.columns = [
    { header: "Ngày tiền về", key: "ngay", width: 13 },
    { header: "Số ngày treo", key: "treo", width: 13, style: { numFmt: "#,##0" } },
    { header: "Khách", key: "khach", width: 28 },
    { header: "Mã khách", key: "ma_khach", width: 12 },
    { header: "Loại khách", key: "loai", width: 16 },
    { header: "Tiền", key: "tien", width: 12, style: { numFmt: "#,##0" } },
    { header: "Kênh thu", key: "kenh", width: 22 },
    { header: "Mã tham chiếu", key: "ref", width: 20 },
    { header: "Lý do", key: "ly_do", width: 26 },
    { header: "Link CMS", key: "link", width: 60 },
  ];
  ws.getRow(1).font = { bold: true };

  for (const r of ds) {
    ws.addRow({
      ngay: r.paid_at.slice(0, 10),
      treo: so(r.so_ngay_treo),
      khach: r.khach,
      ma_khach: r.ma_khach,
      loai: LOAI_KHACH[r.loai_khach ?? ""] ?? r.loai_khach,
      tien: so(r.amount),
      kenh: KENH_THU[r.channel ?? ""] ?? r.channel,
      ref: r.reference,
      ly_do: LY_DO[r.ly_do] ?? r.ly_do,
      link: r.link_cms,
    });
  }

  // Dòng tổng đặt cuối để mở file ra là biết đang nói về bao nhiêu tiền.
  const tong = ds.reduce((t, r) => t + Number(r.amount), 0);
  const dongTong = ws.addRow({ khach: `Tổng ${ds.length} khoản`, tien: tong });
  dongTong.font = { bold: true };

  ws.autoFilter = { from: "A1", to: { row: 1, column: ws.columns.length } };

  const buf = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="tien-chua-can-hoa-don-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
