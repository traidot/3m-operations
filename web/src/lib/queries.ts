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
            times_reported, so_ngay_ton, nhom
       from finding_digest`,
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
