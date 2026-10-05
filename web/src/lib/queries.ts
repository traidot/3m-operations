import { query } from "./db";

export type Finding = {
  id: string;
  rule_key: string;
  severity: "CRITICAL" | "WARN" | "INFO";
  title: string;
  evidence: Record<string, unknown>;
  action: string | null;
  metabase_url: string | null;
  times_reported: number;
  reopened_count: number;
  so_ngay_ton: number;
  nhom: "moi" | "dang_ton" | "nhac_lai_nhieu_lan";
};

export type Freshness = {
  source: string;
  table_name: string;
  lan_dong_bo_cuoi: Date | null;
  gio_ke_tu_lan_cuoi: string | null;
  nguong_gio: string;
};

export type MergeCandidate = {
  party_a: string;
  party_b: string;
  ten_a: string;
  ten_b: string;
  dien_thoai_a: string | null;
  dien_thoai_b: string | null;
  do_giong: string;
};

export const getFindings = () =>
  query<Finding>(
    `select id, rule_key, severity, title, evidence, action, metabase_url,
            times_reported, reopened_count, so_ngay_ton, nhom
       from finding_digest`,
  );

/** Việc đã đánh bỏ qua vĩnh viễn — để gỡ lại khi bấm nhầm. */
export const getIgnored = () =>
  query<{ id: string; title: string; rule_key: string; note: string | null }>(
    `select id, title, rule_key, note from finding
      where status = 'IGNORED' order by updated_at desc limit 50`,
  );

export const getFreshness = () =>
  query<Freshness>("select * from v_sync_freshness order by source, table_name");

export const getMergeCandidates = () =>
  query<MergeCandidate>(
    `select party_a::text, party_b::text, ten_a, ten_b,
            dien_thoai_a, dien_thoai_b, do_giong::text
       from v_merge_candidate order by do_giong desc limit 100`,
  );

export type MonthlyBilling = {
  ky: string;
  so_hop_dong: string;
  phai_thu: string;
  tien_mien_phi: string | null;
  da_thu: string;
  con_thieu: string | null;
  ty_le_thu: string | null;
  thu_thieu: string | null;
  cho_duyet: string | null;
  ghi_chu: string | null;
  giam_tru: string | null;
};

export type MonthlyByStatus = MonthlyBilling & { trang_thai: string };

export type Coverage = {
  hop_dong_dang_chay: string;
  thieu_gia_cuoc: string;
  thieu_ngay_bat_dau: string;
  tinh_duoc: string;
  ty_le_tinh_duoc: string | null;
  hop_dong_dai_ly: string;
};

export type Arrears = {
  subscription_id: string;
  lien_ket: string | null;
  contract_code: string;
  trang_thai_hop_dong: string;
  trang_thai_lap_dat: string | null;
  ky_da_thu_gan_nhat: string | null;
  ky_cho_duyet: number;
  ky_ghi_chu: number;
  so_ky: number;
  so_ky_mien_phi: number;
  so_ky_no: number;
  tong_da_thu: string;
  con_no: string;
};

const MONTHLY_COLS = `ky, so_hop_dong::text, phai_thu::text, tien_mien_phi::text,
                      da_thu::text, con_thieu::text, ty_le_thu::text, thu_thieu::text,
                      cho_duyet::text, ghi_chu::text, giam_tru::text`;

export const getMonthlyTotal = () =>
  query<MonthlyBilling>(
    `select ${MONTHLY_COLS} from v_fixed_monthly_total order by ky desc limit 18`,
  );

export const getMonthlyByStatus = () =>
  query<MonthlyByStatus>(
    `select ${MONTHLY_COLS}, trang_thai from v_fixed_monthly_billing
      order by ky desc, trang_thai`,
  );

export const getCoverage = () =>
  query<Coverage>(
    `select hop_dong_dang_chay::text, thieu_gia_cuoc::text, thieu_ngay_bat_dau::text,
            tinh_duoc::text, ty_le_tinh_duoc::text, hop_dong_dai_ly::text
       from v_fixed_billing_coverage`,
  );

export const getArrears = () =>
  query<Arrears>(
    `select subscription_id, contract_url(subscription_id) as lien_ket,
            contract_code, trang_thai_hop_dong, trang_thai_lap_dat,
            ky_da_thu_gan_nhat, ky_cho_duyet, ky_ghi_chu,
            so_ky, so_ky_mien_phi, so_ky_no,
            tong_da_thu::text, con_no::text
       from v_fixed_arrears order by so_ky_no desc, con_no desc limit 20`,
  );

/** Kỳ mới chỉ ghi chú hoặc chưa duyệt — chưa quyết là thu hay miễn. */
export const getPendingPeriods = () =>
  query<{ status: string; so_ky: string; tien: string }>(
    `select status, so_ky::text, tien::text from v_fixed_fee_pending order by so_ky desc`,
  );

export type FunnelMonth = {
  thang: string;
  chi_phi_ads: string | null;
  mess: string | null;
  don_khai: string | null;
  chi_phi_co_dinh: string | null;
  mess_co_dinh: string | null;
  don_khai_co_dinh: string | null;
  hop_dong_moi: string | null;
  cuoc_phai_thu: string | null;
  cuoc_mien_phi: string | null;
  cuoc_da_thu: string | null;
  ty_le_mess_ra_don_co_dinh: string | null;
  ty_le_don_thanh_hop_dong: string | null;
  gia_mess: string | null;
  chi_phi_moi_hop_dong: string | null;
};

export const getFunnel = () =>
  query<FunnelMonth>(
    `select thang,
            chi_phi_ads::text, mess::text, don_khai::text,
            chi_phi_co_dinh::text, mess_co_dinh::text, don_khai_co_dinh::text,
            hop_dong_moi::text, cuoc_phai_thu::text, cuoc_mien_phi::text,
            cuoc_da_thu::text, ty_le_mess_ra_don_co_dinh::text,
            ty_le_don_thanh_hop_dong::text, gia_mess::text,
            chi_phi_moi_hop_dong::text
       from v_funnel_monthly
      where thang >= to_char(current_date - interval '12 months', 'YYYY-MM')
      order by thang`,
  );

export type WifiFunnel = {
  thang: string;
  chi_phi: string | null;
  tiep_can: string | null;
  click: string | null;
  mess: string | null;
  don_khai: string | null;
  don_huy: string | null;
  chi_phi_co_dinh: string | null;
  mess_co_dinh: string | null;
  don_co_dinh: string | null;
  lich_lap: string | null;
  lap_xong: string | null;
  hop_dong_moi: string | null;
  cuoc_phai_thu: string | null;
  cuoc_mien_phi: string | null;
  cuoc_da_thu: string | null;
  ty_le_don_thanh_hop_dong: string | null;
  chi_phi_moi_hop_dong: string | null;
};

export type EsimFunnel = {
  thang: string;
  chi_phi: string | null;
  tiep_can: string | null;
  click: string | null;
  mess: string | null;
  don: string | null;
  don_huy: string | null;
  gia_mess: string | null;
  chi_phi_moi_don: string | null;
};

const TU = "to_char(current_date - interval '12 months', 'YYYY-MM')";

export const getWifiFunnel = () =>
  query<WifiFunnel>(
    `select thang, chi_phi::text, tiep_can::text, click::text, mess::text,
            don_khai::text, don_huy::text, chi_phi_co_dinh::text,
            mess_co_dinh::text, don_co_dinh::text, lich_lap::text, lap_xong::text,
            hop_dong_moi::text, cuoc_phai_thu::text, cuoc_mien_phi::text,
            cuoc_da_thu::text, ty_le_don_thanh_hop_dong::text,
            chi_phi_moi_hop_dong::text
       from v_funnel_wifi where thang >= ${TU} order by thang`,
  );

export type WifiPersonFunnel = {
  thang: string;
  chi_phi: string | null;
  tiep_can: string | null;
  click: string | null;
  mess: string | null;
  don_khai: string | null;
  don_huy: string | null;
  chi_phi_co_dinh: string | null;
  mess_co_dinh: string | null;
  don_co_dinh: string | null;
  chi_phi_cam_tay: string | null;
  mess_cam_tay: string | null;
  don_cam_tay: string | null;
  chi_phi_wimax: string | null;
  mess_wimax: string | null;
  don_wimax: string | null;
  lich_lap: string | null;
  lap_xong: string | null;
  gia_mess: string | null;
  chi_phi_moi_don: string | null;
};

const COT_NGUOI = `thang, chi_phi::text, tiep_can::text, click::text, mess::text,
       don_khai::text, don_huy::text,
       chi_phi_co_dinh::text, mess_co_dinh::text, don_co_dinh::text,
       chi_phi_cam_tay::text, mess_cam_tay::text, don_cam_tay::text,
       chi_phi_wimax::text, mess_wimax::text, don_wimax::text,
       lich_lap::text, lap_xong::text, gia_mess::text, chi_phi_moi_don::text`;

/** Phễu quảng cáo của riêng một người. Dừng ở lắp đặt — xem v_funnel_wifi_nguoi. */
export const getWifiFunnelByPerson = (nguoiKey: string) =>
  query<WifiPersonFunnel>(
    `select ${COT_NGUOI} from v_funnel_wifi_nguoi
      where nguoi_key = $1 and thang >= ${TU} order by thang`,
    [nguoiKey],
  );

export type WifiPersonTotal = {
  nguoi_key: string;
  nguoi: string;
  chi_phi: string | null;
  mess: string | null;
  don_khai: string | null;
  don_co_dinh: string | null;
  lap_xong: string | null;
  gia_mess: string | null;
};

/** Cộng dồn 12 tháng gần nhất để hai người đứng cạnh nhau trên trang chung. */
export const getWifiPersonTotals = () =>
  query<WifiPersonTotal>(
    `select nguoi_key, max(nguoi) as nguoi,
            sum(chi_phi)::text     as chi_phi,
            sum(mess)::text        as mess,
            sum(don_khai)::text    as don_khai,
            sum(don_co_dinh)::text as don_co_dinh,
            sum(lap_xong)::text    as lap_xong,
            round(sum(chi_phi) / nullif(sum(mess), 0))::text as gia_mess
       from v_funnel_wifi_nguoi where thang >= ${TU}
      group by nguoi_key order by nguoi_key`,
  );


export const getEsimFunnel = () =>
  query<EsimFunnel>(
    `select thang, chi_phi::text, tiep_can::text, click::text, mess::text,
            don::text, don_huy::text, gia_mess::text, chi_phi_moi_don::text
       from v_funnel_esim where thang >= ${TU} order by thang`,
  );

export type Contract = {
  subscription_id: string;
  contract_code: string | null;
  dia_chi: string | null;
  trang_thai_hop_dong: string;
  trang_thai_lap_dat: string | null;
  goi_cuoc: string | null;
  cuoc_thang: string | null;
  fee_start_on: string | null;
  fee_end_on: string | null;
  nguoi_nhap: string | null;
  ngay_ky: string | null;
  ngay_lap_xong: string | null;
  ngay_huy: string | null;
  ly_do_huy: string | null;
  nhom_ly_do_huy: string | null;
  kho_doi: boolean;
  so_ky: string;
  so_ky_mien_phi: string;
  so_ky_no: string;
  tong_da_thu: string;
  con_no: string;
  ky_da_thu_gan_nhat: string | null;
  ky_cho_duyet: string;
  ky_ghi_chu: string;
  ky_ngoai: string;
  tinh_trang_cuoc: string;
  canh_bao: string[];
  so_ky_chua_den_han: string;
  tien_chua_den_han: string;
  coc_cho_duyet: string;
  so_phieu_coc_cho: string;
  con_no_sau_coc: string;
  do_cong_ty: boolean;
  so_ky_treo_duyet: string;
  tien_treo_duyet: string;
  /** DA_HUY / CHUA_LAP / CHUA_HOAT_DONG / DANG_THU — xem db/194. */
  trang_thai_van_hanh: string;
  /** Người vận hành gõ tay bên CMS; null nghĩa là không ai ghi gì. */
  ly_do_chua_lap_xong: string | null;
};

export type ContractFilter = {
  q?: string;
  hopDong?: string;
  lapDat?: string;
  vanHanh?: string;
  cuoc?: string;
  canhBao?: string;
  ky?: string;
  kyTrangThai?: string;
  thangKy?: string;
  thangHuy?: string;
  lyDoHuy?: string;
  phuTrach?: string;
  trang?: number;
};

