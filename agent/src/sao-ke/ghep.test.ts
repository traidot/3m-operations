import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ghep, type Dot, type GiaoDich } from "./ghep.js";

const gd = (id: number, tien: number, ngay: string | null, ma_hd: string | null = null,
            tai_khoan = "GMO"): GiaoDich => ({ id, tien_vao: tien, ngay, ma_hd, tai_khoan });

const dot = (source_id: string, so_tien: number, ngay_thu: string | null,
             ma_hd: string | null = null, tai_khoan = "GMO"): Dot =>
  ({ source_id, so_tien, ngay_thu, ma_hd, tai_khoan });

test("một giao dịch chỉ ghép được với một đợt, không rải cho nhiều kỳ", () => {
  // Arrange: một khoản 1.100 và ba kỳ cùng hợp đồng cùng số tiền.
  const gds = [gd(1, 1100, "2026-03-02", "HD000001")];
  const dots = [
    dot("k10", 1100, "2026-03-03", "HD000001"),
    dot("k11", 1100, "2026-03-04", "HD000001"),
    dot("k12", 1100, "2026-03-05", "HD000001"),
  ];

  // Act
  const kq = ghep(gds, dots);

  // Assert
  assert.equal(kq.cap.length, 1);
  assert.equal(kq.cap[0]!.khoan.dot[0]!.source_id, "k10"); // sát ngày nhất
  assert.equal(kq.dot_le.length, 2);
  assert.equal(kq.gd_le.length, 0);
});

test("một đợt chỉ nhận một giao dịch", () => {
  const gds = [gd(1, 2000, "2026-03-02", "HD000002"), gd(2, 2000, "2026-03-02", "HD000002")];
  const dots = [dot("d1", 2000, "2026-03-02", "HD000002")];

  const kq = ghep(gds, dots);

  assert.equal(kq.cap.length, 1);
  assert.equal(kq.gd_le.length, 1);
});

test("bậc 1 giữ chỗ trước, bậc sau không cướp được đợt đã ghép", () => {
  // gd 1 cùng tài khoản và sát ngày, gd 2 khác tài khoản — gd 1 phải thắng.
  const gds = [gd(1, 3000, "2026-03-02", "HD000003", "GMO"),
               gd(2, 3000, "2026-03-02", "HD000003", "Youcho Arai")];
  const dots = [dot("d1", 3000, "2026-03-02", "HD000003", "GMO")];

  const kq = ghep(gds, dots);

  assert.equal(kq.cap.length, 1);
  assert.equal(kq.cap[0]!.gd.id, 1);
  assert.equal(kq.cap[0]!.bac, 1);
});

test("quá hạn lệch ngày của bậc 4 thì không ghép giao dịch không có mã", () => {
  const gds = [gd(1, 4000, "2026-03-01")];
  const dots = [dot("d1", 4000, "2026-03-20")];

  const kq = ghep(gds, dots);

  assert.equal(kq.cap.length, 0);
  assert.equal(kq.gd_le.length, 1);
  assert.equal(kq.dot_le.length, 1);
});

test("khác số tiền thì không bao giờ ghép", () => {
  const kq = ghep([gd(1, 5000, "2026-03-01", "HD000004")],
                  [dot("d1", 4999, "2026-03-01", "HD000004")]);

  assert.equal(kq.cap.length, 0);
});

test("thiếu ngày một bên vẫn ghép được ở bậc 3 nhờ mã hợp đồng", () => {
  const kq = ghep([gd(1, 6000, null, "HD000005")],
                  [dot("d1", 6000, "2026-03-01", "HD000005")]);

  assert.equal(kq.cap.length, 1);
  assert.equal(kq.cap[0]!.bac, 3);
});

test("khách đóng gộp: một giao dịch ghép cả lần thu nhiều kỳ", () => {
  // Arrange: một khoản 6.000 và ba kỳ 2.000 cùng hợp đồng, cùng ngày thu.
  const gds = [gd(1, 6000, "2026-01-22", "HD000506")];
  const dots = [
    dot("k1", 2000, "2026-01-22", "HD000506"),
    dot("k2", 2000, "2026-01-22", "HD000506"),
    dot("k3", 2000, "2026-01-22", "HD000506"),
  ];

  // Act
  const kq = ghep(gds, dots);

  // Assert
  assert.equal(kq.cap.length, 1);
  assert.equal(kq.cap[0]!.khoan.dot.length, 3);
  assert.equal(kq.cap[0]!.khoan.so_tien, 6000);
  assert.equal(kq.dot_le.length, 0);
});

test("nộp lẻ từng kỳ thì vẫn ghép từng đợt một, không gom nhầm", () => {
  const gds = [gd(1, 2000, "2026-01-22", "HD000507"), gd(2, 2000, "2026-01-22", "HD000507")];
  const dots = [
    dot("k1", 2000, "2026-01-22", "HD000507"),
    dot("k2", 2000, "2026-01-22", "HD000507"),
  ];

  const kq = ghep(gds, dots);

  assert.equal(kq.cap.length, 2);
  assert.ok(kq.cap.every((c) => c.khoan.dot.length === 1));
  assert.equal(kq.dot_le.length, 0);
});

test("đợt đã nằm trong lần thu gộp thì không bị ghép lại lần nữa", () => {
  // GD 6.000 ăn cả ba kỳ; GD 2.000 đến sau không còn đợt nào để lấy.
  const gds = [gd(1, 6000, "2026-01-22", "HD000508"), gd(2, 2000, "2026-01-22", "HD000508")];
  const dots = [
    dot("k1", 2000, "2026-01-22", "HD000508"),
    dot("k2", 2000, "2026-01-22", "HD000508"),
    dot("k3", 2000, "2026-01-22", "HD000508"),
  ];

  const kq = ghep(gds, dots);

  assert.equal(kq.cap.length, 1);
  assert.equal(kq.cap[0]!.gd.id, 1);
  assert.equal(kq.gd_le.length, 1);
  assert.equal(kq.dot_le.length, 0);
});

test("khác ngày thu thì không gom thành một lần nộp", () => {
  const gds = [gd(1, 4000, "2026-01-22", "HD000509")];
  const dots = [
    dot("k1", 2000, "2026-01-22", "HD000509"),
    dot("k2", 2000, "2026-02-22", "HD000509"),
  ];

  const kq = ghep(gds, dots);

  assert.equal(kq.cap.length, 0);
  assert.equal(kq.dot_le.length, 2);
});
