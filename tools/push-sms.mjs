import fs from 'node:fs';

const API = 'https://chat.ccyyqq.com/island';
const DEV = process.argv[2] || 'WL_wr6RO_EKAoaBXSAus'; // iPhone 设备的推送密钥
const text = process.argv[3] || '【测试】你的验证码是 123789，5分钟内有效';
const from = process.argv[4] || 'iPhone';

const r = await fetch(`${API}/api/hook/sms?token=${encodeURIComponent(DEV)}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ text, from })
});
console.log(r.status, await r.text());