const COT_HOP_DONG = `subscription_id, contract_code, dia_chi, trang_thai_hop_dong,
       trang_thai_lap_dat, goi_cuoc, cuoc_thang::text,
       fee_start_on::text, fee_end_on::text, nguoi_nhap, ngay_ky::text, ngay_lap_xong::text,
       ngay_huy::text, ly_do_huy, nhom_ly_do_huy, kho_doi,
       so_ky::text, so_ky_mien_phi::text, so_ky_no::text,
       tong_da_thu::text, con_no::text, ky_da_thu_gan_nhat,
       ky_cho_duyet::text, ky_ghi_chu::text, ky_ngoai::text,
       tinh_trang_cuoc, canh_bao,
       so_ky_chua_den_han::text, tien_chua_den_han::text,
       coc_cho_duyet::text, so_phieu_coc_cho::text, con_no_sau_coc::text,
       do_cong_ty, so_ky_treo_duyet::text, tien_treo_duyet::text,
       trang_thai_van_hanh, ly_do_chua_lap_xong`;

export const CONTRACTS_PER_PAGE = 50;

/** Dựng mệnh đề where dùng chung cho cả trang danh sách và phần đếm tổng. */
function contractWhere(f: ContractFilter): { sql: string; params: unknown[] } {
  const dieu: string[] = [];
  const params: unknown[] = [];

  if (f.q?.trim()) {
    params.push(`%${f.q.trim()}%`);
    dieu.push(`(contract_code ilike $${params.length} or dia_chi ilike $${params.length})`);
  }
  if (f.hopDong) {
    params.push(f.hopDong);
    dieu.push(`trang_thai_hop_dong = $${params.length}`);
  }
  if (f.lapDat) {
    params.push(f.lapDat);
    dieu.push(`trang_thai_lap_dat = $${params.length}`);
  }
  if (f.cuoc) {
    params.push(f.cuoc);
    dieu.push(`tinh_trang_cuoc = $${params.length}`);
  }
  // Công ty phụ trách hay đại lý tự thu — suy từ người tạo, xem fixed_company_staff.
  if (f.phuTrach === "CONG_TY" || f.phuTrach === "DAI_LY") {
    dieu.push(f.phuTrach === "CONG_TY" ? "do_cong_ty" : "not do_cong_ty");
  }
  // "CO" là có bất kỳ cảnh báo nào, còn lại là lọc đúng một loại.
  if (f.canhBao === "CO") {
    dieu.push("canh_bao <> '{}'");
  } else if (f.canhBao) {
    params.push(f.canhBao);
    dieu.push(`$${params.length} = any(canh_bao)`);
  }

  // Lọc theo một kỳ cước cụ thể, dùng khi bấm từ bảng thống kê tháng sang.
  if (f.ky) {
    params.push(f.ky);
    const ky = `$${params.length}`;
    let them = "";
    if (f.kyTrangThai) {
      params.push(f.kyTrangThai);
      them = ` and p.trang_thai = $${params.length}`;
    }
    // Bỏ kỳ ngoài khoảng cho khớp với bảng thống kê tháng, vốn cũng bỏ chúng.
    dieu.push(
      `exists (select 1 from v_fixed_contract_period p
                where p.subscription_id = v_fixed_contract.subscription_id
                  and p.ky = ${ky} and not p.ngoai_ky_tinh${them})`,
    );
  }
  if (f.vanHanh) {
    params.push(f.vanHanh);
    dieu.push(`trang_thai_van_hanh = $${params.length}`);
  }
  if (f.thangKy) {
    params.push(f.thangKy);
    dieu.push(`to_char(ngay_ky, 'YYYY-MM') = $${params.length}`);
  }
  if (f.lyDoHuy) {
    params.push(f.lyDoHuy);
    // Chỉ hợp đồng đã huỷ mới có lý do; không chặn thì "không ghi lý do" gom
    // luôn cả mấy nghìn hợp đồng còn đang chạy.
    dieu.push(
      `trang_thai_hop_dong = 'TERMINATED'
       and coalesce(nhom_ly_do_huy, 'KHONG_GHI') = $${params.length}`,
    );
  }
  if (f.thangHuy) {
    params.push(f.thangHuy);
    dieu.push(`to_char(ngay_huy, 'YYYY-MM') = $${params.length}`);
  }

  return { sql: dieu.length > 0 ? `where ${dieu.join(" and ")}` : "", params };
}

export const getContracts = (f: ContractFilter) => {
  const { sql, params } = contractWhere(f);
  const offset = Math.max(0, ((f.trang ?? 1) - 1) * CONTRACTS_PER_PAGE);
  return query<Contract>(
    `select ${COT_HOP_DONG}
       from v_fixed_contract ${sql}
      order by so_ky_no desc, contract_code
      limit ${CONTRACTS_PER_PAGE} offset ${offset}`,
    params,
  );
};

/** Toàn bộ hợp đồng khớp bộ lọc, không phân trang — dùng cho tệp Excel. */
export const getContractsForExport = (f: ContractFilter) => {
  const { sql, params } = contractWhere(f);
  return query<Contract>(
    `select ${COT_HOP_DONG} from v_fixed_contract ${sql} order by contract_code`,
    params,
  );
};

export const countContracts = async (f: ContractFilter) => {
  const { sql, params } = contractWhere(f);
  const [row] = await query<{ n: string }>(
    `select count(*)::text as n from v_fixed_contract ${sql}`,
    params,
  );
  return Number(row?.n ?? 0);
};

export const getContract = async (id: string) => {
  const [row] = await query<Contract>(
    `select ${COT_HOP_DONG}
       from v_fixed_contract where subscription_id = $1`,
    [id],
  );
  return row ?? null;
};

export type ContractPeriod = {
  ky: string;
  phai_thu: string | null;
  trang_thai: string;
  ngoai_ky_tinh: boolean;
  tien: string | null;
  thu_luc: string | null;
  kenh: string | null;
  nguoi_nhap: string | null;
  qua_han: boolean;
  coc_cho_duyet: string;
  tuy_chinh: boolean;
  khong_thu: boolean;
};

export const getContractPeriods = (id: string) =>
  query<ContractPeriod>(
    `select ky, phai_thu::text, trang_thai, ngoai_ky_tinh, tien::text,
            thu_luc::text, kenh, nguoi_nhap, qua_han, coc_cho_duyet::text,
            tuy_chinh, khong_thu
       from v_fixed_contract_period where subscription_id = $1 order by ky desc`,
    [id],
  );

/** Đường dẫn sang màn hình hợp đồng bên CMS wifi cố định. */
export const getContractUrl = async (id: string) => {
  const [row] = await query<{ url: string | null }>("select contract_url($1) as url", [id]);
  return row?.url ?? null;
};

export type YearStatus = {
  subscription_id: string;
  nam: number;
  tu_thang: number | null;
  den_thang: number | null;
  co_mo_dau: boolean;
  co_ket_thuc: boolean;
  cac_ky: string[];
};

/** Trạng thái 12 kỳ của năm hiện tại, chỉ lấy cho đúng trang đang xem. */
export const getYearStatus = async (ids: string[]) => {
  if (ids.length === 0) return new Map<string, YearStatus>();
  const rows = await query<YearStatus>(
    `select subscription_id, nam, tu_thang, den_thang, co_mo_dau, co_ket_thuc, cac_ky
       from v_fixed_year_status where subscription_id = any($1)`,
    [ids],
  );
  return new Map(rows.map((r) => [r.subscription_id, r]));
};

export type MonthStat = {
  ky: string;
  ky_moi: string;
  lap_xong: string;
  huy: string;
  luy_ke_chua_huy: string;
  so_ky: string | null;
  ky_da_thu: string | null;
  ky_mien_phi: string | null;
  ky_cho_duyet: string | null;
  ky_ghi_chu: string | null;
  ky_chua_thu: string | null;
  hop_dong_kho_doi: string | null;
  tien_phai_thu: string | null;
  tien_da_thu: string | null;
  tien_chua_thu: string | null;
  ty_le_ky_xong: string | null;
};

/** Thống kê theo tháng của mảng wifi cố định — xem v_fixed_month. */
/**
 * Cước theo kỳ. `tu`/`den` là ngày, nhưng kỳ cước bên nguồn chỉ có YYYY-MM nên
 * cắt về tháng — chọn khoảng 10/09 đến 20/09 thì vẫn ra cả tháng 9, không có
 * cách nào chính xác hơn và cắt vụn ra thì sai hẳn nghĩa "kỳ".
 */
export const getMonthStats = (tu?: string, den?: string) =>
  query<MonthStat>(
    `select ky, ky_moi::text, lap_xong::text, huy::text, luy_ke_chua_huy::text,
            so_ky::text, ky_da_thu::text, ky_mien_phi::text, ky_cho_duyet::text,
            ky_ghi_chu::text, ky_chua_thu::text, hop_dong_kho_doi::text,
            tien_phai_thu::text,
            tien_da_thu::text, tien_chua_thu::text, ty_le_ky_xong::text
       from v_fixed_month
      where ky >= ${tu === undefined ? TU : "$1"}
        ${den === undefined ? "" : "and ky <= $2"}
      order by ky`,
    tu === undefined ? [] : den === undefined ? [tu.slice(0, 7)] : [tu.slice(0, 7), den.slice(0, 7)],
  );

export type RegisterReport = {
  ky: string;
  dang_ky_lan_dau: string;
  dang_ky_lai: string;
  dang_ky: string;
  huy_truoc_lich: string;
  huy_sau_lich: string;
  huy_sau_lap: string;
  huy: string;
  ty_le_huy: string | null;
  con_lai: string;
  co_lich_lap: string;
  chua_co_lich: string;
  lap_xong: string;
  lap_that_bai: string;
};

/** Báo cáo đăng ký theo ngày hoặc theo tháng — xem fixed_register_report. */
export const getRegisterReport = (donVi: "ngay" | "thang", tu: string, den: string) =>
  query<RegisterReport>(
    `select ky, dang_ky_lan_dau::text, dang_ky_lai::text, dang_ky::text,
            huy_truoc_lich::text, huy_sau_lich::text, huy_sau_lap::text, huy::text,
            ty_le_huy::text, con_lai::text, co_lich_lap::text, chua_co_lich::text,
            lap_xong::text, lap_that_bai::text
       from fixed_register_report($1, $2::date, $3::date)`,
    [donVi, tu, den],
  );

export type CollectionReport = {
  ky: string;
  so_ky: string;
  ky_duyet: string;
  ky_mien_phi: string;
  ky_cho_duyet: string;
  ky_ghi_chu: string;
  so_hop_dong: string;
  tien_thu: string;
};

/** Tiền cước thực nhận, gom theo NGÀY THU chứ không theo kỳ cước. */
export const getCollectionReport = (donVi: "ngay" | "thang", tu: string, den: string) =>
  query<CollectionReport>(
    `select ky, so_ky::text, ky_duyet::text, ky_mien_phi::text, ky_cho_duyet::text,
            ky_ghi_chu::text, so_hop_dong::text, tien_thu::text
       from fixed_collection_report($1, $2::date, $3::date)`,
    [donVi, tu, den],
  );

export type ChannelReport = { kenh: string; so_ky: string; tien: string };

export const getChannelReport = (tu: string, den: string) =>
  query<ChannelReport>(
    `select kenh, so_ky::text, tien::text from fixed_channel_report($1::date, $2::date)`,
    [tu, den],
  );

export type CancelReason = {
  nhom: string;
  so_hop_dong: string;
  truoc_lich: string;
  sau_lich: string;
  sau_lap: string;
};

/** Lý do huỷ theo lứa đăng ký — xem fixed_cancel_reason_report. */
export const getCancelReasons = (tu: string, den: string) =>
  query<CancelReason>(
    `select nhom, so_hop_dong::text, truoc_lich::text, sau_lich::text, sau_lap::text
       from fixed_cancel_reason_report($1::date, $2::date)`,
    [tu, den],
  );

export type DifficultDebt = {
  contract_code: string | null;
  subscription_id: string;
  trang_thai_hop_dong: string;
  so_ky_no: string;
  con_no: string;
  ky_da_thu_gan_nhat: string | null;
};

/**
 * Hợp đồng kế toán đánh dấu tay là khó đòi. Cờ của người, không suy từ số kỳ
 * nợ, nên có hợp đồng nợ 0 đồng vẫn nằm đây.
 */
export const getDifficultDebt = () =>
  query<DifficultDebt>(
    `select contract_code, subscription_id, trang_thai_hop_dong,
            so_ky_no::text, con_no::text, ky_da_thu_gan_nhat
       from v_fixed_contract where kho_doi order by con_no desc, contract_code`,
  );

// ── Mảng wifi cầm tay (hệ telecom) ──────────────────────────────────────

