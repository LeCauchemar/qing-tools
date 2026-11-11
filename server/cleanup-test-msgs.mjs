// 一次性清理：删掉本轮联调时我自己灌进来的几条测试消息
// 用法：cd /www/wwwroot/island/app && node cleanup-test-msgs.mjs [--dry]
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const DATA_DIR = process.env.ISLAND_DATA || '/www/wwwroot/island/data';
const db = new DatabaseSync(path.join(DATA_DIR, 'island.db'));
const dry = process.argv.includes('--dry');

const LIKE = [
  '晚上一起吃饭吗%',
  '这周的会改到周四%'
];
const rows = db.prepare("SELECT id, device_name, text, created_at FROM messages WHERE device_name = 'chenyuqing-life' AND (text LIKE ? OR text LIKE ?)").all(...LIKE);
console.log('命中', rows.length, '条');
rows.forEach((r) => console.log(' -', r.id, r.created_at, String(r.text).slice(0, 40)));

if (!dry && rows.length) {
  const del = db.prepare('DELETE FROM messages WHERE id = ?');
  rows.forEach((r) => del.run(r.id));
  console.log('已删除');
}
