#!/usr/bin/env bash
# 给官网 qingtools.ccyyqq.com 加 /download/ 别名，指向 /www/wwwroot/island/update/
# 幂等：已存在则跳过；nginx -t 失败自动回滚
set -euo pipefail

CONF=/www/server/panel/vhost/nginx/qingtools.ccyyqq.com.conf
BEGIN='# QINGTOOLS-DL-START'
END='# QINGTOOLS-DL-END'

if grep -q "$BEGIN" "$CONF"; then
  echo "[dl] already present, skip"
  exit 0
fi

python3 - "$CONF" "$BEGIN" "$END" <<'PY'
import io, sys

conf, begin, end = sys.argv[1], sys.argv[2], sys.argv[3]
src = io.open(conf, encoding='utf-8').read()
block = (
    "    " + begin + "\n"
    "    location ^~ /download/ {\n"
    "        alias /www/wwwroot/island/update/;\n"
    "        autoindex off;\n"
    "        add_header Cache-Control \"public, max-age=300\";\n"
    "    }\n"
    "    " + end + "\n"
)
anchor = "server_name qingtools.ccyyqq.com;\n"
if anchor not in src:
    raise SystemExit("anchor not found")
src = src.replace(anchor, anchor + block, 1)
io.open(conf, "w", encoding="utf-8").write(src)
print("[dl] inserted")
PY

cp "$CONF" "$CONF.bak.$(date +%Y%m%d%H%M%S)"

if nginx -t >/dev/null 2>&1; then
  nginx -s reload
  echo "[dl] nginx reloaded"
  code=$(curl -sS -o /dev/null -w '%{http_code}' -H 'Host: qingtools.ccyyqq.com' http://127.0.0.1/download/latest.json || true)
  echo "[dl] local /download/latest.json -> $code"
else
  echo "[dl] nginx -t failed, reverting"
  python3 - "$CONF" "$BEGIN" "$END" <<'PY'
import io, re, sys
conf, begin, end = sys.argv[1], sys.argv[2], sys.argv[3]
src = io.open(conf, encoding='utf-8').read()
src = re.sub(r"    " + re.escape(begin) + r".*?" + re.escape(end) + r"\n", "", src, flags=re.S)
io.open(conf, "w", encoding="utf-8").write(src)
PY
  exit 1
fi
