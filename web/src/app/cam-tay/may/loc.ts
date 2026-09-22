import type { TelecomMay } from "@/lib/queries";

export const KHONG_NHOM = "(không ghi nhóm)";

/**
 * Bốn nhóm bộ lọc, xếp theo việc người dùng định làm chứ không theo cột của
 * nguồn. Nhóm đầu là một phép chia hết — sáu tình trạng loại trừ nhau, cộng
 * lại đúng tổng số máy — nên đọc ra được "máy nào đang ở đâu". Ba nhóm sau
 * chồng lên nhau và chồng lên nhóm đầu, đó là chủ ý: chúng là các lát cắt để
 * đi làm việc, không phải để cộng.
 */
export const NHOM_LOC = {
  tinh_trang: "Sáu tình trạng, loại trừ nhau, cộng lại đúng tổng",
  sua_data: "Dữ liệu tự mâu thuẫn — sửa ở CMS",
  cho_muon: "Máy cho mượn chờ lắp wifi cố định",
  lat_cat: "Lát cắt khác",
} as const;

type Nhom = keyof typeof NHOM_LOC;

export const LOC: Record<
  string,
  { ten: string; nhom: Nhom; hop: (r: TelecomMay) => boolean }
> = {
  // ── Sáu tình trạng: một máy rơi vào đúng một ô.
  dang_ra_cuoc: {
    ten: "đang ra cước",
    nhom: "tinh_trang",
    hop: (r) => r.tinh_trang_cuoc === "DANG_RA_CUOC",
  },
  huy_chua_thu_may: {
    ten: "huỷ rồi, chưa thu máy",
    nhom: "tinh_trang",
    hop: (r) => r.tinh_trang_cuoc === "HUY_CHUA_THU_MAY",
  },
  chua_gan: {
    ten: "chưa gắn thuê bao",
    nhom: "tinh_trang",
    hop: (r) => r.tinh_trang_cuoc === "CHUA_GAN",
  },
  hut_cuoc: {
    ten: "hụt cước",
    nhom: "tinh_trang",
    hop: (r) => r.tinh_trang_cuoc === "HUT_CUOC",
  },
  tb_da_xoa: {
    ten: "thuê bao đã xoá",
    nhom: "tinh_trang",
    hop: (r) => r.tinh_trang_cuoc === "TB_DA_XOA",
  },
  da_tra: {
    ten: "đã trả máy",
    nhom: "tinh_trang",
    hop: (r) => r.tinh_trang_cuoc === "DA_TRA",
  },

  // ── Chỗ dữ liệu tự mâu thuẫn, sửa ở CMS chứ không phải đi đòi khách. Không
  // lặp lại nút nào của nhóm trên: "hụt cước" và "thuê bao đã xoá" cũng là lỗi
  // dữ liệu nhưng đã có chỗ đứng riêng ở nhóm sáu tình trạng.
  chua_gan_la: {
    ten: "máy ở ngoài, không thuê bao, không phải cho mượn",
    nhom: "sua_data",
    hop: (r) => r.tinh_trang_cuoc === "CHUA_GAN" && !r.cho_muon,
  },
  gan_ma_khong_ky: {
    ten: "có gắn thuê bao mà chưa ra kỳ cước nào",
    nhom: "sua_data",
    hop: (r) =>
      Number(r.so_lan_gan) > 0 && Number(r.so_ky) === 0 && r.tinh_trang_cuoc !== "DA_TRA",
  },
  tra_ma_tb_con_chay: {
    ten: "máy đã trả về kho mà thuê bao vẫn ACTIVE",
    nhom: "sua_data",
    hop: (r) => r.trang_thai === "RETURNED" && r.trang_thai_thue_bao === "ACTIVE",
  },
  khong_biet_khach: {
    ten: "máy đang ở ngoài mà không biết khách là ai",
    nhom: "sua_data",
    hop: (r) => r.trang_thai !== "RETURNED" && r.khach === "khách chưa có tên",
  },

  // ── Đơn bật cờ "cho mượn cục wifi khi khách chờ lắp wifi cố định".
  cho_muon: {
    ten: "tất cả đơn cho mượn",
    nhom: "cho_muon",
    hop: (r) => r.cho_muon,
  },
  cho_muon_dang_muon: {
    ten: "đang mượn, chưa mở dịch vụ",
    nhom: "cho_muon",
    hop: (r) => r.cho_muon && r.tinh_trang_cuoc === "CHUA_GAN",
  },
  cho_muon_can_doi: {
    ten: "dịch vụ dừng, máy chưa về",
    nhom: "cho_muon",
    hop: (r) => r.cho_muon && r.tinh_trang_cuoc === "HUY_CHUA_THU_MAY",
  },
  muon_that_chua_tra: {
    ten: "mượn thật — chưa ra kỳ cước nào, dịch vụ đã dừng",
    nhom: "cho_muon",
    hop: (r) =>
      r.cho_muon && r.tinh_trang_cuoc === "HUY_CHUA_THU_MAY" && Number(r.so_ky) === 0,
  },

  // ── Lát cắt chồng lên các nhóm trên.
  //
  // "có cảnh báo" KHÔNG gộp nợ cước: 799 trên 817 máy còn nợ là máy đang chạy
  // bình thường chưa thu xong cước tháng này, gộp vào thì nút ra 1.833 máy tức
  // 75% cả bảng, bấm vào không lọc được gì nữa.
  co_canh_bao: {
    ten: "có cảnh báo",
    nhom: "lat_cat",
    hop: (r) =>
      ["HUT_CUOC", "TB_DA_XOA", "HUY_CHUA_THU_MAY"].includes(r.tinh_trang_cuoc) ||
      (r.tinh_trang_cuoc === "CHUA_GAN" && !r.cho_muon),
  },
  con_no: {
    ten: "còn nợ cước",
    nhom: "lat_cat",
    hop: (r) => Number(r.chua_thu) > 0,
  },
  chua_tra: {
    ten: "máy chưa trả về kho",
    nhom: "lat_cat",
    hop: (r) => r.trang_thai === "NOT_RETURNED",
  },
  mat_trang: {
    ten: "có hoá đơn mất trắng",
    nhom: "lat_cat",
    hop: (r) => Number(r.mat_trang) > 0,
  },
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
