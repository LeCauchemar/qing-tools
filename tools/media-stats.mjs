// 服务器端：统计本地 media 现状（先在服务器上跑，再决定是否迁移到又拍云）
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const DATA = process.env.ISLAND_DATA || '/www/wwwroot/island/data';
const db = new DatabaseSync(path.join(DATA, 'island.db'));
const rows = db.prepare('select id, room_id, mime, bytes, file from media').all();
const local = rows.filter((r) => !String(r.file).startsWith('cloud:'));
const cloud = rows.filter((r) => String(r.file).startsWith('cloud:'));
console.log('media rows', rows.length, '| local', local.length, '| cloud', cloud.length);
console.log('local bytes', local.reduce((s, r) => s + (r.bytes || 0), 0));
let missing = 0;
for (const r of local) if (!fs.existsSync(path.join(DATA, 'media', r.file))) missing++;
console.log('missing files', missing);
console.log('sample', local.slice(0, 5).map((r) => ({ id: r.id, room: r.room_id, mime: r.mime, file: r.file })));
