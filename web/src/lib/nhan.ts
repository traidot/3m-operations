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
  CHUA_LAP: "chưa phát sinh",
  DAI_LY: "đại lý tự thu",
};

/**
 * Hai tình trạng này nghĩa là hệ thống không sinh được kỳ nào, nên cột "tổng
 * kỳ" và "kỳ nợ" phải để gạch chứ không phải số 0 — 0 đọc ra là "đã kiểm, không
 * nợ", trong khi sự thật là chưa tính.
 */
export const KHONG_SINH_KY = new Set(["CHUA_TINH_DUOC", "CHUA_LAP", "DAI_LY"]);

export const KY_CUOC: Record<string, string> = {
  DA_THU: "đã thu",
  MIEN_PHI: "miễn phí",
  CHO_DUYET: "chờ duyệt",
  GHI_CHU: "chỉ ghi chú",
  NO: "chưa thu",
  CHUA_DEN_HAN: "chưa tới hạn",
  CHO_COC: "đã nộp, chờ duyệt",
};

export const CANH_BAO: Record<string, string> = {
  NO_NANG: "nợ nặng",
  HUY_CON_NO: "huỷ còn nợ",
  THIEU_GIA_CUOC: "thiếu giá cước",
  THIEU_NGAY_THU: "thiếu ngày bắt đầu thu",
  CHO_DUYET: "chờ duyệt",
  GHI_CHU: "chỉ ghi chú",
  NGOAI_KY: "kỳ ngoài khoảng",
  THU_THIEU: "thu thiếu tiền",
  KHO_DOI: "khách khó đòi",
  CHO_LAP_LAU: "chờ lắp lâu",
  CO_COC: "có cọc chờ duyệt",
};

/** Ba cái này là mất tiền hoặc không tính được tiền, tô đỏ; còn lại là nhắc việc. */
export const CANH_BAO_NANG = new Set([
  "NO_NANG",
  "HUY_CON_NO",
  "THIEU_GIA_CUOC",
  "THIEU_NGAY_THU",
  "THU_THIEU",
  "KHO_DOI",
]);

/**
 * Màu cho chip trạng thái. Cố tình nhạt hơn thẻ cảnh báo: đây là sự thật về
 * hợp đồng, không phải việc phải làm. Riêng hợp đồng đã huỷ tô đỏ — mất khách
 * là chuyện phải thấy ngay, không phải trạng thái trung tính như máy đã trả.
 */
export const MAU_TRANG_THAI: Record<string, string> = {
  // hợp đồng
  ACTIVE: "ok",
  TERMINATED: "xau",
  SUSPENDED: "warn",
  PENDING: "cho",
  // lắp đặt
  DONE: "ok",
  SURVEY: "cho",
  CANCELLED: "tat",
  // máy và cọc — PENDING đã khai ở nhánh hợp đồng, cùng màu "cho" nên dùng chung
  RENTING: "ok",
  NOT_RETURNED: "xau",
  NOT_RETURNABLE: "xau",
  RETURNED: "tat",
  // hoá đơn
  PAID: "ok",
  ISSUED: "cho",
  UNPAYABLE: "xau",
  VOID: "tat",
  // tình trạng cước
  DU: "ok",
  NO: "xau",
  CHUA_TINH_DUOC: "cho",
  CHUA_LAP: "tat",
  DAI_LY: "tat",
};

