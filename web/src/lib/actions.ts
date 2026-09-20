"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { query } from "./db";

const Uuid = z.string().uuid("Mã không hợp lệ");

const FindingStatus = z.enum(["ACKNOWLEDGED", "RESOLVED", "IGNORED"]);

export async function setFindingStatus(formData: FormData) {
  const id = Uuid.parse(formData.get("id"));
  const status = FindingStatus.parse(formData.get("status"));
  const note = z.string().max(500).nullish().parse(formData.get("note") || null);

  await query(
    `update finding
        set status = $2,
            note = coalesce($3, note),
            resolved_on = case when $2 in ('RESOLVED','IGNORED')
                               then current_date else resolved_on end,
            updated_at = now()
      where id = $1`,
    [id, status, note],
  );
  revalidatePath("/");
}

/** Gỡ đánh dấu bỏ qua. Lượt chạy quy tắc sau tự quyết mở lại hay không. */
export async function unignoreFinding(formData: FormData) {
  const id = Uuid.parse(formData.get("id"));
  await query("select unignore_finding($1::uuid)", [id]);
  revalidatePath("/");
}

export async function mergeParties(formData: FormData) {
  const keep = Uuid.parse(formData.get("keep"));
  const drop = Uuid.parse(formData.get("drop"));
  const by = who(formData);

  if (keep === drop) throw new Error("Không gộp một hồ sơ vào chính nó");

  await query("select merge_parties($1::uuid, $2::uuid, $3)", [keep, drop, by]);
  revalidatePath("/duyet-trung");
}

export async function rejectMerge(formData: FormData) {
  const a = Uuid.parse(formData.get("a"));
  const b = Uuid.parse(formData.get("b"));

  await query("select reject_merge($1::uuid, $2::uuid, $3)", [a, b, who(formData)]);
  revalidatePath("/duyet-trung");
}

/** Ai thao tác. Basic auth chỉ có một tài khoản dùng chung nên tạm ghi vậy. */
function who(formData: FormData): string {
  const raw = formData.get("by");
  const name = typeof raw === "string" ? raw.trim() : "";
  return name || "khong-ro";
}
