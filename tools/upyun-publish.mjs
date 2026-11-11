// 把安装包和 latest.json 传到又拍云（客户端「检查更新」默认先读这里）
// 用法：node tools/upyun-publish.mjs 1.8.2 "本次更新说明"
// 需要环境变量（或 upyun.local.json + ISLAND_UPYUN_FILE）：
//   ISLAND_UPYUN_JSON / ISLAND_UPYUN_FILE
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { upyunReady, upyunConfig, putObject, publicUrl } from '../server/upyun.mjs';

const version = process.argv[2] || '';
const notes = process.argv[3] || '';
if (!version) {
  console.error('用法: node tools/upyun-publish.mjs <version> "<notes>"');
  process.exit(2);
}
if (!upyunReady()) {
  console.error('又拍云未配置');
  process.exit(2);
}
const cfg = upyunConfig(true);
const setup = path.join('dist', `QingTools-${version}-setup.exe`);
if (!fs.existsSync(setup)) {
  console.error('找不到安装包: ' + setup);
  process.exit(2);
}

const buf = fs.readFileSync(setup);
const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
const name = path.basename(setup);
const key = `${cfg.prefix}/update/${name}`;

console.log(`上传 ${name}（${(buf.length / 1048576).toFixed(1)} MB）…`);
const up = await putObject(key, buf, 'application/octet-stream');
if (!up.ok) {
  console.error('上传失败', up.status, up.message);
  process.exit(1);
}
console.log('  ->', up.url);

// 便携版也一起传（官网「便携版」按钮直接指向 CDN）
const portable = path.join('dist', `QingTools-${version}-portable.exe`);
if (fs.existsSync(portable)) {
  const pbuf = fs.readFileSync(portable);
  const pkey = `${cfg.prefix}/update/${path.basename(portable)}`;
  console.log(`上传 ${path.basename(portable)}（${(pbuf.length / 1048576).toFixed(1)} MB）…`);
  const pup = await putObject(pkey, pbuf, 'application/octet-stream');
  if (pup.ok) console.log('  ->', pup.url);
  else console.warn('  便携版上传失败', pup.status, pup.message);
}

const latest = {
  version,
  file: name,
  size: buf.length,
  sha256,
  notes,
  at: new Date().toISOString()
};
const json = Buffer.from(JSON.stringify(latest, null, 2), 'utf8');
const jup = await putObject(`${cfg.prefix}/update/latest.json`, json, 'application/json');
if (!jup.ok) {
  console.error('latest.json 上传失败', jup.status, jup.message);
  process.exit(1);
}
console.log('  ->', jup.url);
console.log('完成：', publicUrl(`${cfg.prefix}/update/latest.json`));
