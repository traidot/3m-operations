import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAdsTab, parseNumber } from "./parse.js";
import { guessYear, monthFromTab } from "./sheets.js";

// Rút gọn từ cấu trúc thật của hai sheet: hàng tiêu đề có cột TỔNG rồi tới
// từng ngày; khối sản phẩm có thêm cột tên ở đầu nên lệch sang phải một ô;
// hàng tỉ lệ bị vỡ vì dấu phẩy thập phân.
const CSV = [
  "Tổng FA,TỔNG,27/1,28/1,29/1",
  "Chi phí,5.159.377,375.817,1.075.636,788.497",
  "Tiếp cận,27.709,1.751,5.120,3.813",
  "Click,896,76,261,191",
  "Giá Click,5.758,4.945,4.121,4.128",
  "CTR,3,23%,4,34%,5,10%",
  "Mess,71,1,8,14",
  "Đơn hàng,2,1,0,0",
  "U20,Chi phí,971.008,0,168.923,190.383",
  "Tiếp cận,10.653,0,513,887",
  "Click,179,0,58,54",
  "Mess,8,0,2,2",
  "Wimax,Chi phí,1.898.562,74.913,439.816,335.000",
  "Mess,47,0,3,11",
].join("\n");

test("bỏ dấu chấm phân cách nghìn", () => {
  assert.equal(parseNumber("5.159.377"), 5159377);
  assert.equal(parseNumber("0"), 0);
});

test("ô rỗng ra null chứ không ra 0", () => {
  assert.equal(parseNumber(""), null);
  assert.equal(parseNumber(undefined), null);
});

test("đọc đúng số của khối đầu tiên", () => {
  const rows = parseAdsTab(CSV, 2026);
  const r = rows.find((x) => x.metric_date === "2026-01-28" && x.product === "TONG");
  assert.ok(r, "phải có dòng ngày 28/1 cho TONG");
  assert.equal(r.spend, 1075636);
  assert.equal(r.reach, 5120);
  assert.equal(r.clicks, 261);
  assert.equal(r.messages, 8);
  assert.equal(r.orders, 0);
});

test("khối sản phẩm lệch một cột vẫn đọc đúng", () => {
  const rows = parseAdsTab(CSV, 2026);
  const u20 = rows.find((x) => x.metric_date === "2026-01-28" && x.product === "POCKET_WIFI");
  assert.ok(u20, "phải có dòng U20");
  assert.equal(u20.spend, 168923);
  assert.equal(u20.reach, 513);
  assert.equal(u20.clicks, 58);

  const wimax = rows.find((x) => x.metric_date === "2026-01-29" && x.product === "WIMAX");
  assert.ok(wimax, "phải có dòng Wimax");
  assert.equal(wimax.spend, 335000);
  assert.equal(wimax.messages, 11);
});

test("hàng tỉ lệ vỡ cột bị bỏ qua, không làm lệch số khác", () => {
  const rows = parseAdsTab(CSV, 2026);
  // CTR và Giá Click không nằm trong bộ chỉ số gốc nên không sinh dòng nào,
  // và cũng không được ghi đè lên chi phí hay click.
  const r = rows.find((x) => x.metric_date === "2026-01-27" && x.product === "TONG");
  assert.equal(r?.clicks, 76);
  assert.equal(r?.spend, 375817);
});

test("cột TỔNG không bị nhầm thành một ngày", () => {
  const rows = parseAdsTab(CSV, 2026);
  const ngay = [...new Set(rows.map((r) => r.metric_date))];
  assert.deepEqual(ngay, ["2026-01-27", "2026-01-28", "2026-01-29"]);
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

test("nhận ra tab báo cáo tháng, bỏ qua tab khác", () => {
  assert.equal(monthFromTab("Báo cao tổng tháng 1"), 1);
  assert.equal(monthFromTab("BC_Tháng 4"), 4);
  assert.equal(monthFromTab("FANPAGE 3M"), null);
  assert.equal(monthFromTab("báo cáo cuối tuần"), null);
  assert.equal(monthFromTab("Tháng 13"), null);
});

test("nhận đúng tab báo cáo tổng tháng của cả hai file", () => {
  assert.equal(monthFromTab("Báo cáo Tổng tháng 1"), 1);
  assert.equal(monthFromTab("Báo cao tổng tháng 1"), 1);
  assert.equal(monthFromTab("BC_Tháng 4"), 4);
  assert.equal(monthFromTab("Báo cáo Tổng tháng 12"), 12);
  assert.equal(monthFromTab("TỔNG THÁNG 9"), 9);
});
