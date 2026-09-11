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
| `011_fixed_wifi.sql` | Công nợ suy ra theo hợp đồng, chuẩn hoá địa chỉ |
| `012_staff.sql` | Nhân sự, độ trễ nhập tiền theo tên |
| `013_fix_missing_invoice.sql` | Chỉ kiểm hoá đơn ở nguồn có hoá đơn; nợ theo số kỳ |
| `014_monthly_billing.sql` | Bảng cước theo tháng, cắt theo trạng thái hợp đồng |
| `015_fee_periods.sql` | Sổ kỳ cước; tháng miễn phí không tính là nợ |
| `016_finding_lifecycle.sql` | Một vấn đề một dòng suốt đời, gỡ được bỏ qua |
| `017_fix_unallocated.sql` | Bỏ cảnh báo tiền chưa cấn ở nguồn không có hoá đơn |
| `018_funnel.sql` | Phễu quảng cáo → hợp đồng → thu cước theo tháng |
| `019_ads_cancelled.sql` | Đơn huỷ, thống kê lắp đặt, phát hiện tab đè nhau |
| `020_split_business.sql` | Tách phễu wifi và eSIM |
| `021_contract_link.sql` | Liên kết sang màn hình hợp đồng bên hệ thống nguồn |

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
| `/wifi` | Phễu và số liệu mảng wifi cố định, wifi cầm tay (có cước) |
| `/esim` | Phễu và số liệu mảng eSIM (bán đứt, không cước) |
| `/cuoc` | Cước wifi cố định theo tháng, độ phủ tính cước, hợp đồng nợ |
| `/dong-bo` | Nút kéo dữ liệu ngay, kèm lịch sử các lượt đồng bộ |
| `/may-muon` | Nhập phiếu mượn máy pocket, đánh dấu đã nhận lại |

Bảo vệ bằng basic auth một tài khoản dùng chung (`MONITOR_USER`,
`MONITOR_PASSWORD`). Đủ cho mạng nội bộ, **không đủ để đưa ra internet** —
không có phiên, không ghi được ai làm gì, không khoá sau nhiều lần sai.
Đưa ra ngoài thì phải thay bằng đăng nhập thật.

Schema là SQL thuần với view và plpgsql nên phần này dùng `pg` trực tiếp,
không dùng Prisma — Prisma introspect được bảng nhưng không quản view và function.

## Còn thiếu

**Tầng đồng bộ — wifi cố định đã xong.**

```bash
cd agent && npm run sync
```

Hoặc bấm nút ở trang `/dong-bo`. Nút gọi thẳng script bên `agent` để chỉ có một
chỗ giữ logic đồng bộ. Script tự giữ khoá trong Postgres nên bấm lúc job đêm
đang chạy sẽ bị từ chối chứ không chạy song song.

Cấu hình nằm ở `.env.local` thư mục gốc, agent tự nạp. Riêng web thì Next.js
chỉ đọc `web/.env.local` nên `WAREHOUSE_URL`, `MONITOR_USER`,
`MONITOR_PASSWORD` và `SRC_FIXED_URL` phải có ở đó nữa.

Nguồn là **MySQL 8** chứ không phải Postgres, nên không dùng `postgres_fdw` mà
đọc bằng `mysql2`. Kết nối ép chỉ đọc ba lớp: phiên đặt `transaction_read_only`,
tắt `multipleStatements`, và hàm query chỉ nhận câu bắt đầu bằng `select` hoặc
`show`. Vẫn phải dùng tài khoản chỉ đọc ở phía MySQL — ba lớp trên là phòng thân.

Ánh xạ nằm trong `agent/src/sync/fixed-wifi.ts`, là chỗ duy nhất biết lược đồ
bên nguồn.

Hai điều khác thiết kế ban đầu:

- **Không có khách hàng cuối.** Bảy dòng trong `customers` bên nguồn là nhân
  viên 3M đứng tên đăng ký với nhà mạng. 3M chỉ quản hợp đồng và địa chỉ lắp,
  nên `party_id` để trống cho nguồn FIXED và mọi thứ quy về hợp đồng.
