/** Trạng thái bên hệ thống nguồn viết bằng mã, dịch ra cho dễ đọc. */
export const HOP_DONG: Record<string, string> = {
  ACTIVE: "đang chạy",
  TERMINATED: "đã huỷ",
  SUSPENDED: "tạm ngưng",
  PENDING: "chưa rõ",
};

/**
 * Màu trạng thái hợp đồng / thuê bao. Đã huỷ để ĐỎ chứ không để xám: trong bảng
 * cước, một kỳ của thuê bao đã huỷ là kỳ không đòi được nữa — phải đập vào mắt
 * chứ không phải thông tin phụ.
 */
export const MAU_HOP_DONG: Record<string, string> = {
  ACTIVE: "ok",
  TERMINATED: "do",
  SUSPENDED: "cho",
  PENDING: "tat",
};

/**
 * Tình trạng vận hành thật của hợp đồng, ghép từ trạng thái hợp đồng + lắp đặt
 * + ngày bắt đầu thu. "Chưa hoạt động" là đã lắp xong nhưng chưa tới ngày thu —
 * ở trạng thái đó hợp đồng CHƯA THỂ sinh kỳ cước, nên không có kỳ là đúng chứ
 * không phải thiếu dữ liệu.
 */
export const VAN_HANH: Record<string, string> = {
  DANG_THU: "đang thu cước",
  CHUA_HOAT_DONG: "chưa hoạt động",
  CHUA_LAP: "chưa lắp xong",
  DA_HUY: "đã huỷ",
};

/** Chỉ hai tên này có trong bảng màu của nhãn; trạng thái bình thường để xám. */
export const MAU_VAN_HANH: Record<string, string> = {
  DANG_THU: "",
  CHUA_HOAT_DONG: "warn",
  CHUA_LAP: "",
  DA_HUY: "critical",
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
  HUY_LECH_KY: "huỷ lệch ngày kết thúc thu",
  CO_COC: "có cọc chờ duyệt",
};

