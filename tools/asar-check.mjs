// 检查打包后的 app.asar 里是否已包含新域名、旧测试域名是否已移除
import fs from 'node:fs';
const p = process.argv[2] || `${process.env.LOCALAPPDATA}\\Programs\\dynamic-island\\resources\\app.asar`;
const buf = fs.readFileSync(p);
const s = buf.toString('latin1');
const count = (needle) => s.split(needle).length - 1;
console.log('asar', p, (buf.length / 1024 / 1024).toFixed(2) + 'MB');
for (const k of ['qing.ccyyqq.com', 'test.upcdn.net', 'chat.ccyyqq.com', 'island/update', 'islandclip']) {
  console.log(String(k).padEnd(18), count(k));
}
