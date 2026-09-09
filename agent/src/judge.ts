import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Digest } from "./collect.js";

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

const SYSTEM = `Bạn là lớp phán của hệ thống giám sát vận hành công ty 3M — đại lý viễn thông
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

export async function judge(digest: Digest): Promise<Judgement> {
  const client = new Anthropic();

  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content:
          `Dữ liệu ngày ${digest.ngay}:\n\n` +
          "```json\n" +
          JSON.stringify(digest, null, 2) +
          "\n```",
      },
    ],
    output_config: { format: zodOutputFormat(JudgementSchema) },
  });

  if (response.stop_reason === "refusal") {
    throw new Error(
      `Mô hình từ chối trả lời: ${response.stop_details?.explanation ?? "không rõ lý do"}`,
    );
  }
  if (!response.parsed_output) {
    throw new Error("Không đọc được kết quả có cấu trúc từ mô hình");
  }
  return response.parsed_output;
}
