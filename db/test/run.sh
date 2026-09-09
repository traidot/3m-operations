#!/usr/bin/env bash
# Dựng một database tạm, chạy toàn bộ migration và test, rồi xoá.
# Không đụng tới database thật.
set -euo pipefail

DB="3m_test_$$"
cd "$(dirname "$0")/../.."

cleanup() { dropdb --if-exists "$DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT

createdb "$DB"
for f in db/0*.sql; do
  # 005 nối tới hai database nguồn thật, test dùng ánh xạ giả nên bỏ qua.
  [[ "$f" == *005_sources.sql ]] && continue
  psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f" > /dev/null
done

psql -q -v ON_ERROR_STOP=1 -d "$DB" -f db/test/cases.sql
