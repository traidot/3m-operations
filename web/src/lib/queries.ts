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

  return { sql: dieu.length > 0 ? `where ${dieu.join(" and ")}` : "", params };
}

export const getContracts = (f: ContractFilter) => {
  const { sql, params } = contractWhere(f);
  const offset = Math.max(0, ((f.trang ?? 1) - 1) * CONTRACTS_PER_PAGE);
  return query<Contract>(
    `select subscription_id, contract_code, dia_chi, trang_thai_hop_dong,
            trang_thai_lap_dat, goi_cuoc, cuoc_thang::text,
            fee_start_on::text, ngay_ky::text, ngay_lap_xong::text,
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
  thang_bat_dau: number | null;
  thang_ket_thuc: number | null;
  cac_ky: string[];
};

/** Trạng thái 12 kỳ của năm hiện tại, chỉ lấy cho đúng trang đang xem. */
export const getYearStatus = async (ids: string[]) => {
  if (ids.length === 0) return new Map<string, YearStatus>();
  const rows = await query<YearStatus>(
    `select subscription_id, nam, thang_bat_dau, thang_ket_thuc, cac_ky
       from v_fixed_year_status where subscription_id = any($1)`,
    [ids],
  );
  return new Map(rows.map((r) => [r.subscription_id, r]));
};
