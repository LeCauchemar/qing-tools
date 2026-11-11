// 服务器端：把历史上传的本地图片迁到又拍云，并把 media.file 改成 cloud:<key>
// 用法：cd /www/wwwroot/island/app && node media-migrate.mjs [--dry]
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { upyunReady, upyunConfig, putObject } from './upyun.mjs';

const DRY = process.argv.includes('--dry');
const DATA = process.env.ISLAND_DATA || '/www/wwwroot/island/data';
if (!upyunReady()) {
  console.log('upyun 未配置，退出');
  process.exit(2);
}
const cfg = upyunConfig(true);
console.log('domain', cfg.domain, '| prefix', cfg.prefix, '| dry', DRY);

const dbPath = path.join(DATA, 'island.db');
const db = new DatabaseSync(dbPath);
const rows = db.prepare('select id, room_id, mime, bytes, file from media').all()
  .filter((r) => !String(r.file).startsWith('cloud:'));
console.log('待迁移', rows.length);

const upd = db.prepare('update media set file = ? where id = ?');
// 迁移前把原始 file 值落盘，出问题可一键回滚（db 是 WAL 模式，直接 cp .db 文件不完整）
if (!DRY) {
  const backupPath = path.join(DATA, 'media-migrate-backup.json');
  if (!fs.existsSync(backupPath)) {
    fs.writeFileSync(backupPath, JSON.stringify(rows.map((r) => ({ id: r.id, file: r.file })), null, 2));
    console.log('backup ->', backupPath);
  }
}
let ok = 0, fail = 0, bytes = 0;
for (const r of rows) {
  const src = path.join(DATA, 'media', r.file);
  if (!fs.existsSync(src)) { console.log('skip missing', r.file); fail++; continue; }
  const ext = path.extname(r.file) || '.png';
  const key = `${cfg.prefix}/chat/${r.room_id}/${r.id}${ext}`;
  if (DRY) { console.log('would put', r.file, '->', key); ok++; continue; }
  const buf = fs.readFileSync(src);
  const res = await putObject(key, buf, r.mime || 'image/png');
  if (res.ok) {
    upd.run('cloud:' + key, r.id);
    ok++; bytes += buf.length;
    console.log('migrated', r.file, '->', key, buf.length);
  } else {
    fail++;
    console.log('FAIL', r.file, res.status, res.message);
  }
}
console.log('done ok', ok, 'fail', fail, 'bytes', bytes);
console.log('public sample', cfg.domain + '/' + encodeURI(`${cfg.prefix}/chat/${rows[0]?.room_id}/${rows[0]?.id}.png`));
