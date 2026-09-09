import { q } from "./db.js";

/**
 * Gom đầu vào cho lớp phán. Mọi con số ở đây do SQL tính.
 * Agent không được tính lại bất kỳ số nào trong này.
 */

export type Freshness = {
  source: string;
  table_name: string;
  lan_dong_bo_cuoi: Date | null;
  gio_ke_tu_lan_cuoi: string | null;
  nguong_gio: string;
};

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

export type MetricPoint = {
  metric_key: string;
  dimension: string | null;
  hom_nay: string | null;
  tuan_truoc: string | null;
  trung_binh_4_tuan: string | null;
};

export type Digest = {
  ngay: string;
  freshness: Freshness[];
  du_lieu_cu: boolean;
  findings: Finding[];
  metrics: MetricPoint[];
  ty_le_thu: { tuan: string; phai_thu: string; thuc_thu: string; ty_le_thu: string | null }[];
};

export async function collect(today: string): Promise<Digest> {
  const freshness = await q<Freshness>("select * from v_sync_freshness order by source, table_name");

  const du_lieu_cu = freshness.some(
    (f) =>
      f.lan_dong_bo_cuoi === null ||
      Number(f.gio_ke_tu_lan_cuoi) > Number(f.nguong_gio),
  );

  const findings = await q<Finding>(
    `select id, rule_key, severity, title, evidence, action, metabase_url,
            times_reported, so_ngay_ton, nhom
       from finding_digest`,
  );

  // Số hôm nay đặt cạnh mốc so sánh. Không có mốc thì agent không phán được
  // là tốt hay xấu, chỉ đọc lại con số bằng lời.
  const metrics = await q<MetricPoint>(
    `select
       m.metric_key,
       m.dimension,
       max(m.value) filter (where m.metric_date = $1::date)                as hom_nay,
       max(m.value) filter (where m.metric_date = $1::date - 7)            as tuan_truoc,
       round(avg(m.value) filter (
         where m.metric_date between $1::date - 27 and $1::date), 2)       as trung_binh_4_tuan
     from daily_metric m
     where m.metric_date >= $1::date - 27
     group by m.metric_key, m.dimension
     order by m.metric_key, m.dimension nulls first`,
    [today],
  );

  const ty_le_thu = await q<Digest["ty_le_thu"][number]>(
    `select tuan::text, phai_thu::text, thuc_thu::text, ty_le_thu::text
       from v_collection_rate_weekly
      where tuan >= $1::date - 28
      order by tuan desc`,
    [today],
  );

  return { ngay: today, freshness, du_lieu_cu, findings, metrics, ty_le_thu };
}