/** Hợp đồng wifi cố định: công ty thu cước, hay đại lý tự thu. */
export const PHU_TRACH: Record<string, string> = {
  CONG_TY: "công ty",
  DAI_LY: "đại lý",
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

/**
 * Vai trò khách bên nguồn. Không phải trạng thái tốt/xấu nên chip dùng màu
 * phân loại (lam, tím) chứ không mượn màu cảnh báo.
 */
export const LOAI_KHACH: Record<string, string> = {
  CUSTOMER: "khách lẻ",
  COLLABORATOR: "cộng tác viên",
  AGENCY: "đại lý",
};

export const MAU_LOAI_KHACH: Record<string, string> = {
  CUSTOMER: "cam",
  COLLABORATOR: "ctv",
  AGENCY: "dai-ly",
};

/** Wifi cầm tay là dịch vụ chính, tô cam để nhặt ra giữa các dòng sim. */
export const MAU_DICH_VU: Record<string, string> = {
  WIFI_DEVICE: "cam",
};

/** Tình huống của một đơn lắp, xét cả trạng thái lắp lẫn trạng thái hợp đồng. */
/** Bảy tình huống của một đơn lắp, chia như báo cáo tổng hợp bên CMS. */
export const TINH_HUONG_LAP: Record<string, string> = {
  CHUA_CO_LICH: "chưa có lịch lắp",
  CO_LICH: "có lịch, chưa lắp",
  LAP_XONG: "lắp đặt thành công",
  LAP_HONG: "lắp đặt thất bại",
  HUY_TRUOC_LICH: "huỷ trước khi có lịch",
  HUY_SAU_LICH: "huỷ sau khi có lịch",
  HUY_SAU_LAP: "huỷ sau khi lắp xong",
};

export const DICH_VU: Record<string, string> = {
  WIFI_DEVICE: "wifi cầm tay",
  SOFTBANK_SIM: "sim Softbank",
  DATA_CALL_SIM: "sim datacall",
  ONE_YEAR_DATA_SIM: "sim data 1 năm",
  FIXED_INTERNET: "wifi cố định",
};

export const CANH_BAO_TELECOM: Record<string, string> = {
  NO_QUA_HAN: "nợ quá hạn",
  KHONG_DOI_DUOC: "có hoá đơn mất trắng",
  THIEU_HOA_DON: "lâu không có hoá đơn",
  KHONG_RA_CUOC: "kỳ này không ra cước",
  HET_HAN: "hết hạn mà vẫn đang chạy",
  MAY_CHUA_TRA: "máy chưa thu hồi",
};

/** Mất tiền hoặc không tính được tiền thì đỏ, còn lại là nhắc việc. */
export const CANH_BAO_TELECOM_NANG = new Set([
  "NO_QUA_HAN",
  "KHONG_DOI_DUOC",
  "THIEU_HOA_DON",
  "KHONG_RA_CUOC",
  "HET_HAN",
]);

/** Loại hoá đơn bên nguồn cầm tay. REFUND mang số âm: 3M nợ khách. */
export const LOAI_HOA_DON: Record<string, string> = {
  SUBSCRIPTION: "cước tháng",
  ORDER: "đơn hàng",
  OTHER: "thu khác",
  REFUND: "hoàn tiền",
};

export const HOA_DON: Record<string, string> = {
  PAID: "đã thu",
  ISSUED: "đang đòi",
  UNPAYABLE: "không đòi được",
  VOID: "đã huỷ",
};

/** Trạng thái một tháng cước bên mảng cầm tay, đọc thẳng từ hoá đơn. */
export const KY_TELECOM: Record<string, string> = {
  DA_THU: "đã thu",
  DANG_DOI: "đang đòi",
  MAT: "mất trắng",
  NA: "không có hoá đơn",
};

export const LOP_KY_TELECOM: Record<string, string> = {
  DA_THU: "da-thu",
  DANG_DOI: "cho-duyet",
  MAT: "mat",
  NA: "na",
};

export const MAY: Record<string, string> = {
  RENTING: "đang thuê",
  NOT_RETURNED: "chưa trả",
  RETURNED: "đã trả",
};

/**
 * Trạng thái tiền cọc bên nguồn. "PENDING" nghĩa là 3M đang giữ tiền cọc, chưa
 * hoàn cho khách cũng chưa quyết định giữ luôn — với máy đang thuê thì đó là
 * bình thường, chỉ thành việc khi thuê bao đã ngừng.
 */
export const COC: Record<string, string> = {
  PENDING: "còn giữ",
  RETURNED: "đã hoàn",
  NOT_RETURNABLE: "không hoàn",
};

export const NHOM_COC: Record<string, string> = {
  CHUA_TRA: "máy chưa trả",
  NGUNG_CHUA_CHOT: "ngừng dịch vụ mà chưa chốt cọc",
  KHONG_CO_PHIEU: "không có phiếu thuê",
  DANG_THUE: "đang thuê bình thường",
  XONG: "đã xử lý xong",
};

/** Ba nhóm đầu là việc phải làm, hai nhóm sau chỉ để đối chiếu. */
export const NHOM_COC_VIEC = ["CHUA_TRA", "NGUNG_CHUA_CHOT", "KHONG_CO_PHIEU"];

/** Hai hệ thống nguồn của lượt đồng bộ, đúng tên khoá bên agent/src/sync/run.ts. */
export const NGUON_DONG_BO: Record<string, string> = {
  FIXED: "wifi cố định",
  TELECOM: "wifi cầm tay",
};

/** Vì sao một kỳ đã thu lại nằm ngoài khoảng thu của hợp đồng. */
export const THU_NGOAI: Record<string, string> = {
  THU_SAU_HUY: "thu sau khi huỷ",
  THU_TRUOC_ROI_HUY: "thu trước rồi mới huỷ",
  THU_TRUOC_LAP: "thu trước khi lắp xong",
  THU_TRUOC_KY: "thu trước ngày bắt đầu thu",
  CHUA_DAT_COC: "hợp đồng chưa đặt cước",
  DAI_LY: "hợp đồng của đại lý",
};

/** Hai cái này là tiền sai chỗ phải xử lý, còn lại là dữ liệu cần dọn. */
export const THU_NGOAI_NANG = new Set(["THU_SAU_HUY", "THU_TRUOC_ROI_HUY"]);

export const THU_NGOAI_CACH_XU_LY: Record<string, string> = {
  THU_SAU_HUY: "Hợp đồng đã huỷ trước khi thu — thu nhầm, khách đòi lại được.",
  THU_TRUOC_ROI_HUY: "Thu gộp xong mới huỷ — tiền của tháng không còn dịch vụ, phải hoàn khách.",
  THU_TRUOC_LAP: "Thu cho tháng máy chưa về nhà khách.",
  THU_TRUOC_KY: "Thu trước ngày bắt đầu thu ghi trên hợp đồng.",
  CHUA_DAT_COC: "Hợp đồng chưa điền giá hoặc ngày bắt đầu thu nên không có khoảng nào để đối chiếu.",
  DAI_LY: "Đại lý tự thu, mình không quản cước của họ.",
};
