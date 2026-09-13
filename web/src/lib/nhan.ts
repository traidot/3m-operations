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
};

/**
 * Hai tình trạng này nghĩa là hệ thống không sinh được kỳ nào, nên cột "tổng
 * kỳ" và "kỳ nợ" phải để gạch chứ không phải số 0 — 0 đọc ra là "đã kiểm, không
 * nợ", trong khi sự thật là chưa tính.
 */
export const KHONG_SINH_KY = new Set(["CHUA_TINH_DUOC", "CHUA_LAP"]);

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
  THIEU_HOA_DON: "đang chạy mà không có hoá đơn",
  THIEU_GIA: "thiếu giá gói",
  MAY_CHUA_TRA: "máy chưa thu hồi",
};

/** Mất tiền hoặc không tính được tiền thì đỏ, còn lại là nhắc việc. */
export const CANH_BAO_TELECOM_NANG = new Set([
  "NO_QUA_HAN",
  "KHONG_DOI_DUOC",
  "THIEU_HOA_DON",
]);

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
