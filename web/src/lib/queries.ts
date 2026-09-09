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
