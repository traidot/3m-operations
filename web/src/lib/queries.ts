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
  contract_code: string;
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
    `select contract_code, so_ky, so_ky_mien_phi, so_ky_no,
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
