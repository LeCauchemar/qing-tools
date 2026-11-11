#!/bin/bash
DB=/www/wwwroot/island/data/island.db
echo '=== devices ==='
sqlite3 -header "$DB" <<'SQL'
.mode column
.width 13 12 15 6 13
select id, name, owner_id, count, ifnull(last_seen,'') as last_seen from sms_devices;
SQL
echo '=== last 6 sms ==='
sqlite3 -header "$DB" <<'SQL'
.mode column
.width 6 12 10 13 30
select id, device_name, code, created_at, substr(replace(body,char(10),' '),1,28) as body from sms order by id desc limit 6;
SQL
