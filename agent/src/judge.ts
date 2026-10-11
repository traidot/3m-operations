import OpenAI from "openai";
import { z } from "zod";
import type { Digest, Finding } from "./collect.js";
import type { WeeklyDigest } from "./weekly.js";

const VerdictSchema = z.object({
  severity: z.enum(["CRITICAL", "WARN", "INFO"]),
  title: z.string(),
  evidence: z.string(),
  so_sanh: z.string().nullable(),
  action: z.string().nullable(),
  finding_id: z.string().nullable(),
  metabase_url: z.string().nullable(),
});

const JudgementSchema = z.object({
  mo_dau: z.string(),
  phan_quyet: z.array(VerdictSchema),
});

export type Judgement = z.infer<typeof JudgementSchema>;

const CHUNG = `Bạn là lớp phán của hệ thống giám sát vận hành công ty 3M — đại lý viễn thông
bán lại wifi cầm tay, sim data, WiMAX, sim Softbank và internet cố định.

Bạn KHÔNG tính số. Mọi con số đã do SQL tính sẵn và nằm trong dữ liệu đầu vào.
Nhiệm vụ của bạn là xếp thứ tự, diễn giải, và nói việc cần làm.

Luật:
1. Được phép trả về mảng phan_quyet rỗng. Hôm nay không có gì thì nói không có gì.
   Tuyệt đối không bịa việc để lấp chỗ trống.
2. Mỗi phán quyết phải có số cụ thể trích từ evidence. Cấm câu chung chung
   kiểu "công nợ đang tăng" đứng một mình.
3. Chỉ dùng con số có trong đầu vào. Không tự cộng trừ ra số mới.
4. Việc đã nhắc từ ba lần trở lên (nhom = nhac_lai_nhieu_lan) thì nêu rõ đã
   nhắc bao nhiêu lần và tồn bao nhiêu ngày — nhắc mãi không ai làm là một
   vấn đề khác với vấn đề ban đầu.
5. Không suy đoán nguyên nhân nếu không có dữ liệu chống lưng. Được phép nói
   chưa rõ vì sao và đề xuất cần xem thêm gì.
6. Không xếp hạng hay nhận xét về cá nhân. Nêu bản ghi và bộ phận.
7. Nếu du_lieu_cu là true thì phán quyết đầu tiên phải là về việc đồng bộ,
   và mo_dau phải nói rõ mọi số phía dưới dựa trên dữ liệu cũ.

Viết tiếng Việt, gọn, không mở bài không kết bài.
mo_dau là một câu nêu mốc dữ liệu và tình hình chung.`;

const HANG_TUAN = `${CHUNG}

Đây là báo cáo tuần, không phải bản tin sáng. Nói xu hướng chứ đừng nói việc
vặt hằng ngày: cái gì đang tốt lên, cái gì đang xấu đi, so với tuần trước và
trung bình bốn tuần.

Thêm luật cho báo cáo tuần:
8. Chỉ số nào không có mốc so sánh (tuần trước hoặc trung bình bằng null) thì
   nói rõ là chưa đủ dữ liệu để kết luận, đừng phán trên một điểm duy nhất.
9. Hai chỉ số đáng chú ý nhất: collection_rate — bán được mà không thu được
   thì doanh thu chỉ là con số trên giấy; và device_earning_rate — trần doanh
   thu nhánh thiết bị nằm ở đó, không nằm ở số khách.
10. Chênh lệch dưới năm phần trăm giữa hai tuần thường là nhiễu, đừng gọi
   thành xu hướng.`;

/**
 * Khuôn kết quả, viết bằng JSON Schema.
 *
 * Khai tay vì phải gửi nguyên văn cho máy chủ. Chế độ strict đòi mọi khoá đều
 * nằm trong required và không cho thêm khoá lạ, nên khoá có thể trống được
 * khai là kiểu ["string", "null"] chứ không phải bỏ khỏi required. Zod vẫn giữ
 * để kiểm lần cuối: khuôn này chỉ ràng buộc lúc sinh, không đảm bảo kết quả.
 */
const KHUON = {
  type: "object",
  additionalProperties: false,
  required: ["mo_dau", "phan_quyet"],
  properties: {
    mo_dau: { type: "string" },
    phan_quyet: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "severity",
          "title",
          "evidence",
          "so_sanh",
          "action",
          "finding_id",
          "metabase_url",
        ],
        properties: {
          severity: { type: "string", enum: ["CRITICAL", "WARN", "INFO"] },
          title: { type: "string" },
          evidence: { type: "string" },
          so_sanh: { type: ["string", "null"] },
          action: { type: ["string", "null"] },
          finding_id: { type: ["string", "null"] },
          metabase_url: { type: ["string", "null"] },
        },
      },
    },
  },
} as const;

/** Mặc định khi .env.local chỉ khai khoá mà không khai máy chủ và mô hình. */
const BASE_URL_MAC_DINH = "https://generativelanguage.googleapis.com/v1beta/openai";
const MODEL_MAC_DINH = "gemini-2.5-flash-lite";

/** Bản tin dài nhất đo được khoảng 4k token; phần dư để mô hình suy nghĩ. */
const MAX_TOKEN = 32000;

