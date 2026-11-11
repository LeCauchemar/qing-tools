#!/bin/bash
LOG=/www/wwwlogs/chat.ccyyqq.com.log
echo "=== sms/stream requests (last 15) ==="
grep -a 'api/sms/stream' "$LOG" 2>/dev/null | tail -n 15 | cut -c1-160
echo
echo "=== hook/sms requests (last 10) ==="
grep -a 'api/hook/sms' "$LOG" 2>/dev/null | tail -n 10 | cut -c1-160
echo
echo "=== app out.log tail ==="
tail -n 40 /www/wwwroot/island/logs/out.log 2>/dev/null
