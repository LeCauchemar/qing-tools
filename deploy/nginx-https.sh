#!/usr/bin/env bash
# 给 qingtools.ccyyqq.com 打开「强制 HTTPS」：
# 主 server 块只留 443，另加一个只监听 80 的块，除证书校验路径外全部 301 到 https。
set -euo pipefail

CONF=/www/server/panel/vhost/nginx/qingtools.ccyyqq.com.conf

if grep -q 'QINGTOOLS-HTTPS2-START' "$CONF"; then
  echo '[https] already patched'
  exit 0
fi

cp -a "$CONF" "$CONF.bak-$(date +%Y%m%d%H%M%S)"

python3 - "$CONF" <<'PY'
import sys
p = sys.argv[1]
s = open(p, encoding='utf-8').read()

# 1) 主块去掉 listen 80
head, sep, tail = s.partition('server')
nl = s.find('\n', s.find('listen 80'))
if nl < 0:
    sys.exit('listen 80 not found')
s = s[:s.find('listen 80')] + s[nl + 1:]

block = """
# QINGTOOLS-HTTPS2-START
server {
    listen 80;
    server_name qingtools.ccyyqq.com;
    include /www/server/panel/vhost/nginx/well-known/qingtools.ccyyqq.com.conf;
    location / { return 301 https://$host$request_uri; }
}
# QINGTOOLS-HTTPS2-END
"""
s = s.rstrip('\n') + '\n' + block
open(p, 'w', encoding='utf-8').write(s)
print('[https] patched')
PY

nginx -t
nginx -s reload
sleep 1
echo '[https] check'
curl -s -o /dev/null -w '  http  -> %{http_code} %{redirect_url}\n' http://qingtools.ccyyqq.com/
curl -s -o /dev/null -w '  https -> %{http_code}\n' https://qingtools.ccyyqq.com/
