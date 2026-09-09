# Lớp phán — hợp đồng làm việc của agent

Agent **không tính số**. Số do view SQL tính, agent đọc và phán.

## Ranh giới

| Việc | Ai làm |
|---|---|
| Tính công nợ, tiền thu, hoá đơn thiếu | View SQL |
| Phát hiện vượt ngưỡng, sinh `finding` | SQL, qua `upsert_finding()` |
| Vẽ biểu đồ | Metabase, đọc cùng bộ view |
| Xếp thứ tự việc, viết bản tin, diễn giải | Agent |
| Điều tra khi thấy số lạ | Agent, được viết SQL tự do — **phải in kèm câu SQL vào kết quả** |
| Ghi vào hệ thống vận hành, nhắn cho khách, khoá dịch vụ | Không ai — người quyết |

Số xuất hiện trong bản tin phải trích từ `finding.evidence` hoặc từ view có tên.
Agent tuyệt đối không được tự tính lại một con số tiền rồi đưa vào bản tin.

## Đầu vào mỗi lượt chạy

1. `sync_run` — mốc dữ liệu của từng nguồn. Nếu nguồn nào quá hạn, đó là
   phán quyết CRITICAL đầu tiên và mọi phán quyết khác phải ghi rõ là dựa trên dữ liệu cũ.
2. `finding_digest` — việc đang mở, kèm nhóm `moi` / `dang_ton` / `nhac_lai_nhieu_lan`.
3. Các view số liệu, mỗi view kèm mốc so sánh: tuần trước và trung bình bốn tuần.
4. `threshold` — ngưỡng do người đặt, không do agent tự chọn.

## Đầu ra

Hai phần tách bạch:

**Phần số** — bảng do SQL sinh, agent chép nguyên, không diễn giải lại con số.
Chạy hai lần trên cùng dữ liệu phải ra y hệt.

**Phần nhận định** — mảng phán quyết, mỗi phán quyết:

```json
{
  "severity": "CRITICAL | WARN | INFO",
  "title": "một câu nêu chuyện gì",
  "evidence": "số liệu chứng minh, trích từ finding.evidence",
  "so_sanh": "so với tuần trước hoặc trung bình 4 tuần",
  "action": "việc cần làm, hoặc null",
  "metabase_url": "link xem sâu",
  "finding_id": "uuid"
}
```

## Luật viết

1. **Được phép trả về mảng rỗng.** Hôm nay không có gì thì nói không có gì.
   Không bao giờ bịa việc để lấp chỗ trống.
2. **Mỗi phán quyết phải có số.** Cấm câu kiểu "công nợ đang tăng" đứng một mình.
   Phải là "8,94tr, tăng 12% so với trung bình 4 tuần, ba khách chiếm 60%".
3. **Việc đã nhắc từ ba lần trở lên** thì nêu riêng thành nhóm, kèm số ngày tồn.
   Nhắc mãi mà không ai làm là một vấn đề khác với vấn đề ban đầu.
4. **Không suy đoán nguyên nhân** nếu không có dữ liệu chống lưng. Được phép nói
   "chưa rõ vì sao" và đề xuất truy vấn để tìm hiểu.
5. **Không xếp hạng người.** Nêu bản ghi và bộ phận, đừng kết luận về cá nhân.
6. Mốc dữ liệu luôn nằm ở dòng đầu bản tin.

## Chạy

- Theo lịch: sau khi đồng bộ xong, không chạy song song với đồng bộ.
- Chạy tay: cùng một lệnh, có khoá chống chạy chồng, chạy lại nhiều lần không hỏng.
- Mỗi lượt ghi lại đầu vào và đầu ra để đối chiếu khi phán sai.
