import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAdsTab, parseNumber } from "./parse.js";
import { guessYear, monthFromTab } from "./sheets.js";

// Rút gọn từ lưới ô thật: cột 0 là tên sản phẩm chỉ có ở dòng đầu mỗi khối,
// cột 1 luôn là tên chỉ số, cột 2 là TỔNG cả tháng, cột 3 trở đi là từng ngày.
// Hàng tỉ lệ dùng dấu phẩy thập phân nên bị bỏ qua.
const CSV = [
  ",Tổng FA,TỔNG,1/7,2/7,3/7",
  ",Chi phí,62.627.722,3.435.283,2.429.393,2.894.901",
  ",Tiếp cận,390.729,8.348,14.300,27.854",
  ",Click,7.423,194,341,501",
  ",Giá Click,8.437,17.708,7.124,5.778",
  ",CTR,1,90%,2,32%,2,38%",
  ",Mess,766,50,32,36",
  ",Đơn hàng,150,7,4,7",
  ",Chi phí/đơn hàng,417.518 ₫,490.755 ₫,607.348 ₫,413.557 ₫",
  "U20,Chi phí,19.895.602,791.466,683.761,692.964",
  ",Tiếp cận,54.788,546,2.342,4.928",
  ",Click,1.385,26,94,123",
  ",Mess,272,16,10,13",
  ",Đơn hàng,55,1,1,1",
  "Wimax,Chi phí,936.252,936.252,0,0",
  ",Mess,47,0,3,11",
].join("\n");

test("bỏ dấu chấm phân cách nghìn", () => {
  assert.equal(parseNumber("5.159.377"), 5159377);
  assert.equal(parseNumber("0"), 0);
});

test("ô rỗng ra null chứ không ra 0", () => {
  assert.equal(parseNumber(""), null);
  assert.equal(parseNumber(undefined), null);
});

test("đọc được khối Tổng FA — khối này không có tên ở cột 0", () => {
  const rows = parseAdsTab(CSV, 2026);
  const r = rows.find((x) => x.metric_date === "2026-07-02" && x.product === "TONG");
  assert.ok(r, "phải có dòng ngày 2/7 cho TONG");
  assert.equal(r.spend, 2429393);
  assert.equal(r.reach, 14300);
  assert.equal(r.clicks, 341);
  assert.equal(r.messages, 32);
  assert.equal(r.orders, 4);
});

test("dòng sau trong khối vẫn thuộc sản phẩm của dòng đầu", () => {
  const rows = parseAdsTab(CSV, 2026);
  const u20 = rows.find((x) => x.metric_date === "2026-07-01" && x.product === "POCKET_WIFI");
  assert.ok(u20, "phải có dòng U20");
  assert.equal(u20.spend, 791466);
  assert.equal(u20.reach, 546, "Tiếp cận nằm ở dòng không có tên sản phẩm");
  assert.equal(u20.clicks, 26);
  assert.equal(u20.messages, 16);

  const wimax = rows.find((x) => x.metric_date === "2026-07-03" && x.product === "WIMAX");
  assert.ok(wimax, "phải có dòng Wimax");
  assert.equal(wimax.messages, 11);
});

test("hàng tỉ lệ vỡ cột bị bỏ qua, không làm lệch số khác", () => {
  const rows = parseAdsTab(CSV, 2026);
  // CTR, Giá Click, Chi phí trên đơn không nằm trong bộ chỉ số gốc nên không
  // sinh dòng nào, và không được ghi đè lên chi phí hay click.
  const r = rows.find((x) => x.metric_date === "2026-07-01" && x.product === "TONG");
  assert.equal(r?.clicks, 194);
  assert.equal(r?.spend, 3435283);
});

test("cột TỔNG không bị nhầm thành một ngày", () => {
  const rows = parseAdsTab(CSV, 2026);
  const ngay = [...new Set(rows.map((r) => r.metric_date))].sort();
  assert.deepEqual(ngay, ["2026-07-01", "2026-07-02", "2026-07-03"]);
});

test("đoán năm cho tab báo cáo tháng", () => {
  const thang9 = new Date("2026-09-10");
  // Tháng đã qua hoặc đang chạy là năm nay.
  assert.equal(guessYear(1, thang9), 2026);
  assert.equal(guessYear(9, thang9), 2026);
  // Tháng còn ở phía trước là của năm ngoái.
  assert.equal(guessYear(12, thang9), 2025);
  // Đọc báo cáo tháng 12 vào đầu tháng 1 vẫn ra đúng năm cũ.
  assert.equal(guessYear(12, new Date("2027-01-05")), 2026);
});

test("chỉ nhận tab tổng hợp, bỏ tab riêng từng người", () => {
  // Ba kiểu đặt tên tab tổng có thật trong hai sheet.
  assert.equal(monthFromTab("Báo cao tổng tháng 1"), 1);
  assert.equal(monthFromTab("Báo cáo tổng tháng 9"), 9);
  assert.equal(monthFromTab(" BC_Tổng Tháng 12"), 12);

  // Tab riêng từng người: gộp vào là đếm trùng với tab tổng.
  assert.equal(monthFromTab("BC_Tháng 9_Việt Hoàng"), null);
  assert.equal(monthFromTab("Bc_Tháng 10_Ánh"), null);
  assert.equal(monthFromTab("BC_ Tháng 4_Diệu Anh"), null);

  // Tab tháng nhưng không phải bản tổng.
  assert.equal(monthFromTab("BC_Tháng 4"), null);
  assert.equal(monthFromTab("BC_Tháng 7 Quads"), null);
  assert.equal(monthFromTab("Bc_Tuần_Tháng 8"), null);

  // Không phải báo cáo tháng.
  assert.equal(monthFromTab("FANPAGE 3M"), null);
  assert.equal(monthFromTab("BC ĐƠN THÁNG 1 và 2"), null);
  assert.equal(monthFromTab("Tổng tháng 13"), null);
});

test("chịu được viết hoa và khoảng trắng thừa", () => {
  assert.equal(monthFromTab("TỔNG THÁNG 9"), 9);
  assert.equal(monthFromTab("  Báo cáo tổng tháng 8  "), 8);
});