export type TelecomSub = {
  subscription_id: string;
  khach: string | null;
  service_type: string | null;
  goi: string | null;
  trang_thai: string;
  gia_thang: string | null;
  ngay_kich_hoat: string | null;
  ngay_ngung: string | null;
  ma_may: string | null;
  so_hoa_don: string;
  hoa_don_dang_doi: string;
  con_no: string;
  hoa_don_mat: string;
  tien_mat: string;
  da_thu: string;
  ky_gan_nhat_den: string | null;
  ngay_qua_han: string;
  may_chua_tra: string;
  ngay_khong_co_cuoc: string | null;
  canh_bao: string[];
  link_cms: string | null;
  hoa_don_don_hang: string;
  la_dai_ly: boolean;
};

export type TelecomFilter = {
  q?: string;
  trangThai?: string;
  dichVu?: string;
  canhBao?: string;
  trang?: number;
};

const COT_TELECOM = `subscription_id, khach, service_type, goi, trang_thai,
       gia_thang::text, ngay_kich_hoat::text, ngay_ngung::text, ma_may,
       so_hoa_don::text, hoa_don_dang_doi::text, con_no::text, hoa_don_mat::text,
       tien_mat::text, da_thu::text, ky_gan_nhat_den::text, ngay_qua_han::text,
       may_chua_tra::text, ngay_khong_co_cuoc::text, canh_bao,
       hoa_don_don_hang::text, la_dai_ly,
       telecom_url('thue_bao', subscription_id) as link_cms`;

function telecomWhere(f: TelecomFilter): { sql: string; params: unknown[] } {
  const dieu: string[] = [];
  const params: unknown[] = [];

  if (f.q?.trim()) {
    params.push(`%${f.q.trim()}%`);
    dieu.push(`(khach ilike $${params.length} or ma_may ilike $${params.length}
                or subscription_id = ${`btrim($${params.length}, '%')`})`);
  }
  if (f.trangThai) {
    params.push(f.trangThai);
    dieu.push(`trang_thai = $${params.length}`);
  }
  if (f.dichVu) {
    params.push(f.dichVu);
    dieu.push(`service_type = $${params.length}`);
  }
  if (f.canhBao === "CO") {
    dieu.push("canh_bao <> '{}'");
  } else if (f.canhBao) {
    params.push(f.canhBao);
    dieu.push(`$${params.length} = any(canh_bao)`);
  }

  return { sql: dieu.length > 0 ? `where ${dieu.join(" and ")}` : "", params };
}

export const getTelecomSubs = (f: TelecomFilter) => {
  const { sql, params } = telecomWhere(f);
  const offset = Math.max(0, ((f.trang ?? 1) - 1) * CONTRACTS_PER_PAGE);
  return query<TelecomSub>(
    `select ${COT_TELECOM} from v_telecom_subscription ${sql}
      order by con_no desc, ngay_qua_han desc, subscription_id
      limit ${CONTRACTS_PER_PAGE} offset ${offset}`,
    params,
  );
};

export const countTelecomSubs = async (f: TelecomFilter) => {
  const { sql, params } = telecomWhere(f);
  const [row] = await query<{ n: string }>(
    `select count(*)::text as n from v_telecom_subscription ${sql}`,
    params,
  );
  return Number(row?.n ?? 0);
};

export const getTelecomSub = async (id: string) => {
  const [row] = await query<TelecomSub>(
    `select ${COT_TELECOM} from v_telecom_subscription where subscription_id = $1`,
    [id],
  );
  return row ?? null;
};

export type TelecomInvoice = {
  invoice_id: string;
  so_hoa_don: string | null;
  ngay_lap: string | null;
  han_tra: string | null;
  ky_tu: string | null;
  ky_den: string | null;
  tien: string;
  da_tra: string;
  con_lai: string;
  trang_thai: string;
  kenh_thu: string | null;
  qua_han: boolean;
  link_cms: string | null;
  loai: string | null;
  so_thue_bao: number | null;
  thue_bao_don: string | null;
};

/**
 * Hoá đơn của khách không điền subscriptionId. Phần lớn vẫn có chủ — nối được
 * về thuê bao qua đơn hàng, xem db/110. Chúng không hiện ở bảng thuê bao nào
 * nên phải bày riêng, nhưng tiền thì vẫn là nợ của khách.
 */
export const getLooseInvoices = (partyId: string) =>
  query<TelecomInvoice>(
    `select invoice_id, so_hoa_don, ngay_lap::text, han_tra::text, ky_tu::text,
            ky_den::text, tien::text, da_tra::text, con_lai::text, trang_thai,
            kenh_thu, qua_han, link_cms, loai, so_thue_bao, thue_bao_don
       from v_telecom_invoice
      where party_id = $1::uuid and subscription_id is null
      order by han_tra desc nulls last`,
    [partyId],
  );

export const getTelecomInvoices = (id: string) =>
  query<TelecomInvoice>(
    `select invoice_id, so_hoa_don, ngay_lap::text, han_tra::text, ky_tu::text,
            ky_den::text, tien::text, da_tra::text, con_lai::text, trang_thai,
            kenh_thu, qua_han, link_cms, loai, so_thue_bao, thue_bao_don
       from v_telecom_invoice where subscription_id = $1
      order by coalesce(ky_tu, ngay_lap) desc`,
    [id],
  );

export type TelecomMonth = {
  ky: string;
  so_hoa_don: string;
  so_thue_bao: string;
  phai_thu: string;
  da_thu: string;
  con_doi: string | null;
  mat_trang: string | null;
  hoa_don_dang_doi: string;
  hoa_don_mat: string;
  ty_le_thu: string | null;
};

export const getTelecomMonths = () =>
  query<TelecomMonth>(
    `select ky, so_hoa_don::text, so_thue_bao::text, phai_thu::text, da_thu::text,
            con_doi::text, mat_trang::text, hoa_don_dang_doi::text,
            hoa_don_mat::text, ty_le_thu::text
       from v_telecom_month where ky >= ${TU} order by ky`,
  );

export const getTelecomChannels = (tu: string, den: string) =>
  query<ChannelReport>(
    `select kenh, so_lan::text as so_ky, tien::text
       from telecom_channel_report($1::date, $2::date)`,
    [tu, den],
  );

export type TelecomTotals = {
  khach: string;
  thue_bao: string;
  dang_chay: string;
  thue_bao_dai_ly: string;
  con_no: string;
  no_qua_han: string;
  tien_mat: string;
  thieu_hoa_don: string;
  may_chua_tra: string;
};

/**
 * Tổng quan cầm tay. Số lượng thì đếm hết, nhưng mọi con số TIỀN chỉ tính phần
 * mình thu: đại lý tự thu nên không cộng vào đây, cũng không vào hai danh sách
 * việc. Xem db/097.
 */
export const getTelecomTotals = async () => {
  // Khách và nợ đếm theo NGƯỜI, lấy từ chính view mà trang Khách dùng. Đếm
  // theo thuê bao thì hụt 29 khách chỉ có hoá đơn mà không có thuê bao nào,
  // và hụt cả phần nợ của hoá đơn không gắn thuê bao — bấm vào thẻ sang trang
  // Khách lại thấy số khác, không ai hiểu vì sao.
  const [row] = await query<TelecomTotals>(
    `select (select count(*)::text from v_telecom_customer)          as khach,
            count(*)::text                                          as thue_bao,
            count(*) filter (where trang_thai = 'ACTIVE')::text     as dang_chay,
            count(*) filter (where la_dai_ly)::text                 as thue_bao_dai_ly,
            (select round(sum(con_no))::text from v_telecom_customer
              where not la_dai_ly)                                   as con_no,
            (select round(sum(con_no))::text from v_telecom_customer
              where 'NO_QUA_HAN' = any(canh_bao))                    as no_qua_han,
            (select round(sum(tien_mat))::text from v_telecom_customer
              where not la_dai_ly)                                   as tien_mat,
            count(*) filter (where 'THIEU_HOA_DON' = any(canh_bao))::text as thieu_hoa_don,
            sum(may_chua_tra)::text                                 as may_chua_tra
       from v_telecom_subscription`,
  );
  return row!;
};

export type TelecomCustomer = {
  party_id: string;
  khach: string;
  ma_khach: string | null;
  dien_thoai: string | null;
  loai_khach: string | null;
  nhom_khach: string | null;
  so_thue_bao: string;
  dang_chay: string;
  dich_vu: string[] | null;
  da_thu: string;
  con_no: string;
  tien_mat: string;
  may_chua_tra: string;
  ngay_qua_han: string;
  ky_gan_nhat_den: string | null;
  canh_bao: string[];
  chua_toi_han: string;
  la_dai_ly: boolean;
  link_cms: string[] | null;
  phai_hoan: string;
};

export type CustomerFilter = {
  q?: string;
  dichVu?: string;
  canhBao?: string;
  nhieuTb?: string;
  loai?: string;
  trang?: number;
};

const COT_KHACH = `party_id::text, khach, ma_khach, dien_thoai, loai_khach,
       nhom_khach, so_thue_bao::text,
       dang_chay::text, dich_vu, da_thu::text, con_no::text, tien_mat::text,
       may_chua_tra::text, ngay_qua_han::text, ky_gan_nhat_den::text, canh_bao,
       chua_toi_han::text, link_cms, phai_hoan::text, la_dai_ly`;

function customerWhere(f: CustomerFilter): { sql: string; params: unknown[] } {
  const dieu: string[] = [];
  const params: unknown[] = [];

  if (f.q?.trim()) {
    params.push(`%${f.q.trim()}%`);
    const t = `$${params.length}`;
    // Tìm cả theo mã máy của thuê bao, nếu không thì bỏ bảng phẳng đi là mất
    // đường tra theo IMEI.
    dieu.push(`(khach ilike ${t} or dien_thoai ilike ${t} or ma_khach ilike ${t}
                or exists (select 1 from v_telecom_customer_sub s
                            where s.party_id = v_telecom_customer.party_id
                              and s.ma_may ilike ${t}))`);
  }
  if (f.dichVu) {
    params.push(f.dichVu);
    dieu.push(`$${params.length} = any(dich_vu)`);
  }
  if (f.canhBao === "CO") {
    dieu.push("canh_bao <> '{}'");
  } else if (f.canhBao) {
    params.push(f.canhBao);
    dieu.push(`$${params.length} = any(canh_bao)`);
  }
  if (f.nhieuTb === "1") dieu.push("so_thue_bao > 1");
  if (f.loai) {
    params.push(f.loai);
    dieu.push(`loai_khach = $${params.length}`);
  }

  return { sql: dieu.length > 0 ? `where ${dieu.join(" and ")}` : "", params };
}

export const getTelecomCustomers = (f: CustomerFilter) => {
  const { sql, params } = customerWhere(f);
  const offset = Math.max(0, ((f.trang ?? 1) - 1) * CONTRACTS_PER_PAGE);
  return query<TelecomCustomer>(
    `select ${COT_KHACH} from v_telecom_customer ${sql}
      order by con_no desc, tien_mat desc, so_thue_bao desc
      limit ${CONTRACTS_PER_PAGE} offset ${offset}`,
    params,
  );
};

export const countTelecomCustomers = async (f: CustomerFilter) => {
  const { sql, params } = customerWhere(f);
  const [row] = await query<{ n: string }>(
    `select count(*)::text as n from v_telecom_customer ${sql}`,
    params,
  );
  return Number(row?.n ?? 0);
};

export const getTelecomCustomer = async (id: string) => {
  const [row] = await query<TelecomCustomer>(
    `select ${COT_KHACH} from v_telecom_customer where party_id = $1::uuid`,
    [id],
  );
  return row ?? null;
};

export type CustomerSub = {
  subscription_id: string;
  service_type: string | null;
  goi: string | null;
  trang_thai: string;
  gia_thang: string | null;
  ngay_kich_hoat: string | null;
  ngay_ngung: string | null;
  ma_may: string | null;
  so_hoa_don: string;
  da_thu: string;
  con_no: string;
  tien_mat: string;
  ky_gan_nhat_den: string | null;
  canh_bao: string[];
  link_cms: string | null;
};

export const getCustomerSubs = (id: string) =>
  query<CustomerSub>(
    `select subscription_id, service_type, goi, trang_thai, gia_thang::text,
            ngay_kich_hoat::text, ngay_ngung::text, ma_may, so_hoa_don::text,
            da_thu::text, con_no::text, tien_mat::text, ky_gan_nhat_den::text,
            canh_bao, link_cms
       from v_telecom_customer_sub where party_id = $1::uuid
      order by con_no desc, ngay_kich_hoat desc nulls last`,
    [id],
  );

