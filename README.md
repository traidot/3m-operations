# 3M — lớp giám sát

Đọc dữ liệu từ hai hệ thống đang chạy (telecom và wifi cố định), gộp vào một
Postgres riêng, rồi ra bản tin. Không ghi ngược về hệ thống nguồn.

Ba tầng, ranh giới rõ:

| Tầng | Việc | Ai làm |
|---|---|---|
| View SQL | Tính mọi con số | `db/003_views.sql` |
| Quy tắc | Phát hiện vượt ngưỡng, sinh phán quyết | `db/004_rules.sql` |
| Agent | Xếp thứ tự, diễn giải, nói việc cần làm | `agent/` |

Metabase cắm thẳng vào cùng bộ view. Biểu đồ và bản tin luôn khớp nhau vì
cả hai đọc chung một nguồn.

## Dựng

```bash
for f in db/0*.sql; do psql -v ON_ERROR_STOP=1 "$WAREHOUSE_URL" -f "$f"; done
```

| File | Nội dung |
|---|---|
| `001_warehouse.sql` | Kho đích, `sync_run`, `threshold` |
| `002_finding.sql` | Trí nhớ lớp phán |
| `003_views.sql` | Bộ view — nguồn sự thật chung cho Metabase và agent |
| `004_rules.sql` | Quy tắc sinh phán quyết, chụp số cuối ngày |
| `005_sources.sql` | Nối fdw tới hai database nguồn + hợp đồng ánh xạ |
| `006_sync.sql` | Máy đồng bộ, chuẩn hoá số điện thoại |
| `007_party_matching.sql` | Gộp hồ sơ khách, hàng đợi duyệt trùng |
| `008_weekly.sql` | Đơn lắp đặt, chỉ số tuần, `weekly_report()` |
| `009_marketing.sql` | Số liệu quảng cáo, số dẫn xuất, đối chiếu mức 1 |
| `010_ads_monitoring.sql` | Số quảng cáo vào ảnh chụp ngày, cảnh báo sheet chậm |

Rồi đặt ngưỡng — giá trị khởi tạo là phỏng đoán:

```sql
update threshold set value = ... where key = 'ar_suspend_amount';
update app_setting set value = 'https://metabase.noi-bo' where key = 'metabase_base_url';
```

`ar_suspend_amount` đang là 0, nghĩa là chưa đặt, và quy tắc nợ vượt ngưỡng
tự im lặng cho tới khi có giá trị thật.

## Test

```bash
./db/test/run.sh
```

```bash
cd agent && npm test
```

Dựng một database tạm, chạy toàn bộ migration, kiểm 12 hành vi rồi xoá.
Không đụng database thật, không cần khoá API. Chạy trước mỗi lần sửa SQL.

## Chạy

```bash
cd agent && npm install
```

```bash
npm run digest
```

Chạy tay giữa ngày, hoặc chỉ xem số không gọi mô hình:

```bash
npm run digest -- --manual
```

```bash
npm run digest -- --numbers-only
```

Báo cáo tuần — mặc định là tuần vừa kết thúc, hoặc chỉ định thứ hai đầu tuần:

```bash
npm run weekly
```

```bash
npm run weekly -- 2026-08-31
```

Có khoá chống chạy chồng: bấm chạy tay lúc job đêm đang chạy thì bị từ chối
chứ không chạy song song. Chạy lại nhiều lần trong ngày không nhân đôi dữ liệu.

## Giao diện

Ba màn hình cần thao tác — thứ Metabase không làm được vì nó chỉ đọc.
Biểu đồ vẫn để Metabase, không dựng lại ở đây.

```bash
cd web && npm install && npm run dev
```

| Trang | Việc |
|---|---|
| `/` | Bản tin: phán quyết đang mở, đánh dấu đã tiếp nhận / đã xử lý / bỏ qua |
| `/duyet-trung` | Hàng đợi trùng khách, gộp hoặc bác từng cặp |
| `/may-muon` | Nhập phiếu mượn máy pocket, đánh dấu đã nhận lại |

