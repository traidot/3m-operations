import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";
import type { Digest } from "./collect.js";
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
 * Khuôn kết quả mô tả theo kiểu của Gemini.
 *
 * Phải khai tay vì SDK Gemini không nhận thẳng schema Zod như SDK cũ. Zod vẫn
 * giữ lại để kiểm lần cuối: khuôn dưới đây chỉ ràng buộc lúc sinh, còn việc
 * mô hình trả đúng kiểu hay không thì phải tự xác nhận.
 */
const KHUON = {
  type: Type.OBJECT,
  required: ["mo_dau", "phan_quyet"],
  properties: {
    mo_dau: { type: Type.STRING },
    phan_quyet: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["severity", "title", "evidence"],
        properties: {
          severity: { type: Type.STRING, enum: ["CRITICAL", "WARN", "INFO"] },
          title: { type: Type.STRING },
          evidence: { type: Type.STRING },
          so_sanh: { type: Type.STRING, nullable: true },
          action: { type: Type.STRING, nullable: true },
          finding_id: { type: Type.STRING, nullable: true },
          metabase_url: { type: Type.STRING, nullable: true },
        },
      },
    },
  },
} as const;

/** Thiếu khoá thì nói thẳng tên biến, đừng để SDK ném lỗi khó hiểu. */
function layKhoa(): string {
  const k = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!k) {
    throw new Error(
      "Chưa đặt GEMINI_API_KEY trong .env.local — lớp diễn giải cần khoá này",
    );
  }
  return k;
}

export async function judge(
  digest: Digest | WeeklyDigest,
  kind: "hang_ngay" | "hang_tuan" = "hang_ngay",
): Promise<Judgement> {
  const ai = new GoogleGenAI({ apiKey: layKhoa() });

  const res = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL ?? "gemini-2.5-pro",
    contents:
      `Dữ liệu ${kind === "hang_tuan" ? `tuần bắt đầu ${digest.ngay}` : `ngày ${digest.ngay}`}:\n\n` +
      "```json\n" +
      JSON.stringify(digest, null, 2) +
      "\n```",
    config: {
      systemInstruction: kind === "hang_tuan" ? HANG_TUAN : CHUNG,
      responseMimeType: "application/json",
      responseSchema: KHUON,
      maxOutputTokens: 16000,
    },
  });

  const text = res.text;
  if (!text) {
    throw new Error("Mô hình không trả về nội dung nào");
  }

  // Dựng JSON rồi mới kiểm bằng Zod: responseSchema ràng buộc lúc sinh nhưng
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