/** Thuê bao của nhiều khách một lượt, để bày kèm ngay dưới dòng khách. */
export const getSubsForParties = async (ids: string[]) => {
  if (ids.length === 0) return new Map<string, CustomerSub[]>();
  const rows = await query<CustomerSub & { party_id: string }>(
    `select party_id::text, subscription_id, service_type, goi, trang_thai,
            gia_thang::text, ngay_kich_hoat::text, ngay_ngung::text, ma_may,
            so_hoa_don::text, da_thu::text, con_no::text, tien_mat::text,
            ky_gan_nhat_den::text, canh_bao
       from v_telecom_customer_sub
      where party_id = any($1::uuid[])
      order by con_no desc, ngay_kich_hoat desc nulls last`,
    [ids],
  );
  const theo = new Map<string, CustomerSub[]>();
  for (const r of rows) {
    theo.set(r.party_id, [...(theo.get(r.party_id) ?? []), r]);
  }
  return theo;
};

/** Dải 12 tháng của mảng cầm tay, chỉ lấy cho các thuê bao đang hiện. */
export const getTelecomYearStatus = async (ids: string[]) => {
  if (ids.length === 0) return new Map<string, YearStatus>();
  const rows = await query<YearStatus>(
    `select subscription_id, nam, tu_thang, den_thang, co_mo_dau, co_ket_thuc, cac_ky
       from v_telecom_year_status where subscription_id = any($1)`,
    [ids],
  );
  return new Map(rows.map((r) => [r.subscription_id, r]));
};

export type TelecomDevice = {
  subscription_id: string;
  imei: string;
  gan_tu: string | null;
  gan_den: string | null;
  trang_thai_may: string | null;
  coc: string | null;
  trang_thai_coc: string | null;
  ngay_thue: string | null;
  ngay_tra: string | null;
  dang_gan: boolean;
};

const COT_MAY = `subscription_id, imei, gan_tu::text, gan_den::text, trang_thai_may,
       coc::text, trang_thai_coc, ngay_thue::text, ngay_tra::text, dang_gan`;

/** Máy và cọc của một thuê bao, kể cả máy đã đổi đi. */
export const getTelecomDevices = (id: string) =>
  query<TelecomDevice>(
    `select ${COT_MAY} from v_telecom_device where subscription_id = $1
      order by gan_tu desc nulls last`,
    [id],
  );

/** Máy đang gắn của nhiều thuê bao, để bày kèm dòng dịch vụ. */
export const getDevicesForSubs = async (ids: string[]) => {
  if (ids.length === 0) return new Map<string, TelecomDevice>();
  const rows = await query<TelecomDevice>(
    `select distinct on (subscription_id) ${COT_MAY}
       from v_telecom_device
      where subscription_id = any($1) and dang_gan
      order by subscription_id, gan_tu desc nulls last`,
    [ids],
  );
  return new Map(rows.map((r) => [r.subscription_id, r]));
};

export type DepositRow = {
  imei: string;
  subscription_id: string;
  party_id: string | null;
  khach: string;
  loai_khach: string | null;
  service_type: string | null;
  trang_thai_thue_bao: string | null;
  ngay_ngung: string | null;
  trang_thai_may: string | null;
  coc: string | null;
  trang_thai_coc: string | null;
  ngay_thue: string | null;
  gan_tu: string | null;
  nhom: string;
  so_ngay_treo: string | null;
};

export type DepositSummary = {
  nhom: string;
  so_may: string;
  tien: string;
  treo_lau_nhat: string | null;
};

export const getDepositSummary = () =>
  query<DepositSummary>(
    `select nhom, so_may::text, tien::text, treo_lau_nhat::text
       from v_telecom_deposit_summary order by tien desc`,
  );

export const getDeposits = (nhom: string, trang: number) => {
  const params: unknown[] = [];
  let dieu = "where nhom = any($1)";
  params.push(nhom ? [nhom] : ["CHUA_TRA", "NGUNG_CHUA_CHOT", "CHUA_GAN"]);
  const offset = Math.max(0, (trang - 1) * CONTRACTS_PER_PAGE);
  return query<DepositRow>(
    `select imei, subscription_id, party_id::text, khach, loai_khach, service_type,
            trang_thai_thue_bao, ngay_ngung::text, trang_thai_may, coc::text,
            trang_thai_coc, ngay_thue::text, gan_tu::text, nhom, so_ngay_treo::text
       from v_telecom_deposit ${dieu}
      order by coc desc nulls last, so_ngay_treo desc nulls last, imei
      limit ${CONTRACTS_PER_PAGE} offset ${offset}`,
    params,
  );
};

export const countDeposits = async (nhom: string) => {
  const [row] = await query<{ n: string; tien: string }>(
    `select count(*)::text as n, round(coalesce(sum(coc), 0))::text as tien
       from v_telecom_deposit where nhom = any($1)`,
    [nhom ? [nhom] : ["CHUA_TRA", "NGUNG_CHUA_CHOT", "CHUA_GAN"]],
  );
  return { so: Number(row?.n ?? 0), tien: row?.tien ?? "0" };
};

export type CanHuy = {
  nguon: string;
  id: string;
  ma: string | null;
  khach: string | null;
  dich_vu: string | null;
  goi: string | null;
  gia_thang: string | null;
  con_no: string;
  coc_cho_duyet: string;
  so_ky_no: string | null;
  ky_no_cu_nhat: string | null;
  ngay_qua_han: string | null;
  kho_doi: boolean;
  link_cms: string | null;
};

/**
 * Dịch vụ đang chạy đã quá hạn thu cước, xếp cái treo lâu nhất lên đầu — đó là
 * thứ tự cần cân nhắc cắt.
 */
export const getCanHuy = (nguon?: string) =>
  query<CanHuy>(
    `select nguon::text, id, ma, khach, dich_vu, goi, gia_thang::text,
            con_no::text, coc_cho_duyet::text, so_ky_no::text, ky_no_cu_nhat,
            ngay_qua_han::text, kho_doi, link_cms
       from v_xem_xet_huy
      ${nguon ? "where nguon = $1::source_system" : ""}
      order by ngay_qua_han desc nulls last, con_no desc`,
    nguon ? [nguon] : [],
  );

export type KhoanThu = {
  nguon: string;
  id: string;
  ma: string | null;
  khach: string | null;
  dich_vu: string | null;
  ky: string | null;
  tien: string | null;
  coc_cho_duyet: string;
  han_tra: string | null;
  qua_han: boolean;
  ngay_le: string | null;
  so_hoa_don: string | null;
  tinh_trang: string | null;
  loai_hoa_don: string | null;
  kho_doi: boolean;
  link_cms: string | null;
};

/**
 * Từng khoản còn phải thu. Xếp theo hạn tăng dần — quá hạn lâu nhất lên đầu,
 * rồi mới tới cái sắp đến hạn. Đó là thứ tự đi thu.
 */
export const getKhoanThu = (nguon?: string, chi_qua_han?: boolean) => {
  const dieu: string[] = [];
  const params: unknown[] = [];
  if (nguon) {
    params.push(nguon);
    dieu.push(`nguon = $${params.length}::source_system`);
  }
  if (chi_qua_han) dieu.push("qua_han");
  return query<KhoanThu>(
    `select nguon::text, id, ma, khach, dich_vu, ky, tien::text,
            coc_cho_duyet::text, han_tra::text, qua_han, ngay_le::text,
            so_hoa_don, tinh_trang, loai_hoa_don, kho_doi, link_cms
       from v_thu_cuoc
      ${dieu.length ? `where ${dieu.join(" and ")}` : ""}
      order by han_tra, tien desc
      limit 500`,
    params,
  );
};

export const getThuCuocTomTat = () =>
  query<{ nguon: string; qua_han: boolean; so_khoan: string; tien: string }>(
    `select nguon::text, qua_han, count(*)::text as so_khoan,
            round(sum(tien))::text as tien
       from v_thu_cuoc group by 1, 2`,
  );

export type ThangDichVu = {
  ky: string;
  dich_vu: string;
  thue_bao_chay: string;
  thue_bao_co_cuoc: string;
  chenh: string | null;
  so_dong: string;
  so_khach: string;
  phai_thu: string | null;
  da_thu: string | null;
  chua_thu: string | null;
  khong_doi_duoc: string | null;
  khach_da_thu: string;
  khach_chua_thu: string;
  ty_le_thu: string | null;
};

/** Cước cầm tay theo tháng × dịch vụ, một năm một lượt. */
export const getThangDichVu = (nam: string) =>
  query<ThangDichVu>(
    `select ky, dich_vu, thue_bao_chay::text, thue_bao_co_cuoc::text,
            chenh::text, so_dong::text, so_khach::text,
            phai_thu::text, da_thu::text, chua_thu::text, khong_doi_duoc::text,
            khach_da_thu::text, khach_chua_thu::text, ty_le_thu::text
       from v_telecom_month_service
      where ky like $1 || '-%'
      order by ky desc, phai_thu desc nulls last`,
    [nam],
  );

/** Các năm có số liệu, để dựng ô chọn năm. */
export const getNamCoSoLieu = () =>
  query<{ nam: string }>(
    `select distinct left(ky, 4) as nam from v_telecom_month_service order by 1 desc`,
  );

export type ThueBaoThang = {
  subscription_id: string;
  party_id: string | null;
  khach: string | null;
  ma_khach: string | null;
  dich_vu: string | null;
  goi: string | null;
  trang_thai: string;
  kich_hoat: string | null;
  ngung: string | null;
  cuoc_cuoi: string | null;
  dang_chay: boolean;
  co_cuoc: boolean;
  phai_thu: string | null;
  da_thu: string | null;
  chua_thu: string | null;
  khong_doi_duoc: string | null;
  link_cms: string | null;
};

/**
 * Từng thuê bao của một tháng, kèm cờ đang chạy / có cước. Cộng lại khớp đúng
 * dòng tháng trên trang cước theo dịch vụ. Lệch lên đầu, rồi cước cuối cũ nhất
 * trước — thuê bao ngừng ra cước lâu nhất là cái cần soi trước.
 */
export const getThueBaoThang = (ky: string, dichVu?: string) =>
  query<ThueBaoThang>(
    `select subscription_id, party_id::text, khach, ma_khach, dich_vu, goi, trang_thai,
            kich_hoat::text, ngung::text, cuoc_cuoi, dang_chay, co_cuoc,
            phai_thu::text, da_thu::text, chua_thu::text, khong_doi_duoc::text, link_cms
       from telecom_month_subs($1)
      ${dichVu ? "where dich_vu = $2" : ""}
      order by (dang_chay <> co_cuoc) desc, cuoc_cuoi nulls first, khach`,
    dichVu ? [ky, dichVu] : [ky],
  );

export type FixedThangChay = {
  ky: string;
  cong_ty: string;
  dai_ly: string;
  co_ky_cuoc: string;
  thieu_gia_cuoc: string;
  chenh: string;
  phai_ra_ky: string;
  so_cms: string;
  ngoai_ky: string;
  thieu_ngay_thu: string;
};

/** Hợp đồng wifi cố định đang chạy từng tháng, so với số có kỳ cước trong sổ. */
export const getFixedThangChay = () =>
  query<FixedThangChay>(
    `select ky, cong_ty::text, dai_ly::text, co_ky_cuoc::text, thieu_gia_cuoc::text,
            chenh::text, phai_ra_ky::text, so_cms::text, ngoai_ky::text,
            thieu_ngay_thu::text
       from v_fixed_month_chay order by ky desc`,
  );

export type HopDongThang = {
  subscription_id: string;
  ma_hop_dong: string | null;
  dia_chi: string | null;
  trang_thai_hop_dong: string;
  ngay_lap_xong: string | null;
  ngay_huy: string | null;
  cuoc_thang: string | null;
  bat_dau_thu: string | null;
  dang_chay: boolean;
  co_ky_cuoc: boolean;
  thieu_gia: boolean;
  do_cong_ty: boolean;
  nguoi_tao: string | null;
  trang_thai_ky: string | null;
  phai_thu: string | null;
  da_thu: string | null;
  kho_doi: boolean;
  link_cms: string | null;
};

/** Hợp đồng của một tháng: đang chạy, có kỳ cước, hoặc cả hai. Lệch lên đầu. */
export const getHopDongThang = (ky: string) =>
  query<HopDongThang>(
    `select subscription_id, ma_hop_dong, dia_chi, trang_thai_hop_dong,
            ngay_lap_xong::text, ngay_huy::text, cuoc_thang::text, bat_dau_thu::text,
            dang_chay, co_ky_cuoc, thieu_gia, do_cong_ty, nguoi_tao,
            trang_thai_ky, phai_thu::text,
            da_thu::text, kho_doi, link_cms
       from fixed_month_contracts($1)
      order by do_cong_ty desc, (dang_chay <> co_ky_cuoc) desc, thieu_gia desc, ma_hop_dong`,
    [ky],
  );

