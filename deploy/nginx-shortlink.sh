#!/usr/bin/env bash
# 给站点加两个短链：/get 与 /dl → /island/get（幂等，可重复执行）
set -euo pipefail
CONF=/www/server/panel/vhost/nginx/chat.ccyyqq.com.conf
MARK_BEGIN='# QINGTOOLS-SHORTLINK-START'
MARK_END='# QINGTOOLS-SHORTLINK-END'

if grep -q "$MARK_BEGIN" "$CONF"; then
  echo "[shortlink] 已存在，跳过"
  exit 0
fi

python3 - "$CONF" "$MARK_BEGIN" "$MARK_END" <<'PY'
import sys, io
conf, begin, end = sys.argv[1], sys.argv[2], sys.argv[3]
src = io.open(conf, encoding='utf-8').read()
block = (
    "    " + begin + "\n"
    "    location = /get { return 302 /island/get; }\n"
    "    location = /dl  { return 302 /island/get; }\n"
    "    " + end + "\n"
)
anchor = '# ISLAND-NOTEBOOK-START'
if anchor in src:
    src = src.replace(anchor, block + anchor, 1)
else:
    raise SystemExit('anchor not found')
io.open(conf, 'w', encoding='utf-8').write(src)
print('[shortlink] inserted')
PY

if nginx -t; then
  nginx -s reload
  echo "[shortlink] nginx reloaded"
  curl -sS -o /dev/null -w "local /get -> %{http_code}\n" -H 'Host: chat.ccyyqq.com' http://127.0.0.1/get
else
  echo "[shortlink] nginx -t failed, reverting"
  python3 - "$CONF" "$MARK_BEGIN" "$MARK_END" <<'PY'
import sys, io, re
conf, begin, end = sys.argv[1], sys.argv[2], sys.argv[3]
src = io.open(conf, encoding='utf-8').read()
src = re.sub(r'    ' + re.escape(begin) + r'.*?' + re.escape(end) + r'\n', '', src, flags=re.S)
io.open(conf, 'w', encoding='utf-8').write(src)
PY
  exit 1
fi
