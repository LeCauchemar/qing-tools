// 上传任意本地文件到又拍云（用于补传便携版等）
// 用法：node tools/upyun-upload-one.mjs <本地文件> <远端 key> [contentType]
import fs from 'node:fs';
import path from 'node:path';
import { upyunReady, upyunConfig, putObject, publicUrl } from '../server/upyun.mjs';

const [local, keyArg, ct] = process.argv.slice(2);
if (!local || !keyArg) {
  console.error('用法: node tools/upyun-upload-one.mjs <local> <key> [contentType]');
  process.exit(2);
}
if (!upyunReady()) {
  console.error('又拍云未配置');
  process.exit(2);
}
const cfg = upyunConfig(true);
const key = keyArg.replace('<prefix>', cfg.prefix);
const buf = fs.readFileSync(local);
console.log('upload', path.basename(local), (buf.length / 1048576).toFixed(2) + 'MB', '->', key);
const r = await putObject(key, buf, ct || 'application/octet-stream');
console.log(r.ok ? 'ok ' + publicUrl(key) : `fail ${r.status} ${r.message}`);
process.exit(r.ok ? 0 : 1);
