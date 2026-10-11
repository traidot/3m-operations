#!/bin/bash
# Một lượt vận hành: kéo dữ liệu về, rồi cho lớp quy tắc chấm lại.
#
# Chạy tay:  ./van-hanh/hang-ngay.sh
# Chạy theo lịch: xem van-hanh/README.md
#
# Thoát khác 0 khi có bước hỏng, để launchd và người đọc log biết ngay.
#
# Đồng bộ hỏng thì VẪN chấm quy tắc. Nghe ngược, nhưng quy tắc đầu tiên trong
# run_rules là "đồng bộ quá hạn" — bỏ bước chấm chính là bịt mất cái chuông
# duy nhất báo rằng dữ liệu đang cũ. Lượt đó vẫn tính là hỏng khi thoát.
set -uo pipefail

GOC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$GOC"

# launchd không nạp hồ sơ shell nên PATH chỉ có vài thư mục hệ thống; node và
# psql cài bằng brew sẽ không tìm thấy nếu không thêm vào đây.
export PATH="/opt/homebrew/bin:/opt/homebrew/opt/postgresql@16/bin:/usr/local/bin:$PATH"

LOG="$GOC/van-hanh/log"
mkdir -p "$LOG"
HOM_NAY="$(date +%F)"
FILE="$LOG/$HOM_NAY.log"

ghi() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$FILE"; }

ghi "── bắt đầu lượt vận hành"

HONG=0

ghi "1/3 đồng bộ dữ liệu"
if ! (cd agent && npm run --silent sync) >>"$FILE" 2>&1; then
  ghi "LỖI: đồng bộ hỏng — xem $FILE"
  ghi "      nguồn chặn theo IP, nên đây thường là đổi mạng hoặc tắt VPN."
  ghi "      IP hiện tại: $(curl -s --max-time 8 https://api.ipify.org || echo 'không lấy được')"
  HONG=1
fi

# Chấm quy tắc bằng psql chứ không qua agent: run_rules là SQL thuần, còn
# lệnh digest của agent gọi thêm LLM để diễn giải. Gộp hai thứ thì thiếu khoá
# API là mất luôn phán quyết — phần cốt lõi không được phụ thuộc dịch vụ ngoài.
ghi "2/3 chấm lại quy tắc"
if ! psql -q -v ON_ERROR_STOP=1 -d 3m_warehouse \
     -c "select * from run_rules()" >>"$FILE" 2>&1; then
  ghi "LỖI: chấm quy tắc hỏng — xem $FILE"
  HONG=1
fi

# Diễn giải bằng LLM là phần đọc cho dễ, không phải phần tính. Thiếu khoá thì
# bỏ qua chứ đừng báo hỏng: bản tin vẫn đầy đủ, chỉ là không có lời bình.
ghi "3/3 diễn giải bản tin (tuỳ chọn)"
if grep -qE '^LLM_API_KEY=.+' .env.local 2>/dev/null; then
  if ! (cd agent && npm run --silent digest) >>"$FILE" 2>&1; then
    ghi "LỖI: diễn giải hỏng — xem $FILE"
    HONG=1
  fi
else
  ghi "      bỏ qua: chưa đặt LLM_API_KEY"
fi

# Một dòng tổng kết để liếc log là biết lượt đó có thật sự lấy được gì không.
CU=$(psql -At -d 3m_warehouse -c \
  "select count(*) from v_sync_freshness where lan_dong_bo_cuoi is null or gio_ke_tu_lan_cuoi > nguong_gio" \
  2>/dev/null || echo "?")
VIEC=$(psql -At -d 3m_warehouse -c "select count(*) from finding_digest" 2>/dev/null || echo "?")
if [ "$HONG" = "0" ]; then
  ghi "xong — $CU bảng còn cũ, $VIEC việc đang mở"
else
  ghi "XONG NHƯNG CÓ LỖI — $CU bảng còn cũ, $VIEC việc đang mở"
fi

# Giữ log hai tháng; lâu hơn thì không ai đọc mà vẫn chiếm chỗ.
find "$LOG" -name '*.log' -mtime +60 -delete 2>/dev/null || true

exit "$HONG"
