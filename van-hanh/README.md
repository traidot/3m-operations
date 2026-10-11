# Vận hành

Ba thứ phải chạy đều thì hệ mới dùng được: **kéo dữ liệu về**, **chấm quy
tắc**, và **web đang bật**. Thư mục này lo hai việc đầu.

## Một lượt bằng tay

```bash
./van-hanh/hang-ngay.sh
```

Ba bước, mỗi bước ghi vào `van-hanh/log/<ngày>.log`:

| Bước | Việc | Hỏng thì sao |
|---|---|---|
| 1 | Đồng bộ hai nguồn về kho | vẫn chạy tiếp bước 2 |
| 2 | `run_rules()` chấm lại phán quyết | thoát khác 0 |
| 3 | Diễn giải bản tin bằng LLM | bỏ qua nếu chưa có khoá API |

Bước 1 hỏng mà **vẫn chạy bước 2** là có chủ ý: quy tắc đầu tiên trong
`run_rules` là "đồng bộ quá hạn", bỏ bước chấm chính là bịt mất cái chuông duy
nhất báo rằng dữ liệu đang cũ.

Bước 3 cần `LLM_API_KEY` (kèm `LLM_BASE_URL`, `LLM_MODEL`). Thiếu thì bản tin vẫn đầy đủ, chỉ không có lời
bình — nên script bỏ qua chứ không báo hỏng.

## Chạy theo lịch (macOS)

```bash
cp van-hanh/com.3m.giam-sat.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.3m.giam-sat.plist
```

Bốn lượt mỗi ngày: 7h30, 12h, 17h, 22h. Chạy nhiều lượt vì **nguồn chặn theo
IP** — IP nhà đổi là đồng bộ chết, và một lượt hỏng không nên làm số liệu cũ
suốt cả ngày.

Xem lịch có nạp chưa, chạy thử ngay, hoặc gỡ:

```bash
launchctl list | grep 3m
launchctl start com.3m.giam-sat
launchctl unload ~/Library/LaunchAgents/com.3m.giam-sat.plist
```

## Khi đồng bộ hỏng

Lý do hay gặp nhất **không phải sai mật khẩu mà là chặn ở tầng mạng**: hai
nguồn chỉ mở cho một số IP, mà IP nhà thì đổi. Script in sẵn IP hiện tại vào
log để đối chiếu với whitelist.

```bash
tail -30 van-hanh/log/$(date +%F).log
```

Không có lượt nào chạy được thì màn hình tự biết: dải "Số trên màn có thể đã
cũ" hiện trên mọi trang, và phán quyết `R_SYNC_STALE` lên đầu Bản tin.

## Web

```bash
cd web && npm run build && npm start
```

Bản production **bắt buộc** có `MONITOR_USER` và `MONITOR_PASSWORD` trong
`web/.env.local` — thiếu thì middleware trả 500 chứ không chạy mở, vì trang có
địa chỉ khách, số điện thoại và công nợ.

Basic auth một tài khoản dùng chung chỉ đủ cho mạng nội bộ: không có phiên,
không ghi được ai làm gì, không khoá sau nhiều lần sai. Đưa ra internet thì
phải thay bằng đăng nhập thật.

## Đổi ngưỡng

Mọi mốc "bao lâu thì coi là muộn" nằm ở bảng `threshold`, sửa bằng SQL là màn
hình đổi theo, không phải build lại:

```sql
select key, value, unit, note from threshold order by key;
update threshold set value = 14 where key = 'goi_lai_khao_sat_ngay';
```