/** Ba cái này là mất tiền hoặc không tính được tiền, tô đỏ; còn lại là nhắc việc. */
export const CANH_BAO_NANG = new Set([
  "NO_NANG",
  "HUY_CON_NO",
  "THIEU_GIA_CUOC",
  "THIEU_NGAY_THU",
  "THU_THIEU",
  "HUY_LECH_KY",
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

/**
 * Máy cầm tay chính là dịch vụ, nên máy còn nằm ở khách thì tháng nào cũng phải
 * ra cước. Sáu nhóm dưới đây loại trừ nhau và phủ hết mọi máy; bốn nhóm giữa là
 * bốn việc khác nhau chứ không phải một đống "chưa ra cước".
 */
export const MAY_CUOC: Record<string, string> = {
  DANG_RA_CUOC: "đang ra cước",
  HUT_CUOC: "hụt cước",
  HUY_CHUA_THU_MAY: "huỷ rồi, chưa thu máy",
  CHUA_GAN: "chưa gắn thuê bao",
  TB_DA_XOA: "thuê bao đã xoá",
  DA_TRA: "đã trả máy",
};

/**
 * Màu của từng tình trạng cước. Để một chỗ vì ba màn hình đang tô, mỗi nơi một
 * kiểu thì cùng một chữ lại đổi màu tuỳ trang.
 *
 * Đỏ dành riêng cho hụt cước: máy còn ở khách, dịch vụ còn hiệu lực, mà tháng
 * này không ra kỳ nào — đó là tiền chảy ra ngoài. Mấy tình trạng còn lại chỉ là
 * việc phải làm, để vàng.
 */
export const MAU_MAY_CUOC: Record<string, string> = {
  DANG_RA_CUOC: "ok",
  HUT_CUOC: "do",
  HUY_CHUA_THU_MAY: "cho",
  CHUA_GAN: "cho",
  TB_DA_XOA: "cho",
  DA_TRA: "tat",
};

/**
 * Kết luận của phần mềm về chỗ đứng của một mã thiết bị, đọc từ phiếu kho gần
 * nhất. Đây là kết luận SUY RA, không phải cột có sẵn bên nguồn.
 */
export const KHO_PM: Record<string, string> = {
  O_KHACH: "ở khách",
  TRONG_KHO: "trong kho",
  TRA_NCC: "đã trả nhà cung cấp",
  CHI_NHA_MANG: "chỉ thấy ở nhà mạng",
  PM_KHONG_BIET: "phần mềm không có mã này",
};

/**
 * Mã thiết bị không cùng một loại định danh — nhìn một cột số mà tưởng đồng
 * nhất là nguồn của mọi lỗi đối chiếu. Suy từ độ dài, xem db/131.
 */
export const LOAI_MA: Record<string, string> = {
  IMEI: "IMEI · máy wifi",
  SO_DIEN_THOAI: "số điện thoại · SIM",
  ICCID: "ICCID · SIM",
  KHAC: "không rõ loại",
};

/** Kênh khách trả tiền bên cầm tay, đọc thẳng từ payment.paymentMethod. */
export const KENH_THU: Record<string, string> = {
  GMO_CONVINIENCE_STORE: "cửa hàng tiện lợi (GMO)",
  YOUCHO_ARAI: "Yucho — Arai",
  YOUCHO_SON: "Yucho — Sơn",
  SBI: "SBI",
  ACB: "ACB",
  CASH: "tiền mặt",
};

/**
 * Máy wifi hay SIM. Quan trọng vì việc phải làm khác hẳn: máy wifi ở khách mà
 * dịch vụ dừng thì PHẢI ĐÒI VỀ — nó là tài sản, có cọc. SIM thì huỷ ở nhà mạng
 * là xong, không ai đi đòi cái sim về.
 */
export const NHOM_TB: Record<string, string> = {
  MAY_WIFI: "máy wifi",
  SIM: "SIM",
  KHONG_RO: "không rõ",
};

export const MAU_NHOM_TB: Record<string, string> = {
  MAY_WIFI: "may-wifi",
  SIM: "sim",
  KHONG_RO: "tat",
};

export const PHIEU_KHO: Record<string, string> = {
  INVENTORY_IN: "phiếu nhập",
  INVENTORY_OUT: "phiếu xuất",
};

export const NHOM_COC: Record<string, string> = {
  CHUA_TRA: "máy chưa trả",
  NGUNG_CHUA_CHOT: "ngừng dịch vụ mà chưa chốt cọc",
  CHUA_GAN: "chưa gắn thuê bao bao giờ",
  DANG_THUE: "đang thuê bình thường",
  XONG: "đã xử lý xong",
};

/** Ba nhóm đầu là việc phải làm, hai nhóm sau chỉ để đối chiếu. */
export const NHOM_COC_VIEC = ["CHUA_TRA", "NGUNG_CHUA_CHOT", "CHUA_GAN"];

/** Hai hệ thống nguồn của lượt đồng bộ, đúng tên khoá bên agent/src/sync/run.ts. */
export const NGUON_DONG_BO: Record<string, string> = {
  TELECOM: "wifi cầm tay",
  FIXED: "wifi cố định",
};

/** Mỗi nguồn một màu nút, để bấm nhầm nguồn thì nhận ra ngay. */
export const MAU_NGUON_DONG_BO: Record<string, string> = {
  TELECOM: "lam",
  FIXED: "primary",
};

/** Vì sao một kỳ đã thu lại nằm ngoài khoảng thu của hợp đồng. */
export const THU_NGOAI: Record<string, string> = {
  THU_SAU_HUY: "thu sau khi huỷ",
  THU_TRUOC_ROI_HUY: "thu trước rồi mới huỷ",
  THU_TRUOC_LAP: "thu trước khi lắp xong",
  CHUA_DAT_COC: "hợp đồng chưa đặt cước",
};

/** Hai cái này là tiền sai chỗ phải xử lý, còn lại là dữ liệu cần dọn. */
export const THU_NGOAI_NANG = new Set(["THU_SAU_HUY", "THU_TRUOC_ROI_HUY"]);

export const THU_NGOAI_CACH_XU_LY: Record<string, string> = {
  THU_SAU_HUY: "Hợp đồng đã huỷ trước khi thu — thu nhầm, khách đòi lại được.",
  THU_TRUOC_ROI_HUY: "Thu gộp xong mới huỷ — tiền của tháng không còn dịch vụ, phải hoàn khách.",
  THU_TRUOC_LAP: "Thu cho tháng máy chưa về nhà khách.",
  CHUA_DAT_COC: "Hợp đồng chưa điền giá hoặc ngày bắt đầu thu nên không có khoảng nào để đối chiếu.",
};

/** Sổ cước ghi gì cho tháng nằm giữa ngày kết thúc thu và ngày huỷ. */
export const KY_HUT: Record<string, string> = {
  KHONG_CO_DONG: "không có dòng nào",
  GHI_CHU: "chỉ ghi chú",
  CHO_DUYET: "chờ duyệt",
  MIEN_PHI: "được miễn",
  DA_THU: "đã thu",
};

/** Tháng không thu được đồng nào — phần đáng đòi. */
export const KY_HUT_MAT_TIEN = new Set(["KHONG_CO_DONG", "GHI_CHU", "CHO_DUYET"]);

/**
 * Bốn nhóm cảnh báo vận hành, xếp theo việc nó đang làm gì với tiền — không
 * theo "nặng nhẹ" chung chung. Thứ tự này là thứ tự nên xử lý:
 *
 * - MAT_TIEN: tiền đáng ra phải vào mà đang không vào.
 * - TREO_TIEN: tiền đã vào tài khoản 3M rồi, chỉ chờ người bấm cho vào sổ.
 * - LECH_SO: sổ không khớp nhau. Chưa chắc mất tiền, nhưng mọi con số tính ra
 *   từ sổ đều đang sai một ít.
 * - CHAM_VIEC: việc đang chậm, chưa thành tiền.
 */
export const NHOM_CANH_BAO: Record<string, { ten: string; y: string }> = {
  MAT_TIEN: {
    ten: "Đang mất tiền",
    y: "tiền đáng ra phải vào mà hiện không vào",
  },
  TREO_TIEN: {
    ten: "Tiền treo chờ người",
    y: "khách đã trả, tiền đã vào tài khoản, chỉ chờ người bấm cho vào sổ",
  },
  LECH_SO: {
    ten: "Sổ lệch",
    y: "chưa chắc mất tiền, nhưng mọi con số tính từ sổ đều đang sai một ít",
  },
  CHAM_VIEC: {
    ten: "Việc chậm",
    y: "chưa thành tiền, nhưng để lâu thì thành mất khách",
  },
};

export const THU_TU_NHOM_CANH_BAO = [
  "MAT_TIEN",
  "TREO_TIEN",
  "LECH_SO",
  "CHAM_VIEC",
] as const;

/**
 * Mô tả từng loại cảnh báo vận hành: tên, nó tốn cái gì, và bấm vào thì đi đâu
 * để xử lý. `ma` khớp đúng cột `ma` của view v_fixed_canh_bao.
 *
 * `di` trỏ sang màn hình ĐÃ CÓ chứ không mở danh sách tại chỗ: mỗi loại cần
 * một bộ cột khác nhau, dựng lại hết ở đây thì thành bản sao kém hơn của
 * những màn kia.
 *
 * Link sang /hop-dong luôn kèm `pt=CONG_TY`: bảng này chỉ đếm phần công ty,
 * mở ra mà thấy số khác thì người xem không biết tin bên nào.
 */
export const CANH_BAO_VAN_HANH: Record<
  string,
  { ten: string; y: string; nhom: string; di: string }
> = {
  THIEU_GIA_CUOC: {
    ten: "Thiếu giá cước",
    y: "hợp đồng đang chạy mà không có giá tháng nên không sinh được kỳ nào — mất bao nhiêu thì không tính được, vì chính cái giá đang thiếu",
    nhom: "MAT_TIEN",
    di: "/hop-dong?cb=THIEU_GIA_CUOC&pt=CONG_TY",
  },
  THIEU_NGAY_THU: {
    ten: "Thiếu ngày bắt đầu thu",
    y: "hợp đồng đang chạy mà chưa có mốc bắt đầu thu nên không sinh được kỳ nào",
    nhom: "MAT_TIEN",
    di: "/hop-dong?cb=THIEU_NGAY_THU&pt=CONG_TY",
  },
  CHUA_HOAT_DONG: {
    ten: "Lắp xong mà chưa thu",
    y: "máy đã chạy ở nhà khách nhưng sổ chưa thu đồng nào; tiền là tổng cước tháng đang nằm im",
    nhom: "MAT_TIEN",
    di: "/hom-nay/co-dinh?chd=1",
  },
  KY_HUT: {
    ten: "Kỳ hụt",
    y: "khoảng thu có chứa tháng đó mà sổ không có dòng cước nào",
    nhom: "MAT_TIEN",
    di: "/ky-hut",
  },
  NO_NANG: {
    ten: "Nợ nặng",
    y: "khách nợ quá số kỳ cho phép, càng để càng khó đòi",
    nhom: "MAT_TIEN",
    di: "/hop-dong?cb=NO_NANG&pt=CONG_TY",
  },
  HUY_CON_NO: {
    ten: "Huỷ còn nợ",
    y: "hợp đồng đã đóng mà vẫn còn phải đòi, trừ cọc chờ duyệt rồi vẫn còn",
    nhom: "MAT_TIEN",
    di: "/hop-dong?cb=HUY_CON_NO&pt=CONG_TY",
  },
  KHO_DOI: {
    ten: "Khách khó đòi",
    y: "nguồn tự đánh dấu, coi như gần mất",
    nhom: "MAT_TIEN",
    di: "/hop-dong?cb=KHO_DOI&pt=CONG_TY",
  },
  GMO_QUA_HAN: {
    ten: "Mã combini hết hạn",
    y: "mã hết hạn không tự sống lại, muốn thu tiếp phải tạo mã mới; một hợp đồng có thể hỏng nhiều lần nên tiền tính một lần cho mỗi hợp đồng",
    nhom: "MAT_TIEN",
    di: "/hom-nay/co-dinh?gmo=1",
  },
  COC_CHO_DUYET: {
    ten: "Phiếu cọc chờ duyệt",
    y: "tiền đã vào tài khoản nhưng nợ của khách chưa được trừ, nên khách tưởng đã trả mà sổ vẫn ghi nợ",
    nhom: "TREO_TIEN",
    di: "/hom-nay/co-dinh?coc=all",
  },
  CHO_DUYET: {
    ten: "Kỳ cước chờ duyệt",
    y: "kỳ đã ghi nhận tiền nhưng chưa ai duyệt nên chưa tính vào doanh thu",
    nhom: "TREO_TIEN",
    di: "/hop-dong?cb=CHO_DUYET&pt=CONG_TY",
  },
  NGOAI_KY: {
    ten: "Kỳ ngoài khoảng thu",
    y: "có kỳ cước nằm ngoài khoảng bắt đầu → kết thúc thu của chính hợp đồng đó",
    nhom: "LECH_SO",
    di: "/hop-dong?cb=NGOAI_KY&pt=CONG_TY",
  },
  HUY_LECH_KY: {
    ten: "Huỷ lệch ngày kết thúc thu",
    y: "ngày sổ ngừng thu và ngày dịch vụ thật sự dừng cách nhau quá xa — một đầu là thu thiếu, đầu kia là thu thừa",
    nhom: "LECH_SO",
    di: "/hop-dong?cb=HUY_LECH_KY&pt=CONG_TY",
  },
  THU_THIEU: {
    ten: "Thu thiếu tiền",
    y: "kỳ đã đánh dấu thu xong mà số tiền ít hơn cước tháng, không phải kỳ tuỳ chỉnh",
    nhom: "LECH_SO",
    di: "/hop-dong?cb=THU_THIEU&pt=CONG_TY",
  },
  GHI_CHU: {
    ten: "Kỳ chỉ ghi chú",
    y: "kỳ tồn tại nhưng không ra tiền; đúng thì là miễn phí, sai thì là một kỳ bị bỏ quên",
    nhom: "LECH_SO",
    di: "/hop-dong?cb=GHI_CHU&pt=CONG_TY",
  },
  THU_NGOAI_HD: {
    ten: "Thu ngoài hợp đồng",
    y: "có tiền thu vào hợp đồng mà không khoảng thu nào của nó chứa ngày đó",
    nhom: "LECH_SO",
    di: "/thu-ngoai",
  },
  CHO_LAP_LAU: {
    ten: "Chờ lắp lâu",
    y: "đã ký nhưng vẫn đang khảo sát, chưa lắp — khách chờ lâu thì huỷ",
    nhom: "CHAM_VIEC",
    di: "/hop-dong?cb=CHO_LAP_LAU&pt=CONG_TY",
  },
  LAP_QUA_HAN: {
    ten: "Đơn lắp quá hạn hẹn",
    y: "đã qua ngày hẹn lắp mà đơn chưa xong",
    nhom: "CHAM_VIEC",
    di: "/hom-nay/co-dinh?qua-han=1",
  },
};

/**
 * Hàng đợi việc phải làm. Khác bảng cảnh báo ở chỗ mỗi dòng ĐÓNG ĐƯỢC: có mã
 * để tra, tên để nhận ra, tuổi để biết cái nào gấp, link để làm ngay.
 *
 * `cot_ma` / `cot_ai` / `cot_tien` đặt tên cột theo từng loại việc — cùng một
 * view nhưng dòng của wifi cố định là hợp đồng, dòng của cầm tay là máy hoặc
 * lần thu tiền, gọi chung một tên thì đọc không ra.
 *
 * `thu_tu` xếp theo thứ CỨU ĐƯỢC trước: gọi lại khách còn cửa sổ thời gian,
 * thu hồi máy thì muộn mấy ngày cũng vậy.
 */
export const VIEC_HOM_NAY: Record<
  string,
  {
    ten: string;
    lam_gi: string;
    /** Mảng kinh doanh; khai ở đây chứ không suy từ dữ liệu — hàng đợi sạch
     *  không còn dòng nào thì vẫn phải biết nó thuộc bên nào. */
    he: string;
    thu_tu: number;
    cot_ma: string;
    cot_ai: string;
    cot_tien: string | null;
  }
> = {
  GOI_LAI: {
    ten: "Gọi lại khách chưa chốt được lịch lắp",
    lam_gi:
      "Ký rồi mà vẫn đang khảo sát. Đây là chỗ rò to nhất của dây chuyền: 28 ngày gần nhất có 104 hợp đồng chết trước khi lắp, lý do số một là không liên lạc được, và trung bình 49 ngày sau khi ký mới chịu kết luận. Gọi sớm thì còn cứu.",
    he: "co_dinh",
    thu_tu: 1,
    cot_ma: "Hợp đồng",
    cot_ai: "Địa chỉ",
    cot_tien: null,
  },
  BAT_THU_CUOC: {
    ten: "Bật thu cước cho hợp đồng đã lắp",
    lam_gi:
      "Máy đã chạy ở nhà khách nhưng sổ chưa có ngày bắt đầu thu nên không sinh kỳ nào. Mỗi ngày để yên là một ngày dùng không mất tiền.",
    he: "co_dinh",
    thu_tu: 2,
    cot_ma: "Hợp đồng",
    cot_ai: "Địa chỉ",
    cot_tien: "Cước tháng",
  },
  DIEN_GIA_CUOC: {
    ten: "Điền giá cước còn thiếu",
    lam_gi:
      "Hợp đồng đang chạy mà không có giá tháng nên hệ thống không sinh được kỳ nào. Bật thu cước cũng vô ích nếu chưa có giá, nên làm cái này trước.",
    he: "co_dinh",
    thu_tu: 3,
    cot_ma: "Hợp đồng",
    cot_ai: "Địa chỉ",
    cot_tien: null,
  },
  DUYET_COC: {
    ten: "Duyệt phiếu cọc khách đã trả",
    lam_gi:
      "Tiền đã vào tài khoản 3M nhưng nợ của khách chưa được trừ — khách tưởng đã trả, sổ vẫn ghi nợ. Chỉ cần bấm duyệt.",
    he: "co_dinh",
    thu_tu: 4,
    cot_ma: "Hợp đồng",
    cot_ai: "Địa chỉ",
    cot_tien: "Tiền",
  },
  GAN_HOA_DON: {
    ten: "Gán tiền đã về vào hoá đơn",
    lam_gi:
      "Khách trả rồi, tiền nằm trong tài khoản, nhưng chưa ai nói nó trả cho hoá đơn nào. Chừng nào chưa gán thì khách vẫn bị tính là đang nợ.",
    he: "cam_tay",
    thu_tu: 5,
    cot_ma: "Mã khách",
    cot_ai: "Khách",
    cot_tien: "Tiền",
  },
  THU_HOI_MAY: {
    ten: "Thu hồi máy của thuê bao đã ngừng",
    lam_gi:
      "Thuê bao đóng rồi mà máy vẫn ở ngoài. Máy đã đánh dấu không thu hồi thì không nằm ở đây — đó là quyết định đã ra, không phải việc đang chờ.",
    he: "cam_tay",
    thu_tu: 6,
    cot_ma: "IMEI",
    cot_ai: "Khách",
    cot_tien: "Cọc",
  },
};

export const TEN_HE: Record<string, string> = {
  co_dinh: "Wifi cố định",
  cam_tay: "Wifi cầm tay",
};

/**
 * Các trạm trên dây chuyền vận hành — xem db/217.
 *
 * `thu_tu` theo đúng thứ tự việc chảy qua, không theo mức nghẽn: người đọc cần
 * thấy hình dạng dây chuyền trước, rồi mới thấy chỗ nào tắc.
 *
 * `viec` nối sang hàng đợi tương ứng bên màn Việc hôm nay; rỗng nghĩa là trạm
 * đó chưa có hàng đợi để bấm vào làm.
 */
export const TRAM_VAN_HANH: Record<
  string,
  {
    ten: string;
    y: string;
    he: string;
    thu_tu: number;
    viec: string | null;
    /** Nhãn bốn cột của ngăn kéo. Cùng một view nhưng dòng của cố định là hợp
     *  đồng, của cầm tay là máy hoặc lần thu tiền — gọi chung một tên thì đọc
     *  không ra. `cot_tien` rỗng nghĩa là trạm này không kèm tiền. */
    cot_ma: string;
    cot_ai: string;
    cot_tuoi: string;
    cot_tien: string | null;
  }
> = {
  KHAO_SAT: {
    ten: "Khảo sát, chưa có lịch",
    y: "đã ký nhưng chưa chốt được ngày lắp",
    he: "co_dinh",
    thu_tu: 1,
    viec: "GOI_LAI",
    cot_ma: "Hợp đồng",
    cot_ai: "Địa chỉ",
    cot_tuoi: "Đã ký",
    cot_tien: null,
  },
  CHO_HEN: {
    ten: "Có lịch, chờ tới ngày",
    y: "đã hẹn ngày lắp, chưa tới lượt — không phải việc tồn",
    he: "co_dinh",
    thu_tu: 2,
    viec: null,
    cot_ma: "Hợp đồng",
    cot_ai: "Địa chỉ",
    cot_tuoi: "Còn",
    cot_tien: null,
  },
  QUA_HEN: {
    ten: "Quá ngày hẹn, chưa lắp",
    y: "đã qua ngày hẹn mà đơn chưa xong",
    he: "co_dinh",
    thu_tu: 3,
    viec: null,
    cot_ma: "Hợp đồng",
    cot_ai: "Địa chỉ",
    cot_tuoi: "Trễ",
    cot_tien: null,
  },
  CHUA_BAT_THU: {
    ten: "Lắp xong, chưa bật thu",
    y: "máy chạy ở nhà khách mà sổ chưa thu đồng nào",
    he: "co_dinh",
    thu_tu: 4,
    viec: "BAT_THU_CUOC",
    cot_ma: "Hợp đồng",
    cot_ai: "Địa chỉ",
    cot_tuoi: "Sau lắp",
    cot_tien: "Cước tháng",
  },
  THIEU_GIA: {
    ten: "Thiếu giá cước",
    y: "không có giá tháng nên không sinh được kỳ nào",
    he: "co_dinh",
    thu_tu: 5,
    viec: "DIEN_GIA_CUOC",
    cot_ma: "Hợp đồng",
    cot_ai: "Địa chỉ",
    cot_tuoi: "Đã ký",
    cot_tien: null,
  },
  CHO_DUYET_COC: {
    ten: "Phiếu cọc chờ duyệt",
    y: "tiền đã vào tài khoản, nợ của khách chưa được trừ",
    he: "co_dinh",
    thu_tu: 6,
    viec: "DUYET_COC",
    cot_ma: "Hợp đồng",
    cot_ai: "Địa chỉ",
    cot_tuoi: "Chờ",
    cot_tien: "Tiền",
  },
  DANG_NO: {
    ten: "Đang nợ cước",
    y: "hợp đồng còn chạy mà có kỳ chưa thu",
    he: "co_dinh",
    thu_tu: 7,
    viec: null,
    cot_ma: "Hợp đồng",
    cot_ai: "Địa chỉ",
    cot_tuoi: "—",
    cot_tien: "Còn nợ",
  },
  CHO_GAN_HD: {
    ten: "Tiền về, chưa gán hoá đơn",
    y: "khách trả rồi nhưng chưa ai nói nó trả cho hoá đơn nào",
    he: "cam_tay",
    thu_tu: 1,
    viec: "GAN_HOA_DON",
    cot_ma: "Mã khách",
    cot_ai: "Khách",
    cot_tuoi: "Treo",
    cot_tien: "Tiền",
  },
  NO_CAM_TAY: {
    ten: "Thuê bao nợ quá hạn",
    y: "dịch vụ còn chạy mà cước chưa thu",
    he: "cam_tay",
    thu_tu: 2,
    viec: null,
    cot_ma: "Mã khách",
    cot_ai: "Khách",
    cot_tuoi: "Quá hạn",
    cot_tien: "Nợ",
  },
  CHO_THU_MAY: {
    ten: "Máy chưa thu hồi",
    y: "thuê bao đóng rồi mà máy vẫn ở ngoài",
    he: "cam_tay",
    thu_tu: 3,
    viec: "THU_HOI_MAY",
    cot_ma: "IMEI",
    cot_ai: "Khách",
    cot_tuoi: "Ngừng đã",
    cot_tien: "Cọc",
  },
};

/**
 * Hai kiểu nghẽn, đọc bằng hai cột khác nhau — chỉ nhìn một cột là bỏ sót một
 * kiểu. Ngưỡng đặt ở đây để màn hình và lời giải thích không trôi khác nhau.
 */
export const NGHEN_TUAN = 8;
export const NGHEN_NGAY = 90;
/** Dưới mức này thì mấy cái nằm lâu là ngoại lệ, không phải trạm bỏ quên. */
export const NGHEN_TY_LE = 0.1;
export const NGHEN_TOI_THIEU = 5;
