#!/usr/bin/env bash
# Dựng một database tạm, chạy toàn bộ migration và test, rồi xoá.
# Không đụng tới database thật.
set -euo pipefail

DB="3m_test_$$"
cd "$(dirname "$0")/../.."

cleanup() { dropdb --if-exists "$DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT

createdb "$DB"
# [0-9]* chứ không phải 0*: migration từ 100 trở đi vốn không được chạy trong
# test, nên một luật mới sửa ở 100 vẫn bị đo bằng luật cũ và test báo sai.
for f in db/[0-9]*.sql; do
  # 005 nối tới hai database nguồn thật, test dùng ánh xạ giả nên bỏ qua.
  [[ "$f" == *005_sources.sql ]] && continue
  psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f" > /dev/null
done

psql -q -v ON_ERROR_STOP=1 -d "$DB" -f db/test/cases.sql
