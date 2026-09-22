import type { TelecomMay } from "@/lib/queries";

/**
 * Lọc theo việc phải làm, không phải theo trạng thái thô của nguồn. Bốn nhóm
 * đầu là bốn việc khác nhau, đừng gộp chung thành "chưa ra cước".
 */
export const KHONG_NHOM = "(không ghi nhóm)";

export const LOC: Record<string, { ten: string; hop: (r: TelecomMay) => boolean }> = {
  // Gộp mọi thứ đang có vấn đề vào một nút, để mở màn hình là thấy ngay phần
  // cần động tới. Máy đang ra cước, đã trả, và máy cho mượn còn đúng hạn thì
  // không nằm ở đây.
  //
  // KHÔNG gộp "còn nợ cước" vào đây: 799 trên 817 máy còn nợ là máy đang chạy
  // bình thường, chưa thu xong cước tháng này — gộp vào thì nút này ra 1.833
  // máy, tức 75% bảng, đọc ra không còn nghĩa gì. Nợ cước có nút riêng.
  co_canh_bao: {
    ten: "có cảnh báo",
    hop: (r) =>
      ["HUT_CUOC", "TB_DA_XOA", "HUY_CHUA_THU_MAY"].includes(r.tinh_trang_cuoc) ||
      (r.tinh_trang_cuoc === "CHUA_GAN" && !r.cho_muon),
  },
  hut_cuoc: { ten: "hụt cước", hop: (r) => r.tinh_trang_cuoc === "HUT_CUOC" },
  tb_da_xoa: { ten: "thuê bao đã xoá", hop: (r) => r.tinh_trang_cuoc === "TB_DA_XOA" },
  // Hai nút này phải đứng cạnh nhau và nhãn phải nói rõ có trừ máy cho mượn hay
  // không: 188 trên 192 máy chưa gắn thuê bao là đơn cho mượn chờ lắp wifi cố
  // định, nên nút thô đọc ra gần như chỉ toàn nhóm đó.
  chua_gan: {
    ten: "chưa gắn thuê bao — gồm cả cho mượn",
    hop: (r) => r.tinh_trang_cuoc === "CHUA_GAN",
  },
  chua_gan_la: {
    ten: "chưa gắn thuê bao — trừ cho mượn",
    hop: (r) => r.tinh_trang_cuoc === "CHUA_GAN" && !r.cho_muon,
  },
  huy_chua_thu_may: {
    ten: "huỷ rồi, chưa thu máy",
    hop: (r) => r.tinh_trang_cuoc === "HUY_CHUA_THU_MAY",
  },
  dang_ra_cuoc: { ten: "đang ra cước", hop: (r) => r.tinh_trang_cuoc === "DANG_RA_CUOC" },
  con_no: { ten: "còn nợ cước", hop: (r) => Number(r.chua_thu) > 0 },
  cho_muon: {
    ten: "cho mượn chờ lắp cố định",
    hop: (r) => r.cho_muon,
  },
  // Đơn bật cờ cho mượn, dịch vụ đã dừng, máy vẫn chưa về. Lưu ý 111 trên 120
  // cái đã từng ra cước — cờ cho mượn nói NGUỒN GỐC đơn (khách lấy máy trong
  // lúc chờ lắp cố định) chứ không có nghĩa là dùng miễn phí.
  cho_muon_can_doi: {
    ten: "cho mượn, dịch vụ dừng, máy chưa về",
    hop: (r) => r.cho_muon && r.tinh_trang_cuoc === "HUY_CHUA_THU_MAY",
  },
  // Nhóm mượn đúng nghĩa: không ra kỳ cước nào mà dịch vụ đã dừng.
  muon_that_chua_tra: {
    ten: "mượn thật (không kỳ cước nào), dịch vụ dừng",
    hop: (r) =>
      r.cho_muon && r.tinh_trang_cuoc === "HUY_CHUA_THU_MAY" && Number(r.so_ky) === 0,
  },
  chua_tra: { ten: "chưa trả máy", hop: (r) => r.trang_thai === "NOT_RETURNED" },
  da_tra: { ten: "đã trả", hop: (r) => r.trang_thai === "RETURNED" },
};

/** Lọc theo đúng luật của màn hình, để nút xuất Excel không lệch với bảng. */
export function locRows(
  rows: TelecomMay[],
  t: { loc?: string; q?: string; may?: string; lk?: string; nk?: string },
) {
  let r = t.loc && t.loc in LOC ? rows.filter(LOC[t.loc]!.hop) : rows;
  const tim = (t.q ?? "").trim().toLowerCase();
  if (tim) {
    r = r.filter((x) =>
      [x.imei, x.ma_khach, x.khach, x.thue_bao_hien_tai].some((v) =>
        v?.toLowerCase().includes(tim),
      ),
    );
  }
  if (t.lk) r = r.filter((x) => (x.loai_khach ?? "khong-ro") === t.lk);
  if (t.may) r = r.filter((x) => (t.may === "(trống)" ? !x.model : x.model === t.may));
  if (t.nk) r = r.filter((x) => (x.nhom_khach ?? KHONG_NHOM) === t.nk);
  return r;
}
