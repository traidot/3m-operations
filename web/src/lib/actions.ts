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

const LoanInput = z.object({
  device_imei: z
    .string()
    .trim()
    .regex(/^[0-9]{14,16}$/, "IMEI phải là 14 đến 16 chữ số"),
  install_ref: z.string().trim().max(100).nullish(),
  issued_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày giao không hợp lệ"),
  due_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Hạn thu hồi không hợp lệ"),
  note: z.string().trim().max(500).nullish(),
});

export async function createLoan(formData: FormData) {
  const input = LoanInput.parse({
    device_imei: formData.get("device_imei"),
    install_ref: formData.get("install_ref") || null,
    issued_on: formData.get("issued_on"),
    due_on: formData.get("due_on"),
    note: formData.get("note") || null,
  });

  if (input.due_on < input.issued_on) {
    throw new Error("Hạn thu hồi không được trước ngày giao");
  }

  await query(
    `insert into loan_record (device_imei, install_ref, issued_on, due_on, note, entered_by)
     values ($1, $2, $3::date, $4::date, $5, $6)`,
    [input.device_imei, input.install_ref, input.issued_on, input.due_on, input.note, who(formData)],
  );
  revalidatePath("/may-muon");
}

export async function returnLoan(formData: FormData) {
  const id = Uuid.parse(formData.get("id"));
  await query(
    "update loan_record set returned_on = current_date where id = $1 and returned_on is null",
    [id],
  );
  revalidatePath("/may-muon");
}

/** Ai thao tác. Basic auth chỉ có một tài khoản dùng chung nên tạm ghi vậy. */
function who(formData: FormData): string {
  const raw = formData.get("by");
  const name = typeof raw === "string" ? raw.trim() : "";
  return name || "khong-ro";
}
