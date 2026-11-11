// 诊断：分别用「列目录 GET」和「PUT」验证签名算法与凭证
import crypto from 'node:crypto';
import { upyunConfig, upyunReady } from '../server/upyun.mjs';

if (!upyunReady()) { console.log('not configured'); process.exit(2); }
const c = upyunConfig(true);

function auth(method, uri, date, len, md5, pw) {
  const str = [method, uri, date, len, md5].join('&');
  return 'UPYUN ' + c.operator + ':' + crypto.createHmac('sha1', pw).update(str).digest('base64');
}

const date = new Date().toUTCString();

// 1) 列目录（最简单的鉴权调用）
{
  const uri = `/${c.service}/`;
  const r = await fetch('https://v0.api.upyun.com' + uri + '?_order=asc', {
    headers: { Authorization: auth('GET', uri, date, 0, '', c.password), Date: date }
  });
  console.log('LIST', r.status, (await r.text()).slice(0, 160));
}

// 2) PUT 一个空文件
{
  const key = `probe/hello.txt`;
  const uri = `/${c.service}/${key}`;
  const buf = Buffer.from('hi');
  const md5 = crypto.createHash('md5').update(buf).digest('hex');
  const r = await fetch('https://v0.api.upyun.com' + uri, {
    method: 'PUT',
    headers: {
      Authorization: auth('PUT', uri, date, buf.length, md5, c.password),
      Date: date,
      'Content-MD5': md5,
      'Content-Type': 'text/plain'
    },
    body: buf
  });
  console.log('PUT ', r.status, (await r.text()).slice(0, 160));
}