- **Không có hoá đơn.** `contract_fee_payments` là sổ các tháng **đã xử lý** —
  thu tiền hoặc miễn phí. Tháng nào không có dòng mới là tháng còn nợ. Kỳ phải
  sinh suy từ `feeStartDate`, không phải `activatedAt` (cột đó trống ở toàn bộ
  hợp đồng đang chạy).
- **Tháng khuyến mãi không phải nợ.** Dòng `isFree = 1` nghĩa là tháng đó được
  miễn, `amount` bằng 0 nhưng vẫn coi như xong.

**Tầng đồng bộ — telecom.** Chưa có thông tin kết nối.

**Ticket hỗ trợ.** Chỉ số thứ chín của báo cáo tuần (ticket tồn đọng) cần một
bảng `ticket_snapshot` và view ánh xạ thứ bảy. Chưa thêm vì chưa rõ hai hệ
thống có quản ticket không.

**Marketing.** Kéo tự động toàn bộ tab của cả hai sheet mỗi ngày:

```bash
cd agent && npm run ads:sync
```

Hai cách xác thực, đặt cái nào thì dùng cái đó.

**Tài khoản của chính mình** — dùng khi sheet đã được share cho mình, không
phải nhờ ai share thêm.

Ở Google Cloud Console: bật **Google Sheets API**, rồi Credentials → Create
credentials → OAuth client ID → Application type **Desktop app**. Loại này tự
cho phép mọi cổng `localhost` nên **không có ô Authorized redirect URIs để
điền** — ô đó chỉ xuất hiện với loại Web application. Nếu Console bắt tạo OAuth
consent screen trước thì chọn External và thêm email của mình vào Test users.

Đặt `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET` vào `.env.local` ở thư mục
gốc, rồi:

```bash
cd agent && npm run google:auth
```

Script mở một cổng tạm nhận mã Google trả về và in ra refresh token để chép
vào `.env.local` ở thư mục gốc. Nó không tự ghi vào file nào.

Đánh đổi: quyền `spreadsheets.readonly` đọc được mọi sheet tài khoản đó thấy,
không riêng hai file này. Và token gắn với một người — người đó mất quyền
truy cập thì job dừng.

**Tài khoản dịch vụ** — bền hơn, không gắn với ai, nhưng phải nhờ chủ sheet
chia sẻ cho email của nó. Đặt `GOOGLE_SA_EMAIL` và `GOOGLE_SA_PRIVATE_KEY`.

Ba sheet, mỗi người chạy ads một file. Chỉ đọc **tab tổng hợp** — tên có chữ
"tổng" ngay trước "tháng" và số, rồi hết: `Báo cao tổng tháng 8`,
`Báo cáo tổng tháng 9`, `BC_Tổng Tháng 11`. Tab riêng từng người
(`BC_Tháng 9_Việt Hoàng`), tab theo tuần (`Bc_Tuần_Tháng 8`) và biến thể
(`BC_Tháng 7 Quads`) đều bỏ qua — gộp vào là đếm trùng với tab tổng.

Năm suy từ tháng ghi trong ô ngày, **không** từ tên tab: có tab đặt tên
"tháng 8" nhưng bên trong là số liệu tháng 7.

Google cho 60 lượt đọc mỗi phút nên có nghỉ 600ms giữa các tab và thử lại khi
gặp 429.

Nhập tay từ CSV vẫn dùng được khi cần vá dữ liệu cũ:

```bash
npm run ads -- --owner dinh_viet --year 2026 --tab "Tháng 1" thang1.csv
```

Chỉ nhập năm số gốc: chi phí, tiếp cận, click, mess, đơn hàng. Giá click, CTR,
giá mess, chi phí trên đơn đều tính lại bằng SQL — trong sheet mấy hàng đó dùng
dấu phẩy thập phân nên xuất ra là vỡ cột.