export type InstallMonth = {
  ky_ky: string;
  do_cong_ty: boolean;
  dang_ky_lan_dau: string;
  dang_ky_lai: string;
  so_don: string;
  huy_truoc_lich: string;
  huy_sau_lich: string;
  huy_sau_lap: string;
  huy: string;
  con_lai: string;
  co_lich: string;
  chua_co_lich: string;
  lap_xong: string;
  lap_hong: string;
  ngay_trung_vi: string | null;
};

/** Đơn wifi cố định gom theo tháng ký — xem v_fixed_install_month. */
export const getInstallMonths = () =>
  query<InstallMonth>(
    `select ky_ky, do_cong_ty, dang_ky_lan_dau::text, dang_ky_lai::text, so_don::text,
            huy_truoc_lich::text, huy_sau_lich::text, huy_sau_lap::text, huy::text,
            con_lai::text, co_lich::text, chua_co_lich::text,
            lap_xong::text, lap_hong::text,
            round(ngay_trung_vi)::text as ngay_trung_vi
       from v_fixed_install_month order by ky_ky desc`,
  );

export type InstallPending = {
  do_cong_ty: boolean;
  co_lich: boolean;
  ma_nhom: string;
  ten_nhom: string;
  so_don: string;
  ky_som_nhat: string | null;
};

export const getInstallPending = () =>
  query<InstallPending>(
    `select do_cong_ty, co_lich, ma_nhom,
            fixed_install_ten_nhom(ma_nhom) as ten_nhom,
            so_don::text, ky_som_nhat::text
       from v_fixed_install_pending order by ma_nhom`,
  );

export type InstallOrder = {
  subscription_id: string;
  ma_hop_dong: string | null;
  dia_chi: string | null;
  do_cong_ty: boolean;
  nguoi_tao: string | null;
  trang_thai_lap_dat: string | null;
  trang_thai_hop_dong: string;
  ngay_ky: string | null;
  ngay_hen: string | null;
  ngay_lap_xong: string | null;
  ngay_huy: string | null;
  so_ngay_cho: string | null;
  ly_do_huy: string | null;
  nhom_ly_do_huy: string | null;
  tinh_huong: string;
  link_cms: string | null;
};

/** Đơn của một tháng ký. Còn chờ lâu nhất lên đầu — đó là thứ tự cần xử lý. */
export const getInstallCohort = (ky: string) =>
  query<InstallOrder>(
    `select subscription_id, ma_hop_dong, dia_chi, do_cong_ty, nguoi_tao,
            trang_thai_lap_dat, trang_thai_hop_dong, ngay_ky::text, ngay_hen::text,
            ngay_lap_xong::text, ngay_huy::text, so_ngay_cho::text,
            ly_do_huy, nhom_ly_do_huy, tinh_huong, link_cms
       from fixed_install_cohort($1)
      order by (tinh_huong in ('CO_LICH', 'CHUA_CO_LICH')) desc,
               so_ngay_cho desc, ma_hop_dong`,
    [ky],
  );

/** Đơn đang chờ lắp trong một nhóm thời gian chờ; chuỗi rỗng là lấy tất cả. */
export const getInstallPendingList = (nhom: string) =>
  query<InstallOrder>(
    `select subscription_id, ma_hop_dong, dia_chi, do_cong_ty, nguoi_tao,
            trang_thai_lap_dat, trang_thai_hop_dong, ngay_ky::text, ngay_hen::text,
            ngay_lap_xong::text, ngay_huy::text, so_ngay_cho::text,
            ly_do_huy, nhom_ly_do_huy, tinh_huong, link_cms
       from fixed_install_pending_list($1)
      order by so_ngay_cho desc, ma_hop_dong`,
    [nhom],
  );

export type ThuNgoaiHopDong = {
  subscription_id: string;
  ma_hop_dong: string | null;
  dia_chi: string | null;
  do_cong_ty: boolean;
  ky: string;
  tien: string;
  ngay_thu: string | null;
  kenh: string | null;
  nguoi_nhap: string | null;
  fee_start_on: string | null;
  fee_end_on: string | null;
  ngay_lap_xong: string | null;
  ngay_huy: string | null;
  trang_thai_hop_dong: string;
  tinh_huong: string | null;
  link_cms: string | null;
};

/** Kỳ đã thu tiền mà nằm ngoài khoảng thu của hợp đồng — xem db/103. */
export const getThuNgoaiHopDong = () =>
  query<ThuNgoaiHopDong>(
    `select subscription_id, ma_hop_dong, dia_chi, do_cong_ty, ky, tien::text,
            ngay_thu::text, kenh, nguoi_nhap, fee_start_on::text, fee_end_on::text,
            ngay_lap_xong::text, ngay_huy::text, trang_thai_hop_dong, tinh_huong, link_cms
       from v_fixed_thu_ngoai_hop_dong
      order by tien desc, ma_hop_dong, ky`,
  );

export type KyHut = {
  subscription_id: string;
  ma_hop_dong: string | null;
  dia_chi: string | null;
  ky: string;
  tien_le_ra: string;
  tien_da_thu: string;
  fee_start_on: string | null;
  fee_end_on: string | null;
  ngay_lap_xong: string | null;
  ngay_huy: string | null;
  so_ngay_lech: string;
  ly_do_huy: string | null;
  nhom_ly_do_huy: string | null;
  trang_thai_so: string;
  link_cms: string | null;
};

/** Tháng còn chạy giữa ngày kết thúc thu và ngày huỷ — xem db/109. */
export const getKyHut = () =>
  query<KyHut>(
    `select subscription_id, ma_hop_dong, dia_chi, ky, tien_le_ra::text,
            tien_da_thu::text, fee_start_on::text, fee_end_on::text,
            ngay_lap_xong::text, ngay_huy::text, so_ngay_lech::text,
            ly_do_huy, nhom_ly_do_huy, trang_thai_so, link_cms
       from v_fixed_ky_hut
      order by so_ngay_lech desc, ma_hop_dong, ky`,
  );

export type TelecomChurn = {
  thang: string;
  loai_khach: string;
  dau_ky: string;
  moi: string;
  huy: string;
  cuoi_ky: string;
  ty_le_huy: string | null;
  thang_chua_xong: boolean;
};

/** Thuê bao cầm tay huỷ theo tháng — xem db/112. */
export const getTelecomChurn = () =>
  query<TelecomChurn>(
    `select thang, loai_khach, dau_ky::text, moi::text, huy::text, cuoi_ky::text,
            ty_le_huy::text, thang_chua_xong
       from v_telecom_huy_thang order by thang desc, loai_khach`,
  );

export type TelecomChurnRow = {
  subscription_id: string;
  khach: string;
  ma_khach: string | null;
  loai_khach: string | null;
  service_type: string | null;
  goi: string | null;
  gia_thang: string | null;
  ngay_kich_hoat: string | null;
  ngay_ngung: string | null;
  so_thang_dung: string | null;
  la_dai_ly: boolean;
  con_no: string;
  link_cms: string | null;
  thang: string;
};

/** Thuê bao ngừng; chuỗi rỗng là lấy mọi tháng. */
export const getTelecomChurnList = (thang: string) =>
  query<TelecomChurnRow>(
    `select subscription_id, khach, ma_khach, loai_khach, service_type, goi,
            gia_thang::text, ngay_kich_hoat::text, ngay_ngung::text,
            so_thang_dung::text, la_dai_ly, con_no::text, link_cms, thang
       from telecom_huy_danh_sach($1)
      order by ngay_ngung desc, con_no desc, so_thang_dung, khach`,
    [thang],
  );

export type ContractExtra = {
  contract_type: string | null;
  lich_huy_du_kien: string | null;
  ma_u: string | null;
  provider_status: string | null;
  owner: string | null;
  nguoi_tao: string | null;
};

/** Trường phụ bên nguồn, xem db/111. Bày để đối chiếu với màn hình CMS. */
export const getContractExtra = async (id: string) => {
  const [row] = await query<ContractExtra>(
    `select e.contract_type, e.lich_huy_du_kien::text, e.ma_u, e.provider_status,
            e.owner, s.created_by_src as nguoi_tao
       from fixed_contract_extra e
       join subscription_snapshot s on s.source = 'FIXED' and s.source_id = e.source_id
      where e.source = 'FIXED' and e.source_id = $1`,
    [id],
  );
  return row ?? null;
};

export type DoiChieuCms = {
  ky: string;
  cms_hop_dong: string;
  cms_tien: string | null;
  minh_hop_dong: string;
  minh_tien: string | null;
  huy_sau: string;
  minh_them_khac: string;
  het_han_chua_huy: string;
  cms_them_khac: string;
};

/** So bảng cước của mình với luật báo cáo CMS — xem db/116. */
export const getDoiChieuCms = () =>
  query<DoiChieuCms>(
    `select ky, cms_hop_dong::text, cms_tien::text, minh_hop_dong::text,
            minh_tien::text, huy_sau::text, minh_them_khac::text,
            het_han_chua_huy::text, cms_them_khac::text
       from v_fixed_doi_chieu_cms
      where minh_hop_dong > 0 or cms_hop_dong > 0
      order by ky desc limit 18`,
  );

export type TelecomMay = {
  imei: string;
  luot_moi_nhat_id: string;
  model: string | null;
  trang_thai: string | null;
  coc: string | null;
  trang_thai_coc: string | null;
  ngay_thue: string | null;
  ngay_tra: string | null;
  so_luot_thue: string;
  thue_bao_hien_tai: string | null;
  dich_vu: string | null;
  goi: string | null;
  trang_thai_thue_bao: string | null;
  khach: string;
  ma_khach: string | null;
  loai_khach: string | null;
  so_lan_gan: string;
  so_thue_bao: string;
  so_ky: string;
  ky_dau: string | null;
  ky_cuoi: string | null;
  phai_thu: string;
  da_thu: string;
  chua_thu: string;
  mat_trang: string;
  chua_ra_cuoc: boolean;
  link_cms: string | null;
  tinh_trang_cuoc: string;
  thue_bao_gan_cuoi: string | null;
  trang_thai_tb_gan_cuoi: string | null;
  thang_hut: string;
  tien_hut_uoc: string;
  nhom_may: string | null;
  nhom_khach: string | null;
  cho_muon: boolean;
  /** Phiếu xuất đánh dấu không cần thu hồi — máy này không bao giờ về kho. */
  khong_thu_hoi: boolean;
};

/** Máy cho thuê wifi cầm tay, một dòng một máy — xem db/119, db/120. */
export const getTelecomMay = () =>
  query<TelecomMay>(
    `select imei, luot_moi_nhat_id, model, trang_thai, coc::text, trang_thai_coc,
            ngay_thue::text, ngay_tra::text, so_luot_thue::text, thue_bao_hien_tai,
            dich_vu, goi, trang_thai_thue_bao, khach, ma_khach, loai_khach,
            so_lan_gan::text, so_thue_bao::text, so_ky::text, ky_dau, ky_cuoi,
            phai_thu::text, da_thu::text, chua_thu::text, mat_trang::text,
            chua_ra_cuoc, link_cms, tinh_trang_cuoc, thue_bao_gan_cuoi,
            trang_thai_tb_gan_cuoi, thang_hut::text, tien_hut_uoc::text,
            nhom_may, nhom_khach, cho_muon, khong_thu_hoi
       from v_telecom_may
      order by case tinh_trang_cuoc
                 when 'HUT_CUOC' then 1 when 'TB_DA_XOA' then 2
                 when 'CHUA_GAN' then 3 when 'HUY_CHUA_THU_MAY' then 4 else 5 end,
               chua_thu desc, imei`,
  );

export type TelecomMayKy = {
  ky: string;
  subscription_id: string;
  tien: string;
  trang_thai_hd: string | null;
  so_hoa_don: string | null;
  fee_line_id: string;
};

/** Một máy, cho ngăn kéo — đừng kéo cả 3.048 dòng về rồi lọc ở JS. */
export const getTelecomMayMot = async (imei: string) => {
  const [row] = await query<TelecomMay>(
    `select imei, luot_moi_nhat_id, model, trang_thai, coc::text, trang_thai_coc,
            ngay_thue::text, ngay_tra::text, so_luot_thue::text, thue_bao_hien_tai,
            dich_vu, goi, trang_thai_thue_bao, khach, ma_khach, loai_khach,
            so_lan_gan::text, so_thue_bao::text, so_ky::text, ky_dau, ky_cuoi,
            phai_thu::text, da_thu::text, chua_thu::text, mat_trang::text,
            chua_ra_cuoc, link_cms, tinh_trang_cuoc, thue_bao_gan_cuoi,
            trang_thai_tb_gan_cuoi, thang_hut::text, tien_hut_uoc::text,
            nhom_may, nhom_khach, cho_muon, khong_thu_hoi
       from v_telecom_may where imei = $1`,
    [imei],
  );
  return row ?? null;
};

