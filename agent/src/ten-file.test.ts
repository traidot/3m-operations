import { strict as assert } from "node:assert";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { banKeTiep } from "./ten-file.js";

const thuMuc = (ten: string[]) => {
  const d = mkdtempSync(join(tmpdir(), "ten-file-"));
  for (const t of ten) writeFileSync(join(d, t), "");
  return d;
};

test("thư mục rỗng thì bắt đầu từ v1", () => {
  const d = thuMuc([]);

  assert.equal(banKeTiep(d, "bao-cao"), `${d}/bao-cao-v1.xlsx`);
});

test("lấy số lớn nhất cộng một, không lấp chỗ trống", () => {
  // Arrange: v1–v7 đã bị dọn, chỉ còn v8 và v9.
  const d = thuMuc(["bao-cao-v8.xlsx", "bao-cao-v9.xlsx"]);

  // Act
  const ra = banKeTiep(d, "bao-cao");

  // Assert
  assert.equal(ra, `${d}/bao-cao-v10.xlsx`);
});

test("không đếm nhầm file của báo cáo khác có tên dài hơn", () => {
  const d = thuMuc(["bao-cao-v2.xlsx", "bao-cao-tu-2026-01-01-v9.xlsx"]);

  assert.equal(banKeTiep(d, "bao-cao"), `${d}/bao-cao-v3.xlsx`);
});

test("bỏ qua file khoá tạm của Excel", () => {
  const d = thuMuc(["bao-cao-v4.xlsx", "~$bao-cao-v9.xlsx"]);

  assert.equal(banKeTiep(d, "bao-cao"), `${d}/bao-cao-v5.xlsx`);
});
