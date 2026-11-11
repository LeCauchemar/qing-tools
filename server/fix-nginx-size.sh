#!/bin/bash
# 把 island 反代块里的 client_max_body_size 调到 40m（表情包/大图上传用）
set -e
CONF=/www/server/panel/vhost/nginx/chat.ccyyqq.com.conf
python3 - "$CONF" <<'PY'
import re, sys
p = sys.argv[1]
s = open(p, encoding='utf-8').read()
start = s.find('ISLAND-NOTEBOOK-START')
end = s.find('ISLAND-NOTEBOOK-END')
if start == -1 or end == -1:
    print('markers not found, nothing to do')
    sys.exit(0)
block = s[start:end]
new = re.sub(r'client_max_body_size\s+\S+;', 'client_max_body_size 40m;', block)
if new != block:
    s = s[:start] + new + s[end:]
    open(p, 'w', encoding='utf-8').write(s)
    print('patched')
else:
    print('already ok')
PY
nginx -t && nginx -s reload && echo reloaded
grep -n "client_max_body_size" $CONF | head -5
