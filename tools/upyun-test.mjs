// 又拍云连通性测试：上传一个小文件，再用公开域名取回来
// 用法：node tools/upyun-test.mjs            （默认传 build/icon-256.png）
import fs from 'node:fs';
import { upyunReady, upyunConfig, putObject, publicUrl, thumbUrl } from '../server/upyun.mjs';

if (!upyunReady()) {
  console.log('upyun 未配置：' + JSON.stringify(upyunConfig(true)));
  process.exit(2);
}
const cfg = upyunConfig(true);
console.log('config', { service: cfg.service, operator: cfg.operator, domain: cfg.domain, prefix: cfg.prefix, thumbRule: cfg.thumbRule });

const file = process.env.UPYUN_TEST_FILE || 'build/icon-256.png';
const buf = fs.readFileSync(file);
const key = `${cfg.prefix}/probe/probe-${Date.now()}.png`;
const up = await putObject(key, buf, 'image/png');
console.log('put', up.ok, up.status || '', up.message || up.url);
if (!up.ok) process.exit(1);

console.log('public', publicUrl(up.key));
console.log('thumb ', thumbUrl(publicUrl(up.key)));
const r = await fetch(up.url, { method: 'GET' });
console.log('GET original', r.status, r.headers.get('content-type'), (await r.arrayBuffer()).byteLength);
const t = await fetch(thumbUrl(up.url));
console.log('GET thumb   ', t.status, t.headers.get('content-type'), (await t.arrayBuffer()).byteLength);