/**
 * Số việc mỗi luật được gửi kèm.
 *
 * Phần lớn luật đã gộp sẵn thành một dòng, nhưng R_PARTY_STALE đẩy ra một dòng
 * cho mỗi khách — hơn 1.300 dòng, tức hơn 140k token đầu vào, và mô hình sẽ
 * viết một phán quyết cho từng dòng cho đến khi vỡ hạn mức. Chỉ gửi vài dòng
 * làm mẫu rồi nói tổng số bằng lời; bản tin vẫn dựng từ đủ findings.
 */
const MOI_LUAT_TOI_DA = 5;

type RutGon = { rule_key: string; tong_so: number; gui_kem: number };

/** Gửi mẫu thay vì gửi hết, kèm tổng số để mô hình không phán theo số dòng. */
function rutGonFindings(findings: Finding[]): {
  findings: Finding[];
  da_rut_gon: RutGon[];
} {
  const theoLuat = new Map<string, Finding[]>();
  for (const f of findings) {
    const ds = theoLuat.get(f.rule_key);
    if (ds) ds.push(f);
    else theoLuat.set(f.rule_key, [f]);
  }

  const giu: Finding[] = [];
  const da_rut_gon: RutGon[] = [];
  for (const [rule_key, ds] of theoLuat) {
    // Tồn lâu nhất lên trước: nếu chỉ được xem vài dòng thì xem dòng tệ nhất.
    const xep = [...ds].sort((a, b) => Number(b.so_ngay_ton) - Number(a.so_ngay_ton));
    giu.push(...xep.slice(0, MOI_LUAT_TOI_DA));
    if (ds.length > MOI_LUAT_TOI_DA) {
      da_rut_gon.push({ rule_key, tong_so: ds.length, gui_kem: MOI_LUAT_TOI_DA });
    }
  }
  return { findings: giu, da_rut_gon };
}

/** Thiếu khoá thì nói thẳng tên biến, đừng để SDK ném lỗi khó hiểu. */
function layKhoa(): string {
  const k = process.env.LLM_API_KEY;
  if (!k) {
    throw new Error(
      "Chưa đặt LLM_API_KEY trong .env.local — lớp diễn giải cần khoá này",
    );
  }
  return k;
}

/** Dựng phần dữ liệu gửi cho mô hình, rút gọn findings nếu có luật quá dài. */
function moTa(digest: Digest | WeeklyDigest, kind: "hang_ngay" | "hang_tuan"): string {
  const moc = kind === "hang_tuan" ? `tuần bắt đầu ${digest.ngay}` : `ngày ${digest.ngay}`;
  const co_findings = "findings" in digest;
  const { findings, da_rut_gon } = co_findings
    ? rutGonFindings(digest.findings)
    : { findings: [], da_rut_gon: [] as RutGon[] };
  const than = co_findings ? { ...digest, findings } : digest;

  const ghi_chu = da_rut_gon.length
    ? "\n\nMảng findings đã rút gọn: " +
      da_rut_gon
        .map((r) => `${r.rule_key} thực có ${r.tong_so} việc, chỉ gửi kèm ${r.gui_kem} việc tồn lâu nhất`)
        .join("; ") +
      ".\nVới những luật này phải nói theo tổng số thực có, không nói theo số dòng gửi kèm, " +
      "và chỉ ra một phán quyết cho cả luật chứ không phán từng dòng."
    : "";

  return `Dữ liệu ${moc}:\n\n\`\`\`json\n${JSON.stringify(than, null, 2)}\n\`\`\`${ghi_chu}`;
}

export async function judge(
  digest: Digest | WeeklyDigest,
  kind: "hang_ngay" | "hang_tuan" = "hang_ngay",
): Promise<Judgement> {
  const ai = new OpenAI({
    apiKey: layKhoa(),
    baseURL: process.env.LLM_BASE_URL ?? BASE_URL_MAC_DINH,
  });

  const res = await ai.chat.completions.create({
    model: process.env.LLM_MODEL ?? MODEL_MAC_DINH,
    max_completion_tokens: MAX_TOKEN,
    response_format: {
      type: "json_schema",
      json_schema: { name: "phan_quyet", strict: true, schema: KHUON },
    },
    messages: [
      { role: "system", content: kind === "hang_tuan" ? HANG_TUAN : CHUNG },
      { role: "user", content: moTa(digest, kind) },
    ],
  });

  const lua = res.choices[0];
  const text = lua?.message.content;
  if (!text) {
    throw new Error("Mô hình không trả về nội dung nào");
  }
  // Hết hạn mức token thì JSON đứt giữa dòng. Nói thẳng, đừng để lỗi hiện ra
  // dưới dạng "JSON không hợp lệ" rồi phải đi đoán.
  if (lua?.finish_reason === "length") {
    throw new Error(
      `Mô hình bị cắt vì hết hạn mức token (đã dùng ${res.usage?.completion_tokens ?? "?"}). ` +
        "Nâng MAX_TOKEN trong judge.ts hoặc chọn mô hình khác.",
    );
  }

  // Dựng JSON rồi mới kiểm bằng Zod: response_format ràng buộc lúc sinh nhưng
  // không đảm bảo, nên vẫn phải xác nhận trước khi đẩy vào bản tin.
  let tho: unknown;
  try {
    tho = JSON.parse(text);
  } catch {
    throw new Error(`Kết quả không phải JSON hợp lệ: ${text.slice(0, 200)}`);
  }
  const kq = JudgementSchema.safeParse(tho);
  if (!kq.success) {
    throw new Error(`Kết quả sai khuôn: ${kq.error.issues[0]?.message ?? "không rõ"}`);
  }
  return kq.data;
}