/** Từng kỳ cước của một máy, cho ngăn kéo. */
export const getTelecomMayKy = (imei: string) =>
  query<TelecomMayKy>(
    `select ky, subscription_id, tien::text, trang_thai_hd, so_hoa_don, fee_line_id
       from v_telecom_may_ky where imei = $1 order by ky desc, subscription_id`,
    [imei],
  );

export type KhoDoiChieu = {
  ma: string;
  ma_chuan: string;
  nhom_hang: string | null;
  ket_luan: string | null;
  vi_tri_so: string | null;
  vi_tri_kiem_kho: string | null;
  nguoi_giu: string | null;
  coc: string | null;
  so_dong_so: string | null;
  danh_sach_so: string | null;
  pm_imei: string | null;
  pm_doi_may: string | null;
  doi_may_tu_phieu: boolean;
  pm_trang_thai_may: string | null;
  pm_tinh_trang_cuoc: string | null;
  pm_khach: string | null;
  pm_ma_khach: string | null;
  nguon_khach: string | null;
  pm_phieu: string | null;
  pm_ly_do: string | null;
  pm_kho: string | null;
  pm_ngay_phieu: string | null;
  pm_nha_mang: string | null;
  pm_vendor: string | null;
  pm_ket_luan: string;
};

/** Bản đối chiếu kho làm tay đặt cạnh phần mềm — xem db/125. */
export const getKhoDoiChieu = () =>
  query<KhoDoiChieu>(
    `select ma, ma_chuan, nhom_hang, ket_luan, vi_tri_so, vi_tri_kiem_kho,
            nguoi_giu, coc::text, so_dong_so::text, danh_sach_so,
            pm_imei, pm_doi_may, doi_may_tu_phieu, pm_trang_thai_may,
            pm_tinh_trang_cuoc, pm_khach, pm_ma_khach, nguon_khach,
            pm_phieu, pm_ly_do, pm_kho,
            pm_ngay_phieu::text, pm_nha_mang, pm_vendor, pm_ket_luan
       from v_kho_doi_chieu
      order by case pm_ket_luan when 'O_KHACH' then 1 when 'TRONG_KHO' then 2
                                when 'CHI_NHA_MANG' then 3 when 'TRA_NCC' then 4
                                else 5 end, ket_luan, ma`,
  );

export type KhoThieu = {
  device_code: string;
  doc_type: string | null;
  reason_type: string | null;
  warehouse_name: string | null;
  doc_date: string | null;
  model: string | null;
  trang_thai: string | null;
  tinh_trang_cuoc: string | null;
  khach: string | null;
};

/** Mã phần mềm đang giữ phiếu kho mà bản đối chiếu không nhắc tới. */
export const getKhoThieuOFile = () =>
  query<KhoThieu>(
    `select device_code, doc_type, reason_type, warehouse_name, doc_date::text,
            model, trang_thai, tinh_trang_cuoc, khach
       from v_kho_thieu_o_file
      order by doc_date desc nulls last, device_code`,
  );

export type KhoLanNhap = {
  id: string;
  ten_file: string;
  sua_luc: string | null;
  nhap_luc: string;
  so_ma: string;
  so_dong_so: string;
  so_ma_trung: string;
};

/** Lần nhập file đối chiếu đang dùng — xem db/126. */
export const getKhoLanNhap = async () => {
  const [row] = await query<KhoLanNhap>(
    `select id::text, ten_file, sua_luc::text, nhap_luc::text, so_ma::text,
            so_dong_so::text, so_ma_trung::text
       from v_kho_lan_nhap`,
  );
  return row ?? null;
};

export type KhoMa = {
  ma_chuan: string;
  ma: string;
  nhom_tb: string;
  loai_ma: string;
  pm_co: boolean;
  cho_dung: string;
  doi_may: string | null;
  doc_type: string | null;
  reason_type: string | null;
  warehouse_name: string | null;
  doc_date: string | null;
  trang_thai_may: string | null;
  co_thue_bao: boolean;
  thue_bao: string | null;
  tinh_trang_cuoc: string | null;
  ky_cuoi: string | null;
  coc: string | null;
  trang_thai_coc: string | null;
  chua_thu: string | null;
  khach: string | null;
  ma_khach: string | null;
  loai_khach: string | null;
  nguon_khach: string | null;
  nha_mang: string | null;
  vendor: string | null;
  link_cms: string | null;
  file_co: boolean;
  file_nhom_hang: string | null;
  file_ket_luan: string | null;
  file_vi_tri_so: string | null;
  file_kiem_kho: string | null;
  file_nguoi_giu: string | null;
  /** Phiếu xuất đánh dấu không cần thu hồi — máy này không bao giờ về kho. */
  khong_thu_hoi: boolean;
};

/** Mọi mã thiết bị hai phía biết, không bên nào làm chuẩn — xem db/129. */
export const getKhoMa = () =>
  query<KhoMa>(
    `select ma_chuan, ma, nhom_tb, loai_ma, pm_co, cho_dung, doi_may, doc_type, reason_type,
            warehouse_name, doc_date::text, trang_thai_may, co_thue_bao,
            thue_bao, tinh_trang_cuoc,
            ky_cuoi, coc::text, trang_thai_coc, chua_thu::text,
            khach, ma_khach, loai_khach, nguon_khach, nha_mang, vendor, link_cms,
            file_co, file_nhom_hang, file_ket_luan, file_vi_tri_so,
            file_kiem_kho, file_nguoi_giu, khong_thu_hoi
       from v_kho_ma
      order by case cho_dung when 'O_KHACH' then 1 when 'TRONG_KHO' then 2
                             when 'CHI_NHA_MANG' then 3 when 'TRA_NCC' then 4 else 5 end,
               ma`,
  );

export type ThuNgoaiKy = {
  ky: string;
  so_dong: string;
  so_hop_dong: string;
  tien: string;
  la_thu_truoc: boolean;
  co_trong_bang: boolean;
};

/** Tiền đã thu cho kỳ ngoài khoảng tính cước — xem db/138. */
export const getThuNgoaiKy = () =>
  query<ThuNgoaiKy>(
    `select n.ky, n.so_dong::text, n.so_hop_dong::text, n.tien::text, n.la_thu_truoc,
            exists (select 1 from v_fixed_monthly_total t where t.ky = n.ky) as co_trong_bang
       from v_fixed_thu_ngoai_ky n order by n.ky`,
  );

export type ThueBaoNo = {
  subscription_id: string;
  trang_thai: string;
  goi: string | null;
  gia_thang: string | null;
  ngay_kich_hoat: string | null;
  ngay_ngung: string | null;
  khach: string;
  ma_khach: string | null;
  loai_khach: string | null;
  so_hd_doi: string;
  no: string;
  so_hd_bo: string;
  bo_thu: string;
  da_thu: string;
  qua_han_lau_nhat: string | null;
  so_may: string;
  link_cms: string | null;
};

/** Một dòng một thuê bao cầm tay, kèm nợ và tiền bỏ thu — xem db/139. */
export const getThueBaoNo = () =>
  query<ThueBaoNo>(
    `select subscription_id, trang_thai, goi, gia_thang::text,
            ngay_kich_hoat::text, ngay_ngung::text, khach, ma_khach, loai_khach,
            so_hd_doi::text, no::text, so_hd_bo::text, bo_thu::text, da_thu::text,
            qua_han_lau_nhat::text, so_may::text, link_cms
       from v_telecom_thue_bao_no
      order by no desc, bo_thu desc, subscription_id`,
  );

export type DotThu = {
  ky: string;
  so_ky: string;
  so_thue_bao: string;
  so_may: string;
  phai_thu: string;
  da_thu: string;
  dang_doi: string;
  bo_thu: string;
  huy_hd: string;
  ty_le_thu: string | null;
  ky_khach_le: string;
  ky_ctv: string;
  ky_dai_ly: string;
  ky_khong_ro: string;
  tien_khach_le: string;
  tien_ctv: string;
  tien_dai_ly: string;
  ky_tuong_lai: boolean;
  ky_mo_coi: string;
  tien_mo_coi: string;
  ky_tra_do: string;
};

/** Đợt thu cước từng tháng của wifi cầm tay — xem db/140. */
/**
 * Tiền đang đòi nhưng KHÔNG phải cước: máy, phí lắp, các khoản của đơn hàng.
 *
 * Màn Đợt thu cước chỉ đếm dòng cước, nên tổng "đang đòi" ở đó nhỏ hơn công
 * nợ thật. Không nói rõ thì người đọc tưởng đó là toàn bộ tiền phải đòi.
 */
export type BaoCaoNgay = {
  nhom: string;
  chi_so: string;
  don_vi: string;
  so_hom_nay: string;
  tien_hom_nay: string;
  so_hom_qua: string;
  tien_hom_qua: string;
  so_tb_7: string;
  tien_tb_7: string;
};

/** Chỉ số hôm nay đặt cạnh hôm qua và trung bình 7 ngày — xem db/181. */
export const getBaoCaoNgay = () =>
  query<BaoCaoNgay>(
    `select nhom, chi_so, don_vi, so_hom_nay::text, tien_hom_nay::text,
            so_hom_qua::text, tien_hom_qua::text, so_tb_7::text, tien_tb_7::text
       from v_bao_cao_ngay order by nhom, chi_so`,
  );

export type Ngay28 = {
  nhom: string;
  chi_so: string;
  don_vi: string;
  ngay: string;
  so_luong: string;
  tien: string;
  /** Tiền thật vào tài khoản — 0 với kênh cấn trừ cọc. */
  tien_that: string;
  /** Phần đã được kế toán duyệt; phần còn lại là tiền đã đếm mà chưa ai xác nhận. */
  tien_duyet: string;
};

/** 28 ngày gần nhất, một dòng cho mỗi (chỉ số, ngày) — xem db/210. */
export const getBaoCao28NgayCoDinh = () =>
  query<Ngay28>(
    `select nhom, chi_so, don_vi, ngay::text, so_luong::text, tien::text,
            tien_that::text, tien_duyet::text
       from v_bao_cao_ngay_fixed_28 order by nhom, thu_tu, chi_so, ngay`,
  );

/** Đơn lắp đã qua ngày hẹn mà chưa lắp xong — xem db/186. */
export const getLapDatQuaHan = async () => {
  const [row] = await query<{ don: string; hen_cu_nhat: string | null; trong_30_ngay: string }>(
    `select don::text, hen_cu_nhat::text, trong_30_ngay::text from v_lap_dat_qua_han`,
  );
  return row!;
};

export type DotThuNgay = {
  source_id: string;
  ma_hd: string | null;
  ky: string | null;
  tien: string;
  status: string | null;
  ngay_go: string | null;
  nguoi_go: string | null;
  note: string | null;
  url: string | null;
  ngay: string;
};

/** Từng đợt thu đằng sau một ô của bảng tiền theo ngày — xem db/187. */
export const getDotThuNgay = (kenh: string, ngay: string) =>
  query<DotThuNgay>(
    `select source_id, ma_hd, ky, tien::text, status, ngay_go::text, nguoi_go, note, url,
            ngay::text
       from v_fixed_dot_thu_ngay
      where kenh = $1 and ngay = $2::date
      order by tien desc, ma_hd`,
    [kenh, ngay],
  );

/** Công nợ cước wifi cố định, một dòng — xem db/189. */
export const getCongNoCoDinh = async () => {
  const [row] = await query<{ hop_dong: string; tien: string; ky: string }>(
    `select hop_dong::text, tien::text, ky::text from v_fixed_cong_no`,
  );
  return row!;
};

export type LapQuaHan = {
  source_id: string;
  ma_hd: string | null;
  dia_chi: string | null;
  ngay_hen: string;
  tre_ngay: string;
  nguoi_phu_trach: string | null;
  trang_thai_hop_dong: string | null;
  url: string | null;
};

/** Đơn lắp đã qua ngày hẹn mà chưa xong — xem db/189. */
export const getLapQuaHanDs = () =>
  query<LapQuaHan>(
    `select source_id, ma_hd, dia_chi, ngay_hen::text, tre_ngay::text,
            nguoi_phu_trach, trang_thai_hop_dong, url
       from v_fixed_lap_qua_han_ds order by tre_ngay desc, ma_hd`,
  );

export type HuyNgay = {
  subscription_id: string;
  ma_hd: string | null;
  dia_chi: string | null;
  ngay_ky: string | null;
  ngay_lap_xong: string | null;
  ly_do_huy: string | null;
  nhom_ly_do_huy: string | null;
  con_no: string | null;
  url: string | null;
};

/** Hợp đồng huỷ trong một ngày — xem db/189. */
export const getHuyNgay = (ngay: string) =>
  query<HuyNgay>(
    `select subscription_id, ma_hd, dia_chi, ngay_ky::text, ngay_lap_xong::text,
            ly_do_huy, nhom_ly_do_huy, con_no::text, url
       from v_fixed_huy_ngay where ngay = $1::date order by ma_hd`,
    [ngay],
  );

