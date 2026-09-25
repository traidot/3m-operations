import type { Contract } from "./queries";

/**
 * Diễn giải từng cảnh báo thành câu có số liệu thật.
 *
 * Chip trên trang chỉ nói "có cảnh báo gì"; muốn biết nặng nhẹ ra sao thì phải
 * mở ngăn kéo từng hợp đồng. Xuất Excel mà chỉ chép nhãn chip thì người nhận
 * file không tra được. Hàm này dựng đúng câu mà ngăn kéo đang hiện, để màn
 * hình và file nói cùng một chuyện.
 */

const n = (v: string | number | null) =>
  v === null ? "0" : Math.round(Number(v)).toLocaleString("vi-VN");

const soNgay = (tu: string | null, den: string | null) =>
  tu && den ? Math.round((Date.parse(den) - Date.parse(tu)) / 86_400_000) : null;

/** Số ngày lệch giữa ngày ngừng thu trên sổ và ngày dịch vụ thật sự dừng. */
export const lechKetThucThu = (hd: {
  fee_end_on: string | null;
  ngay_huy: string | null;
}) => soNgay(hd.fee_end_on, hd.ngay_huy);

/** Câu giải thích cho cảnh báo huỷ lệch kỳ — dùng chung cho ngăn kéo và Excel. */
export function cauHuyLechKy(hd: {
  fee_end_on: string | null;
  ngay_huy: string | null;
}): string | null {
  const lech = lechKetThucThu(hd);
  if (lech === null) return null;
  return lech > 0
    ? `sổ ngừng thu từ ${hd.fee_end_on} nhưng dịch vụ tới ${hd.ngay_huy} mới dừng — mấy tháng ở giữa khách vẫn dùng mà không ra kỳ cước nào.`
    : `dịch vụ dừng từ ${hd.ngay_huy} nhưng sổ vẫn thu tới ${hd.fee_end_on} — phần sau ngày huỷ là thu thừa.`;
}

const CAU: Record<string, (r: Contract) => string | null> = {
  NO_NANG: (r) =>
    `Nợ nặng: ${r.so_ky_no} kỳ chưa thu, còn nợ ${n(r.con_no)}`,
  HUY_CON_NO: (r) =>
    `Huỷ ngày ${r.ngay_huy ?? "?"} mà còn phải đòi ${n(r.con_no_sau_coc)}`,
  CO_COC: (r) =>
    `${r.so_phieu_coc_cho} phiếu cọc chờ duyệt, ${n(r.coc_cho_duyet)} — tiền khách đã nộp mà chưa ai bấm duyệt`,
  THIEU_GIA_CUOC: () =>
    "Hợp đồng đang chạy mà chưa có giá cước tháng nên không sinh được kỳ nào",
  THIEU_NGAY_THU: () =>
    "Hợp đồng đang chạy mà chưa có ngày bắt đầu thu nên không sinh được kỳ nào",
  CHO_DUYET: (r) =>
    `${r.ky_cho_duyet} kỳ đang chờ duyệt` +
    (Number(r.tien_treo_duyet) > 0 ? `, treo ${n(r.tien_treo_duyet)}` : ""),
  GHI_CHU: (r) => `${r.ky_ghi_chu} kỳ chỉ ghi chú, không ra tiền`,
  NGOAI_KY: (r) =>
    `${r.ky_ngoai} kỳ nằm ngoài khoảng ${r.fee_start_on ?? "?"} → ${r.fee_end_on ?? "?"}`,
  THU_THIEU: () => "Có kỳ thu ít hơn cước tháng — chênh nằm ở từng kỳ, mở hợp đồng để xem",
  KHO_DOI: (r) =>
    "Nguồn đánh dấu khách khó đòi" +
    (Number(r.con_no) > 0 ? `, còn nợ ${n(r.con_no)}` : ""),
  CHO_LAP_LAU: (r) => {
    const cho = soNgay(r.ngay_ky, new Date().toISOString().slice(0, 10));
    return `Ký ${r.ngay_ky ?? "?"} mà vẫn đang khảo sát, chưa lắp` +
      (cho !== null ? ` — đã ${cho} ngày` : "");
  },
  HUY_LECH_KY: (r) => {
    const lech = lechKetThucThu(r);
    const cau = cauHuyLechKy(r);
    return lech === null || cau === null
      ? null
      : `Ngày kết thúc thu lệch ngày huỷ ${Math.abs(lech)} ngày: ${cau}`;
  },
};

/** Một câu cho mỗi cảnh báo của hợp đồng, theo đúng thứ tự cảnh báo. */
export function lyDoCanhBao(r: Contract): string[] {
  return r.canh_bao
    .map((cb) => CAU[cb]?.(r) ?? null)
    .filter((x): x is string => x !== null);
}