Bảo vệ bằng basic auth một tài khoản dùng chung (`MONITOR_USER`,
`MONITOR_PASSWORD`). Đủ cho mạng nội bộ, **không đủ để đưa ra internet** —
không có phiên, không ghi được ai làm gì, không khoá sau nhiều lần sai.
Đưa ra ngoài thì phải thay bằng đăng nhập thật.

Schema là SQL thuần với view và plpgsql nên phần này dùng `pg` trực tiếp,
không dùng Prisma — Prisma introspect được bảng nhưng không quản view và function.

## Còn thiếu

**Tầng đồng bộ.** Chưa viết vì chưa có lược đồ hai database nguồn. Cần biết
tên bảng và cột của phần khách hàng, thuê bao, hoá đơn, thanh toán, và ba
câu hỏi này:

- Bảng lớn có cột thời gian tạo và cập nhật không? Không có thì mất hẳn nhóm
  chỉ số nhập kịp, và mọi cột `created_at_src` trong kho sẽ để null.
- Bản ghi có bị xoá cứng không? Có thì đồng bộ tăng dần sẽ giữ lại rác.
- Có bản sao chỉ đọc chưa, hay phải query thẳng database đang phục vụ khách?

Bên nhận đã sẵn: máy đồng bộ chỉ đọc năm view ánh xạ mô tả ở cuối
`db/005_sources.sql`, không biết gì về bảng gốc. Đổi lược đồ bên nguồn chỉ
phải sửa năm view đó.

**Màn hình duyệt trùng khách.** Quy tắc khớp và hàm `merge_parties` /
`reject_merge` đã có, chạy được bằng SQL. Chưa có giao diện — chỉ cần khi
hàng đợi `v_merge_candidate` đủ dài để bấm tay không xuể.

**Ticket hỗ trợ.** Chỉ số thứ chín của báo cáo tuần (ticket tồn đọng) cần một
bảng `ticket_snapshot` và view ánh xạ thứ bảy. Chưa thêm vì chưa rõ hai hệ
thống có quản ticket không.

**Marketing.** Kéo tự động toàn bộ tab của cả hai sheet mỗi ngày:

```bash
cd agent && npm run ads:sync
```

Hai cách xác thực, đặt cái nào thì dùng cái đó.

**Tài khoản của chính mình** — dùng khi sheet đã được share cho mình, không
phải nhờ ai share thêm. Tạo OAuth client loại Desktop app ở Google Cloud
Console, thêm `http://localhost:8757` vào Authorized redirect URIs, rồi:

```bash
cd agent && npm run google:auth
```

Script mở một cổng tạm nhận mã Google trả về và in ra refresh token để chép
vào `agent/.env`. Nó không tự ghi vào file nào.

Đánh đổi: quyền `spreadsheets.readonly` đọc được mọi sheet tài khoản đó thấy,
không riêng hai file này. Và token gắn với một người — người đó mất quyền
truy cập thì job dừng.

**Tài khoản dịch vụ** — bền hơn, không gắn với ai, nhưng phải nhờ chủ sheet
chia sẻ cho email của nó. Đặt `GOOGLE_SA_EMAIL` và `GOOGLE_SA_PRIVATE_KEY`.

Tab nào có chữ "tháng" kèm số thì đọc, còn lại bỏ qua — nên tên tab hai file
khác nhau vẫn chạy được. Năm suy từ số tháng: tháng đã qua là năm nay, tháng
còn ở phía trước là năm ngoái.

Nhập tay từ CSV vẫn dùng được khi cần vá dữ liệu cũ:

```bash
npm run ads -- --owner dinh_viet --year 2026 --tab "Tháng 1" thang1.csv
```

Chỉ nhập năm số gốc: chi phí, tiếp cận, click, mess, đơn hàng. Giá click, CTR,
giá mess, chi phí trên đơn đều tính lại bằng SQL — trong sheet mấy hàng đó dùng
dấu phẩy thập phân nên xuất ra là vỡ cột.