export type MayVe = {
  source_id: string; imei: string | null; so_phieu: string | null; ngay: string;
  kho: string | null; goi: string | null; ma_khach: string | null; khach: string | null;
  tinh_trang_may: string | null; ghi_chu: string | null;
};

/** Máy cầm tay khách cố định trả về kho, một tháng — xem db/214. */
export const getChoMuonMayVe = (ky: string) =>
  query<MayVe>(
    `select source_id, imei, so_phieu, ngay::text, kho, goi, ma_khach, khach,
            tinh_trang_may, ghi_chu
       from v_cho_muon_may_ve where ky = $1 order by ngay desc, imei`,
    [ky],
  );

export type CanTru = {
  source_id: string; ngay: string; ma_hd: string | null; ky_cuoc: string | null;
  tien: string; status: string | null; ngay_go: string | null;
  nguoi_go: string | null; url: string | null;
};

/** Đợt thu kênh "cần trừ cọc" bên cố định, một tháng — xem db/214. */
export const getChoMuonCanTru = (ky: string) =>
  query<CanTru>(
    `select source_id, ngay::text, ma_hd, ky_cuoc, tien::text, status,
            ngay_go::text, nguoi_go, url
       from v_cho_muon_can_tru where ky = $1 order by ngay desc, tien desc`,
    [ky],
  );

export type ChoMuon = {
  ky: string; may_tra_ve: string; dot_can_tru: string; tien_can_tru: string;
};

/** Cho khách cố định mượn máy cầm tay, theo tháng — xem db/213. */
export const getChoMuonThang = () =>
  query<ChoMuon>(
    `select ky, may_tra_ve::text, dot_can_tru::text, tien_can_tru::text
       from v_cho_muon_cam_tay order by ky desc limit 6`,
  );

/** Còn bao nhiêu máy đang nằm ở nhà khách cố định — xem db/213. */
export const getChoMuonDangGiu = async () => {
  const [row] = await query<{ dang_muon: string; da_tra: string; tat_ca: string }>(
    `select dang_muon::text, da_tra::text, tat_ca::text from v_cho_muon_dang_giu`,
  );
  return row!;
};

export type TelecomThangNay = {
  ngay_da_qua: string; ky: string;
  doanh_thu: string; doanh_thu_cung_ky: string;
  ngung: string; ngung_cung_ky: string; moi: string;
  may_thu_ve: string; may_thu_ve_cung_ky: string; may_giao_di: string;
  con_doi: string; hoa_don_dang_doi: string;
};

/** Bốn con số của tháng đang chạy, wifi cầm tay — xem db/212. */
export const getTelecomThangNay = async () => {
  const [row] = await query<TelecomThangNay>(
    `select ngay_da_qua::text, ky, doanh_thu::text, doanh_thu_cung_ky::text,
            ngung::text, ngung_cung_ky::text, moi::text,
            may_thu_ve::text, may_thu_ve_cung_ky::text, may_giao_di::text,
            con_doi::text, hoa_don_dang_doi::text
       from v_telecom_thang_nay`,
  );
  return row!;
};

export type TelecomTreo = {
  no_thue_bao: string; no_tien: string;
  treo_so: string; treo_tien: string; may_chua_tra: string;
};

/** Tiền và việc đang đứng lại bên cầm tay — xem db/212. */
export const getTelecomDangTreo = async () => {
  const [row] = await query<TelecomTreo>(
    `select no_thue_bao::text, no_tien::text, treo_so::text, treo_tien::text,
            may_chua_tra::text from v_telecom_dang_treo`,
  );
  return row!;
};

/** 28 ngày gần nhất của wifi cầm tay — xem db/212. */
export const getTelecom28Ngay = () =>
  query<Ngay28>(
    `select nhom, chi_so, don_vi, ngay::text, so_luong::text, tien::text,
            tien_that::text, tien_duyet::text
       from v_telecom_ngay_28 order by nhom, thu_tu, chi_so, ngay`,
  );

export type ThangNay = {
  ngay_da_qua: string; ky: string;
  doanh_thu: string; doanh_thu_cung_ky: string;
  huy: string; huy_cung_ky: string;
  ky_moi: string; tien_chua_thu: string; ky_chua_thu: string;
};

/** Bốn con số của tháng đang chạy, kèm cùng kỳ tháng trước — xem db/211. */
export const getThangNay = async () => {
  const [row] = await query<ThangNay>(
    `select ngay_da_qua::text, ky, doanh_thu::text, doanh_thu_cung_ky::text,
            huy::text, huy_cung_ky::text, ky_moi::text,
            tien_chua_thu::text, ky_chua_thu::text
       from v_fixed_thang_nay`,
  );
  return row!;
};

export type ChoXuLyGmo = {
  coc_so: string; coc_tien: string; coc_lau_nhat: string | null;
  gmo_so: string; gmo_tien: string; gmo_lau_nhat: string | null;
  gmo_cho_so: string; gmo_cho_tien: string;
  /** gmo_so = số hợp đồng, gmo_tien = nợ thật, gmo_lau_nhat = số lần hẹn hỏng. */
  gmo_con_no: string;
  /** Phiếu chờ mà chưa chọn sẵn tháng cước — phần nặng của đống việc. */
  coc_chua_thang: string;
  /** Số ngày duyệt trung bình của những phiếu đã xong, làm mốc so sánh. */
  coc_tb_ngay: string | null;
  chd_so: string; chd_cuoc: string; chd_khong_ly_do: string;
};

/** Tiền đang đứng lại trên đường từ combini về sổ cước — xem db/191. */
export const getChoXuLyGmo = async () => {
  const [row] = await query<ChoXuLyGmo>(
    `select
       (select count(*) from v_fixed_coc_cho_phan_bo)::text              as coc_so,
       (select coalesce(sum(tien), 0) from v_fixed_coc_cho_phan_bo)::text as coc_tien,
       (select max(cho_ngay) from v_fixed_coc_cho_phan_bo)::text          as coc_lau_nhat,
       (select hop_dong from v_fixed_gmo_het_han_tom_tat)::text            as gmo_so,
       (select no_that from v_fixed_gmo_het_han_tom_tat)::text             as gmo_tien,
       (select lan_hen_hong from v_fixed_gmo_het_han_tom_tat)::text        as gmo_lau_nhat,
       (select hop_dong_con_no from v_fixed_gmo_het_han_tom_tat)::text     as gmo_con_no,
       (select count(*) from v_fixed_gmo_lan
         where not da_tra and (han_tra is null or han_tra >= now()))::text as gmo_cho_so,
       (select coalesce(sum(tien), 0) from v_fixed_gmo_lan
         where not da_tra and (han_tra is null or han_tra >= now()))::text as gmo_cho_tien,
       (select count(*) from v_fixed_coc_cho_phan_bo where not co_san_thang)::text as coc_chua_thang,
       (select tb_ngay from v_fixed_coc_toc_do)::text                      as coc_tb_ngay,
       (select count(*) from v_fixed_chua_hoat_dong)::text                 as chd_so,
       (select coalesce(sum(cuoc_thang), 0) from v_fixed_chua_hoat_dong)::text as chd_cuoc,
       (select count(*) from v_fixed_chua_hoat_dong where ly_do is null)::text as chd_khong_ly_do`,
  );
  return row!;
};

export type CocChoPhanBo = {
  source_id: string; ma_hd: string | null; dia_chi: string | null;
  tien: string; ngay_tra: string | null; cho_ngay: string | null;
  channel: string | null; ghi_chu: string | null; con_no: string | null; url: string | null;
  /** Lúc tạo mã đã chọn sẵn tháng cước chưa — phiếu chưa chọn thì người duyệt
   *  phải tự tra, nặng hơn hẳn. */
  co_san_thang: boolean;
  nhom_tien: string;
};

/**
 * Phiếu cọc đã thu tiền mà chưa gán vào tháng cước — xem db/191.
 * `bac` lọc theo một nhóm tuổi chờ của bảng tóm tắt; bỏ trống là lấy tất cả.
 */
export const getCocChoPhanBo = (bac?: string, nhom?: string) => {
  const dieu: string[] = [];
  const tham: string[] = [];
  if (bac !== undefined) {
    tham.push(bac);
    dieu.push(`bac = $${tham.length}::int`);
  }
  if (nhom !== undefined) {
    tham.push(nhom);
    dieu.push(`nhom_tien = $${tham.length}`);
  }
  return query<CocChoPhanBo>(
    `select source_id, ma_hd, dia_chi, tien::text, ngay_tra::text, cho_ngay::text,
            channel, ghi_chu, con_no::text, url, co_san_thang, nhom_tien
       from v_fixed_coc_cho_phan_bo
      ${dieu.length === 0 ? "" : `where ${dieu.join(" and ")}`}
      order by cho_ngay desc nulls last, tien desc`,
    tham,
  );
};

export type GmoQuaHan = {
  lan: string; ma_hd: string | null; dia_chi: string | null;
  trang_thai_hop_dong: string | null; tien: string; loai_ten: string;
  ky_cuoc: string | null; ngay_tao: string | null; ngay_het_han: string | null;
  qua_han_ngay: string | null; con_no: string | null; url: string | null;
  da_tra_ma_khac: boolean; so_lan_hong: string;
};

/** Mã combini hết hạn mà khách không trả — xem db/191. */
export const getGmoQuaHan = () =>
  query<GmoQuaHan>(
    `select lan, ma_hd, dia_chi, trang_thai_hop_dong, tien::text, loai_ten, ky_cuoc,
            ngay_tao::text, ngay_het_han::text, qua_han_ngay::text, con_no::text, url,
            da_tra_ma_khac, so_lan_hong::text
       from v_fixed_gmo_qua_han
      order by (con_no > 0) desc, con_no desc nulls last, qua_han_ngay desc`,
  );

/** Nhóm cọc không ghi rõ: bao nhiêu cái có dấu hiệu TP Link — xem db/205. */
export const getGmoCocMo = async () => {
  const [row] = await query<{ lan: string; co_dau_hieu_tplink: string }>(
    `select lan::text, co_dau_hieu_tplink::text from v_fixed_gmo_coc_mo`,
  );
  return row!;
};

export type GmoThang = {
  thang: string;
  tao: string; da_tra: string; chet: string; dang_cho: string;
  tien_tra: string | null; tien_cho: string | null;
  /** Số HỢP ĐỒNG có mã hỏng, không phải tiền — xem db/202. */
  hop_dong_hong: string;
  ty_le_chet: string | null;
};

/** Mã combini theo tháng tạo — xem db/192. */
export const getGmoThang = () =>
  query<GmoThang>(
    `select thang, tao::text, da_tra::text, chet::text, dang_cho::text,
            tien_tra::text, tien_cho::text, hop_dong_hong::text, ty_le_chet::text
       from v_fixed_gmo_thang order by thang`,
  );

export type ChuaHoatDong = {
  subscription_id: string; ma_hd: string | null; dia_chi: string | null;
  cuoc_thang: string | null; ngay_lap_xong: string | null; sau_lap_ngay: string | null;
  ngay_bat_dau_thu: string | null; ly_do: string | null; nguoi_nhap: string | null;
  url: string | null;
};

/** Hợp đồng lắp xong mà chưa tới ngày bắt đầu thu — xem db/196. */
export const getChuaHoatDong = () =>
  query<ChuaHoatDong>(
    `select subscription_id, ma_hd, dia_chi, cuoc_thang::text, ngay_lap_xong::text,
            sau_lap_ngay::text, ngay_bat_dau_thu::text, ly_do, nguoi_nhap, url
       from v_fixed_chua_hoat_dong
      order by (ly_do is not null), sau_lap_ngay desc`,
  );

/** Địa chỉ một màn bên CMS, lấy từ app_setting — xem db/204. */
export const getLinkCms = async (key: string) => {
  const [row] = await query<{ value: string }>(
    `select value from app_setting where key = $1`,
    [key],
  );
  return row?.value ?? null;
};

export type CocLoai = {
  nhom_tien: string; ten: string; so_phieu: string; tien: string;
  phai_tu_tra: string; lau_nhat: string;
};

export type CocO = CocLoai & { bac: string; nhom: string };

/** Phiếu cọc chờ duyệt cắt theo cả tuổi chờ lẫn thứ đang thu — xem db/207. */
export const getCocChoDuyetO = () =>
  query<CocO>(
    `select bac::text, nhom, nhom_tien, ten, so_phieu::text, tien::text,
            phai_tu_tra::text, lau_nhat::text
       from v_fixed_coc_cho_duyet_o order by bac, nhom_tien`,
  );

