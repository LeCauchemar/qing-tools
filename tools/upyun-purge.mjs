// 又拍云缓存刷新（purge）
// 用法：node tools/upyun-purge.mjs https://qing.ccyyqq.com/island/update/latest.json [更多URL...]
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');

function loadCfg() {
  const f = process.env.ISLAND_UPYUN_FILE;
  if (f && fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  if (process.env.ISLAND_UPYUN_JSON) return JSON.parse(process.env.ISLAND_UPYUN_JSON);
  const local = path.resolve('upyun.local.json');
  if (fs.existsSync(local)) return JSON.parse(fs.readFileSync(local, 'utf8'));
  return null;
}

const cfg = loadCfg();
if (!cfg || !cfg.service || !cfg.operator || !cfg.password) {
  console.error('又拍云未配置');
  process.exit(2);
}
const urls = process.argv.slice(2).filter(Boolean);
if (!urls.length) {
  console.error('usage: node tools/upyun-purge.mjs <url> [url2 ...]');
  process.exit(2);
}

const list = urls.join(',');
// 与存储接口同一套签名：HMAC-SHA1(MD5(password), "METHOD&URI&DATE&Content-MD5")
const date = new Date().toUTCString();
const sig = crypto.createHmac('sha1', md5(cfg.password)).update(`POST&/purge&${date}&`).digest('base64');
const res = await fetch('https://purge.upyun.com/purge', {
  method: 'POST',
  headers: {
    Authorization: `UPYUN ${cfg.operator}:${sig}`,
    Date: date,
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  body: 'purge=' + encodeURIComponent(list)
});
const text = await res.text();
console.log('status', res.status, text);
process.exit(res.ok ? 0 : 1);
