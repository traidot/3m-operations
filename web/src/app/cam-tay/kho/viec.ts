import type { KhoMa } from "@/lib/queries";

/**
 * Việc cần xử lý, định nghĩa một chỗ để màn hình tổng quan và màn hình danh
 * sách không trôi khỏi nhau.
 *
 * Tách làm hai nhóm vì hai nhóm có sức nặng khác hẳn nhau. Nhóm `pm` là phần
 * mềm TỰ mâu thuẫn — đọc bằng chứng từ của chính nó, không cần tới file, nên
 * sai là sai thật. Nhóm `so` chỉ nói hai bên ghi khác nhau; file là bản tổng
 * hợp làm tay ở ngoài, chưa ai chứng minh nó đúng, nên lệch ở đây chưa kết luận
 * được bên nào sai.
 */
export type Viec = {
  ma: string;
  ten: string;
  vi_sao: string;
  nhom: "pm" | "so";
  nang: boolean;
  hop: (r: KhoMa) => boolean;
};

export const VIEC: Viec[] = [
  {
    ma: "kho_van_thu",
    ten: "Máy đã về kho mà thuê bao vẫn ra cước",
    vi_sao: "phiếu nhập kho và kỳ cước cùng nằm trong phần mềm, hai chứng từ chỏi nhau",
    nhom: "pm",
    nang: true,
    hop: (r) => r.cho_dung === "TRONG_KHO" && r.tinh_trang_cuoc === "DANG_RA_CUOC",
  },
  {
    ma: "hut_cuoc",
    ten: "Máy ở khách mà ngừng ra cước",
    vi_sao: "thuê bao còn hiệu lực, máy còn ngoài, tháng này không có kỳ nào",
    nhom: "pm",
    nang: true,
    hop: (r) => r.cho_dung === "O_KHACH" && r.tinh_trang_cuoc === "HUT_CUOC",
  },
  {
    ma: "huy_chua_thu",
    ten: "Thuê bao đã huỷ mà máy chưa về",
    vi_sao: "dịch vụ dừng rồi nhưng không có phiếu nhập nào, cọc còn treo",
    nhom: "pm",
    nang: false,
    hop: (r) => r.cho_dung === "O_KHACH" && r.tinh_trang_cuoc === "HUY_CHUA_THU_MAY",
  },
  {
    ma: "khach_khong_dich_vu",
    ten: "Máy ở khách mà không có dịch vụ nào",
    vi_sao:
      "có phiếu xuất nhưng không gắn thuê bao nào, nên không có kỳ cước và không ai đòi tiền",
    nhom: "pm",
    nang: true,
    hop: (r) => r.cho_dung === "O_KHACH" && !r.co_thue_bao,
  },
  {
    ma: "chi_nha_mang",
    ten: "Chỉ thấy ở nhà mạng, không có phiếu kho nào",
    vi_sao: "nhà mạng biết mã này, kho của phần mềm thì chưa từng",
    nhom: "pm",
    nang: false,
    hop: (r) => r.cho_dung === "CHI_NHA_MANG",
  },
  {
    ma: "thu_hoi_van_o_khach",
    ten: "File xếp thu hồi ↔ phần mềm nói còn ở khách",
    vi_sao: "file xếp mã này vào mục thu hồi, nhưng phần mềm không có phiếu nhập về",
    nhom: "so",
    nang: false,
    hop: (r) => r.file_vi_tri_so === "DS thu hồi" && r.cho_dung === "O_KHACH",
  },
  {
    ma: "dung_ma_trong_kho",
    ten: "File nói đang dùng ↔ phần mềm nói đã về kho",
    vi_sao: "file ghi khách đang giữ, nhưng phần mềm có phiếu nhập kho",
    nhom: "so",
    nang: true,
    hop: (r) =>
      r.file_vi_tri_so !== null &&
      r.file_vi_tri_so !== "DS thu hồi" &&
      r.cho_dung === "TRONG_KHO",
  },
  {
    ma: "file_co_pm_khong",
    ten: "File có mã ↔ phần mềm không có",
    vi_sao: "không xuất hiện ở bất kỳ bảng nào bên nguồn",
    nhom: "so",
    nang: false,
    hop: (r) => r.file_co && !r.pm_co,
  },
  {
    ma: "pm_co_file_khong",
    ten: "Phần mềm có mã ↔ file không nhắc tới",
    vi_sao: "phần mềm có chứng từ, bản đối chiếu bỏ sót",
    nhom: "so",
    nang: false,
    hop: (r) => r.pm_co && !r.file_co,
  },
];