export type GmoThangLoai = {
  thang: string; nhom_tien: string; ten: string;
  tao: string; da_tra: string; chet: string; dang_cho: string;
  hop_dong_hong: string; tien_tra: string | null; ty_le_chet: string | null;
};

/** Mã combini cắt theo cả tháng tạo lẫn thứ đang thu — xem db/207. */
export const getGmoThangLoai = () =>
  query<GmoThangLoai>(
    `select thang, nhom_tien, ten, tao::text, da_tra::text, chet::text,
            dang_cho::text, hop_dong_hong::text, tien_tra::text, ty_le_chet::text
       from v_fixed_gmo_thang_loai order by thang, nhom_tien`,
  );

export type CocNhom = {
  bac: string; nhom: string; so_phieu: string; tien: string;
  phai_tu_tra: string; lau_nhat: string;
};

/** Phiếu cọc chờ duyệt gom theo tuổi chờ — xem db/198. */
export const getCocChoDuyetNhom = () =>
  query<CocNhom>(
    `select bac::text, nhom, so_phieu::text, tien::text, phai_tu_tra::text, lau_nhat::text
       from v_fixed_coc_cho_duyet_nhom order by bac`,
  );

export type TongHop28 = {
  ngay: string;
  lan_dau: string;
  dang_ky_lai: string;
  tong_dang_ky: string;
  huy_truoc_lich: string;
  huy_sau_lich: string;
  huy_sau_lap: string;
  tong_huy: string;
  con_lai: string;
  co_lich_lap: string;
  chua_co_lich: string;
  lap_xong: string;
  co_lich_chua_lap: string;
  that_bai: string;
};

/** Báo cáo tổng hợp của CMS vỡ theo ngày, 28 ngày gần nhất — xem db/210. */
export const getTongHop28 = () =>
  query<TongHop28>(
    `select ngay::text, lan_dau::text, dang_ky_lai::text, tong_dang_ky::text,
            huy_truoc_lich::text, huy_sau_lich::text, huy_sau_lap::text, tong_huy::text,
            con_lai::text, co_lich_lap::text, chua_co_lich::text, lap_xong::text,
            co_lich_chua_lap::text, that_bai::text
       from v_bao_cao_tong_hop_28 order by ngay desc`,
  );

export type NgayFixed30 = {
  ngay: string;
  ky_moi: string;
  lap_xong: string;
  hoat_dong: string;
  huy: string;
};

/** Hợp đồng cố định theo từng ngày, 30 ngày gần nhất — xem db/183. */
export const getBaoCaoNgayCoDinh30 = () =>
  query<NgayFixed30>(
    `select ngay::text, ky_moi::text, lap_xong::text, hoat_dong::text, huy::text
       from v_bao_cao_ngay_fixed_30 order by ngay`,
  );

export const getDangDoiNgoaiCuoc = async () => {
  const [row] = await query<{ tien: string }>(
    `select round(
       (select coalesce(sum(con_lai), 0) from v_telecom_invoice_due where status = 'ISSUED')
       - (select coalesce(sum(dang_doi), 0) from v_telecom_dot_thu)
     )::text as tien`,
  );
  return row!.tien;
};

export const getDotThu = () =>
  query<DotThu>(
    `select ky, so_ky::text, so_thue_bao::text, so_may::text, phai_thu::text,
            da_thu::text, dang_doi::text, bo_thu::text, huy_hd::text,
            ty_le_thu::text, ky_khach_le::text, ky_ctv::text, ky_dai_ly::text,
            ky_khong_ro::text, tien_khach_le::text, tien_ctv::text,
            tien_dai_ly::text, ky_tuong_lai, ky_mo_coi::text, tien_mo_coi::text,
            ky_tra_do::text
       from v_telecom_dot_thu order by ky desc`,
  );

export type KyCuoc = {
  fee_line_id: string;
  ky: string;
  subscription_id: string;
  ma_thiet_bi: string | null;
  tien: string;
  so_hoa_don: string | null;
  trang_thai_hd: string | null;
  ngay_lap: string | null;
  han_tra: string | null;
  trang_thai_tb: string | null;
  goi: string | null;
  tb_da_xoa: boolean;
  tra_mot_phan: boolean;
  tien_da_nhan: string;
  khach: string;
  ma_khach: string | null;
  loai_khach: string | null;
  link_cms: string | null;
};

/** Từng kỳ cước của một tháng, cho ngăn kéo. */
export const getKyCuocThang = (ky: string) =>
  query<KyCuoc>(
    `select fee_line_id, ky, subscription_id, ma_thiet_bi, tien::text, so_hoa_don,
            trang_thai_hd, ngay_lap::text, han_tra::text, trang_thai_tb, goi,
            tb_da_xoa, tra_mot_phan, tien_da_nhan::text,
            khach, ma_khach, loai_khach, link_cms
       from v_telecom_ky_cuoc
      where ky = $1
        -- Thuê bao đã xoá ở nguồn, và kỳ đã lập lại hoá đơn, thì không tính vào
        -- đâu cả — kể cả danh sách.
        and not tb_da_xoa
        and not bi_thay_the
      order by case trang_thai_hd when 'UNPAYABLE' then 1 when 'ISSUED' then 2 else 3 end,
               tien desc, subscription_id`,
    [ky],
  );

export type ThuChuaCanTru = {
  payment_id: string;
  khach: string;
  ma_khach: string | null;
  loai_khach: string | null;
  amount: string;
  channel: string | null;
  reference: string | null;
  paid_at: string;
  thang: string;
  so_ngay_treo: string;
  ly_do: string;
  link_cms: string | null;
};

/** Lượt thu cầm tay chưa gán được vào hoá đơn nào — xem db/146, db/147. */
export const getThuChuaCanTru = () =>
  query<ThuChuaCanTru>(
    `select payment_id, khach, ma_khach, loai_khach, amount::text, channel,
            reference, paid_at::text, thang, so_ngay_treo::text, ly_do, link_cms
       from v_telecom_thu_chua_can_tru
      order by so_ngay_treo desc, amount desc`,
  );

export type DotThuCoDinh = {
  source_id: string;
  ky: string;
  thang_tien_ve: string;
  ngay_thu: string | null;
  tai_khoan: string;
  so_tien: string;
  ma_hd: string | null;
  dia_chi: string | null;
  cuoc_thang: string | null;
  trang_thai_hop_dong: string | null;
  trang_thai_dot: string | null;
  trang_thai_phieu: string | null;
  phieu_da_xoa: boolean;
  vao_bao_cao_cuoc: boolean;
  vao_bao_cao_tai_khoan: boolean;
  ly_do_ngoai_tai_khoan: string | null;
  ly_do_ngoai_cuoc: string | null;
  tien_bi_cap: string;
  cho_duyet: boolean;
  can_tru_coc: boolean;
};

/**
 * Đợt thu cước cố định trong một khoảng tháng, lấy theo CẢ HAI trục rồi mới lọc
 * ở màn hình: kỳ cước nằm trong khoảng, HOẶC tiền về nằm trong khoảng. Một truy
 * vấn cho mọi góc nhìn vì phần lớn dòng thuộc cả hai — xem db/153.
 *
 * `tu` để rỗng nghĩa là không chặn đầu dưới (xem từ đầu đến hết `den`).
 */
export const getDotThuCoDinh = (tu: string, den: string) =>
  query<DotThuCoDinh>(
    `select source_id, ky, thang_tien_ve, ngay_thu::text, tai_khoan, so_tien::text,
            ma_hd, dia_chi, cuoc_thang::text, trang_thai_hop_dong,
            trang_thai_dot, trang_thai_phieu, phieu_da_xoa, vao_bao_cao_cuoc,
            vao_bao_cao_tai_khoan, ly_do_ngoai_tai_khoan, ly_do_ngoai_cuoc,
            tien_bi_cap::text, cho_duyet, can_tru_coc
       from v_fixed_dot_thu
      where (ky >= coalesce(nullif($1, ''), ky) and ky <= $2)
         or (thang_tien_ve >= coalesce(nullif($1, ''), thang_tien_ve)
             and thang_tien_ve <= $2)
      order by ky, ngay_thu nulls last, ma_hd`,
    [tu, den],
  );

/**
 * Lúc đồng bộ gần nhất của sổ thu cố định. Màn hình phải ghi mốc này: số ở đây
 * so với CMS chỉ khớp nếu cùng thời điểm, mà bên đó nhân viên vẫn đang nhập.
 */
export const getDotThuChotLuc = () =>
  query<{ chot_luc: string | null }>(
    `select max(synced_at)::text as chot_luc from fixed_fee_installment where source = 'FIXED'`,
  );

/** Các tháng có số liệu, mới nhất trước — để dựng nút chọn tháng. */
export const getThangCoSoLieu = () =>
  query<{ thang: string }>(
    `select distinct ky as thang from v_fixed_dot_thu
      union select distinct thang_tien_ve from v_fixed_dot_thu
      order by 1 desc`,
  );

export type ViecHomNay = {
  he: string;
  viec: string;
  id: string;
  ma: string | null;
  ai: string | null;
  tuoi_ngay: number;
  tien: string | null;
  nguoi: string | null;
  url: string | null;
};

/**
 * Hàng đợi việc phải làm, đã quá ngưỡng chờ — xem db/216.
 *
 * Lấy hết một lần rồi cắt ở màn hình: hơn hai nghìn dòng nhưng chia sáu hàng
 * đợi, mỗi hàng chỉ hiện vài chục cái già nhất. Tách thành truy vấn tóm tắt
 * cộng truy vấn chi tiết thì nhanh hơn không đáng kể mà thêm một chỗ để lệch.
 */
export const getViecHomNay = () =>
  query<ViecHomNay>(
    `select he, viec, id, ma, ai, tuoi_ngay::int, tien::text, nguoi, url
       from v_viec_hom_nay
      order by tuoi_ngay desc, ma`,
  );

export type TramVanHanh = {
  he: string;
  ma: string;
  ton: number;
  tuoi_tb: number | null;
  gia_nhat: number | null;
  /** Bao nhiêu việc đã nằm quá 90 ngày — dùng cái này, không dùng gia_nhat. */
  qua_lau: number | null;
  tien: string | null;
  /** Rỗng nghĩa là nguồn không ghi mốc hoàn thành, KHÔNG phải guồng đứng im. */
  ra_moi_tuan: number | null;
};

/** Bản đồ trạm: việc đang nằm ở đâu và trạm đó thoát nhanh hay chậm — db/217. */
export const getTramVanHanh = () =>
  query<TramVanHanh>(
    `select he, ma, ton::int, tuoi_tb::int, gia_nhat::int, qua_lau::int,
            tien::text, ra_moi_tuan::int
       from v_tram_van_hanh`,
  );

export type TramChiTiet = {
  he: string;
  tram: string;
  id: string;
  ma: string | null;
  ai: string | null;
  /** Nghĩa khác nhau tuỳ trạm — xem `cot_tuoi` ở TRAM_VAN_HANH. */
  tuoi_ngay: number | null;
  tien: string | null;
  nguoi: string | null;
  url: string | null;
};

/**
 * Từng việc đang nằm ở một trạm — db/218. Bảng trạm gom từ chính view này nên
 * số dòng ở đây luôn bằng cột "đang nằm" trên bản đồ.
 *
 * CHO_HEN đo ngày CÒN LẠI tới hẹn nên xếp tăng dần (sắp tới hẹn lên đầu); các
 * trạm khác đo đã chờ bao lâu nên xếp giảm dần (già nhất lên đầu).
 */
export const getTramChiTiet = (tram: string) =>
  query<TramChiTiet>(
    `select he, tram, id, ma, ai, tuoi_ngay::int, tien::text, nguoi, url
       from v_tram_chi_tiet
      where tram = $1
      order by case when $1 = 'CHO_HEN' then tuoi_ngay end asc nulls last,
               case when $1 <> 'CHO_HEN' then tuoi_ngay end desc nulls last,
               ma
      limit 300`,
    [tram],
  );

/**
 * Doanh thu cầm tay theo tháng của MỘT năm.
 *
 * Khác getTelecomMonths ở chỗ không chặn 12 tháng gần nhất — màn Tiền cho chọn
 * năm cũ, mà chặn thì bảng tháng trống trong khi bảng dịch vụ vẫn có số, nhìn
 * như mất dữ liệu.
 */
export const getTelecomMonthsNam = (nam: string) =>
  query<TelecomMonth>(
    `select ky, so_hoa_don::text, so_thue_bao::text, phai_thu::text, da_thu::text,
            con_doi::text, mat_trang::text, hoa_don_dang_doi::text,
            hoa_don_mat::text, ty_le_thu::text
       from v_telecom_month where ky like $1 || '-%' order by ky desc`,
    [nam],
  );
