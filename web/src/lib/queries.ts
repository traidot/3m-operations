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

export type Loan = {
  id: string;
  device_imei: string;
  install_ref: string | null;
  issued_on: string;
  due_on: string;
  returned_on: string | null;
  note: string | null;
  entered_by: string;
  ngay_qua_han: number;
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

export const getLoans = () =>
  query<Loan>(
    `select l.id::text, l.device_imei, l.install_ref,
            l.issued_on::text, l.due_on::text, l.returned_on::text,
            l.note, l.entered_by,
            greatest(current_date - l.due_on, 0) as ngay_qua_han
       from loan_record l
      order by (l.returned_on is not null), l.due_on`,
  );

export type MonthlyBilling = {
  ky: string;
  so_hop_dong: string;
  phai_thu: string;
  tien_mien_phi: string | null;
  da_thu: string;
  con_thieu: string | null;
  ty_le_thu: string | null;
};

export type MonthlyByStatus = MonthlyBilling & { trang_thai: string };

export type Coverage = {
  hop_dong_dang_chay: string;
  thieu_gia_cuoc: string;
  thieu_ngay_bat_dau: string;
  tinh_duoc: string;
  ty_le_tinh_duoc: string | null;
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
                      da_thu::text, con_thieu::text, ty_le_thu::text`;

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
            tinh_duoc::text, ty_le_tinh_duoc::text from v_fixed_billing_coverage`,
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
};

export type ContractFilter = {
  q?: string;
  hopDong?: string;
  lapDat?: string;
  cuoc?: string;
  canhBao?: string;
  ky?: string;
  kyTrangThai?: string;
  thangKy?: string;
  thangHuy?: string;
  lyDoHuy?: string;
  trang?: number;
};

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
    `select subscription_id, contract_code, dia_chi, trang_thai_hop_dong,
            trang_thai_lap_dat, goi_cuoc, cuoc_thang::text,
            fee_start_on::text, ngay_ky::text, ngay_lap_xong::text,
            ngay_huy::text, ly_do_huy, nhom_ly_do_huy, kho_doi,
            so_ky::text, so_ky_mien_phi::text, so_ky_no::text,
            tong_da_thu::text, con_no::text, ky_da_thu_gan_nhat,
            ky_cho_duyet::text, ky_ghi_chu::text, ky_ngoai::text,
            tinh_trang_cuoc, canh_bao
       from v_fixed_contract ${sql}
      order by so_ky_no desc, contract_code
      limit ${CONTRACTS_PER_PAGE} offset ${offset}`,
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
    `select subscription_id, contract_code, dia_chi, trang_thai_hop_dong,
            trang_thai_lap_dat, goi_cuoc, cuoc_thang::text,
            fee_start_on::text, ngay_ky::text, ngay_lap_xong::text,
            ngay_huy::text, ly_do_huy, nhom_ly_do_huy, kho_doi,
            so_ky::text, so_ky_mien_phi::text, so_ky_no::text,
            tong_da_thu::text, con_no::text, ky_da_thu_gan_nhat,
            ky_cho_duyet::text, ky_ghi_chu::text, ky_ngoai::text,
            tinh_trang_cuoc, canh_bao
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
};

export const getContractPeriods = (id: string) =>
  query<ContractPeriod>(
    `select ky, phai_thu::text, trang_thai, ngoai_ky_tinh, tien::text,
            thu_luc::text, kenh, nguoi_nhap
       from v_fixed_contract_period where subscription_id = $1 order by ky`,
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
export const getMonthStats = () =>
  query<MonthStat>(
    `select ky, ky_moi::text, lap_xong::text, huy::text, luy_ke_chua_huy::text,
            so_ky::text, ky_da_thu::text, ky_mien_phi::text, ky_cho_duyet::text,
            ky_ghi_chu::text, ky_chua_thu::text, hop_dong_kho_doi::text,
            tien_phai_thu::text,
            tien_da_thu::text, tien_chua_thu::text, ty_le_ky_xong::text
       from v_fixed_month where ky >= ${TU} order by ky`,
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
       may_chua_tra::text, ngay_khong_co_cuoc::text, canh_bao`;

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
};

export const getTelecomInvoices = (id: string) =>
  query<TelecomInvoice>(
    `select invoice_id, so_hoa_don, ngay_lap::text, han_tra::text, ky_tu::text,
            ky_den::text, tien::text, da_tra::text, con_lai::text, trang_thai, kenh_thu
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
  con_no: string;
  no_qua_han: string;
  tien_mat: string;
  thieu_hoa_don: string;
  may_chua_tra: string;
};

export const getTelecomTotals = async () => {
  const [row] = await query<TelecomTotals>(
    `select count(distinct party_id)::text                          as khach,
            count(*)::text                                          as thue_bao,
            count(*) filter (where trang_thai = 'ACTIVE')::text     as dang_chay,
            round(sum(con_no))::text                                as con_no,
            round(sum(con_no) filter (where 'NO_QUA_HAN' = any(canh_bao)))::text as no_qua_han,
            round(sum(tien_mat))::text                              as tien_mat,
            count(*) filter (where 'THIEU_HOA_DON' = any(canh_bao))::text as thieu_hoa_don,
            sum(may_chua_tra)::text                                 as may_chua_tra
       from v_telecom_subscription`,
  );
  return row!;
};

export type TelecomCustomer = {
  party_id: string;
  khach: string;
  dien_thoai: string | null;
  loai_khach: string | null;
  loai_khach_chu: string;
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
};

export type CustomerFilter = {
  q?: string;
  dichVu?: string;
  canhBao?: string;
  nhieuTb?: string;
  loai?: string;
  trang?: number;
};

const COT_KHACH = `party_id::text, khach, dien_thoai, loai_khach, loai_khach_chu,
       nhom_khach, so_thue_bao::text,
       dang_chay::text, dich_vu, da_thu::text, con_no::text, tien_mat::text,
       may_chua_tra::text, ngay_qua_han::text, ky_gan_nhat_den::text, canh_bao`;

function customerWhere(f: CustomerFilter): { sql: string; params: unknown[] } {
  const dieu: string[] = [];
  const params: unknown[] = [];

  if (f.q?.trim()) {
    params.push(`%${f.q.trim()}%`);
    dieu.push(`(khach ilike $${params.length} or dien_thoai ilike $${params.length})`);
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
};

export const getCustomerSubs = (id: string) =>
  query<CustomerSub>(
    `select subscription_id, service_type, goi, trang_thai, gia_thang::text,
            ngay_kich_hoat::text, ngay_ngung::text, ma_may, so_hoa_don::text,
            da_thu::text, con_no::text, tien_mat::text, ky_gan_nhat_den::text, canh_bao
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
