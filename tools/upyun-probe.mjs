// 探测又拍云：用给定操作员凭据向候选服务名发一个 PUT，看返回码
// 401/403 = 服务存在但签名/权限问题；404 = 服务名不存在；200/201 = 成功
import crypto from 'node:crypto';

const OPERATOR = process.env.UP_OP || '';
const PASSWORD = process.env.UP_PW || '';
const buckets = process.argv.slice(2);
const body = Buffer.from('probe', 'utf8');

function sign(method, uri, date, len, md5str) {
  const str = [method, uri, date, len, md5str].join('&');
  const h = crypto.createHmac('sha1', PASSWORD).update(str).digest('base64');
  return 'UPYUN ' + OPERATOR + ':' + h;
}

for (const b of buckets) {
  const path = '/' + b + '/_probe.txt';
  const uri = '/' + b + '/_probe.txt';
  const date = new Date().toUTCString();
  const md5 = crypto.createHash('md5').update(body).digest('hex');
  try {
    const r = await fetch('https://v0.api.upyun.com' + uri, {
      method: 'PUT',
      headers: {
        Authorization: sign('PUT', uri, date, body.length, md5),
        Date: date,
        'Content-MD5': md5,
        'Content-Type': 'text/plain',
        'Content-Length': String(body.length)
      },
      body
    });
    const text = await r.text();
    console.log(b, r.status, text.slice(0, 120));
  } catch (e) {
    console.log(b, 'ERR', String(e.message || e));
  }
}
