/** Trạng thái bên hệ thống nguồn viết bằng mã, dịch ra cho dễ đọc. */
export const HOP_DONG: Record<string, string> = {
  ACTIVE: "đang chạy",
  TERMINATED: "đã huỷ",
  SUSPENDED: "tạm ngưng",
  PENDING: "chưa rõ",
};

export const LAP_DAT: Record<string, string> = {
  DONE: "lắp xong",
  SURVEY: "chưa lắp",
  CANCELLED: "huỷ lắp",
};

export const TINH_TRANG_CUOC: Record<string, string> = {
  DU: "thu đủ",
  NO: "còn nợ",
  CHUA_TINH_DUOC: "chưa tính được",
};

export const KY_CUOC: Record<string, string> = {
  DA_THU: "đã thu",
  MIEN_PHI: "miễn phí",
  CHO_DUYET: "chờ duyệt",
  GHI_CHU: "chỉ ghi chú",
  NO: "chưa thu",
};

export const CANH_BAO: Record<string, string> = {
  NO_NANG: "nợ nặng",
  HUY_CON_NO: "huỷ còn nợ",
  THIEU_CUOC: "thiếu giá cước",
  CHO_DUYET: "chờ duyệt",
  GHI_CHU: "chỉ ghi chú",
  NGOAI_KY: "kỳ ngoài khoảng",
  THU_THIEU: "thu thiếu tiền",
  KHO_DOI: "khách khó đòi",
  CHO_LAP_LAU: "chờ lắp lâu",
};

/** Ba cái này là mất tiền hoặc không tính được tiền, tô đỏ; còn lại là nhắc việc. */
export const CANH_BAO_NANG = new Set([
  "NO_NANG",
  "HUY_CON_NO",
  "THIEU_CUOC",
  "THU_THIEU",
  "KHO_DOI",
]);

/**
 * Màu cho chip trạng thái. Cố tình nhạt hơn thẻ cảnh báo: đây là sự thật về
 * hợp đồng, không phải việc phải làm. "Đã huỷ" là trung tính, không phải lỗi.
 */
export const MAU_TRANG_THAI: Record<string, string> = {
  // hợp đồng
  ACTIVE: "ok",
  TERMINATED: "tat",
  SUSPENDED: "warn",
  PENDING: "cho",
  // lắp đặt
  DONE: "ok",
  SURVEY: "cho",
  CANCELLED: "tat",
  // tình trạng cước
  DU: "ok",
  NO: "xau",
  CHUA_TINH_DUOC: "cho",
};

export const LY_DO_HUY: Record<string, string> = {
  KHONG_LIEN_LAC: "không liên lạc được",
  NHA_MANG_TU_CHOI: "nhà mạng không cung cấp",
  CHUYEN_NHA: "khách chuyển nhà, về nước",
  TOA_NHA_TU_CHOI: "toà nhà không cho lắp",
  KHACH_KHONG_CHO_DUOC: "khách không chờ được",
  DA_DANG_KY_NOI_KHAC: "khách đã đăng ký nơi khác",
  KHACH_DOI_Y: "khách đổi ý",
  DON_TRUNG_HOAC_SAI: "đơn trùng hoặc nhập sai",
  HET_SLOT: "hết slot",
  SONG_YEU: "sóng yếu",
  KHAC: "khác",
  KHONG_GHI: "không ghi lý do",
};
