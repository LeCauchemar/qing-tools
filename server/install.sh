#!/usr/bin/env bash
# 灵动岛 · 小纸条服务端安装脚本（Ubuntu + systemd + nginx 反代）
# 幂等：可以反复执行，用于首次安装和后续升级。
set -euo pipefail

SERVICE=island-notebook
APP_DIR=/www/wwwroot/island/app
DATA_DIR=/www/wwwroot/island/data
LOG_DIR=/www/wwwroot/island/logs
PORT=3311
NGINX_CONF=/www/server/panel/vhost/nginx/chat.ccyyqq.com.conf
NGINX_MARK=ISLAND-NOTEBOOK

say() { printf '\033[36m[island]\033[0m %s\n' "$*"; }

NODE_BIN=$(command -v node || true)
if [ -z "$NODE_BIN" ]; then
  echo "找不到 node，请先安装 Node >= 22.5" >&2
  exit 1
fi
NODE_VER=$("$NODE_BIN" -v)
say "node: $NODE_BIN ($NODE_VER)"

if [ ! -f "$APP_DIR/index.mjs" ]; then
  echo "缺少 $APP_DIR/index.mjs，请先上传文件" >&2
  exit 1
fi

mkdir -p "$DATA_DIR/media" "$LOG_DIR"

# ---------------------------------------------------------------- systemd
cat > "/etc/systemd/system/$SERVICE.service" <<UNIT
[Unit]
Description=Island Notebook - 灵动岛小纸条
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=www
Group=www
WorkingDirectory=$APP_DIR
ExecStart=$NODE_BIN $APP_DIR/index.mjs
Environment=ISLAND_PORT=$PORT
Environment=ISLAND_DATA=$DATA_DIR
Restart=always
RestartSec=2
LimitNOFILE=65535
StandardOutput=append:$LOG_DIR/out.log
StandardError=append:$LOG_DIR/err.log

[Install]
WantedBy=multi-user.target
UNIT

chown -R www:www /www/wwwroot/island
systemctl daemon-reload
systemctl enable "$SERVICE" >/dev/null
systemctl restart "$SERVICE"
sleep 1
systemctl is-active --quiet "$SERVICE" && say "服务已启动: $SERVICE (127.0.0.1:$PORT)" || {
  journalctl -u "$SERVICE" -n 30 --no-pager
  exit 1
}

# ------------------------------------------------------------------ nginx
if [ -f "$NGINX_CONF" ]; then
  if grep -q "$NGINX_MARK-START" "$NGINX_CONF"; then
    say "nginx 配置已存在，跳过"
  else
    cp "$NGINX_CONF" "$NGINX_CONF.bak.$(date +%Y%m%d%H%M%S)"
    python3 - "$NGINX_CONF" "$NGINX_MARK" "$PORT" <<'PY'
import sys
path, mark, port = sys.argv[1], sys.argv[2], sys.argv[3]
src = open(path, encoding='utf-8').read()
block = """
    # %s-START 灵动岛小纸条（由 install.sh 维护，请勿手改）
    location ^~ /island/ {
        proxy_pass http://127.0.0.1:%s;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        client_max_body_size 40m;
    }
    # %s-END
""" % (mark, port, mark)
idx = src.rstrip().rfind('}')
if idx < 0:
    raise SystemExit('nginx 配置文件结构异常')
out = src[:idx] + block + src[idx:]
open(path, 'w', encoding='utf-8').write(out)
print('nginx: 已插入 /island/ 反向代理')
PY
    if nginx -t 2>/dev/null; then
      nginx -s reload && say "nginx 已重载"
    else
      echo "nginx 配置有误，已回滚" >&2
      cp "$(ls -t "$NGINX_CONF".bak.* | head -1)" "$NGINX_CONF"
      nginx -t
      exit 1
    fi
  fi
else
  say "未找到 $NGINX_CONF，跳过 nginx 配置"
fi

# ------------------------------------------------------------------ 自检
sleep 1
HEALTH=$(curl -fsS "http://127.0.0.1:$PORT/island/api/health" || true)
if [ -z "$HEALTH" ]; then
  echo "本地健康检查失败" >&2
  tail -20 "$LOG_DIR/err.log" || true
  exit 1
fi
say "本地健康检查: $HEALTH"

HTTPS=$(curl -fsS --max-time 10 "https://chat.ccyyqq.com/island/api/health" || true)
if [ -n "$HTTPS" ]; then
  say "外网健康检查: $HTTPS"
else
  say "外网健康检查失败（可能 nginx 未生效或证书问题），本地服务正常"
fi
say "完成。网页版: https://chat.ccyyqq.com/island/"
