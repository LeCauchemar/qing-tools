import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';

function gitCredential() {
  return new Promise((resolve, reject) => {
    const p = spawn('git', ['credential', 'fill'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    p.stdout.on('data', (d) => {
      out += d.toString();
    });
    p.on('close', () => {
      const m = out.match(/^password=(.+)$/m);
      if (m) resolve(m[1].trim());
      else reject(new Error('no password in credential output'));
    });
    p.stdin.write('protocol=https\nhost=github.com\n\n');
    p.stdin.end();
  });
}

const sha = (f) => createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const setup = 'dist/QingTools-1.13.0-setup.exe';
const portable = 'dist/QingTools-1.13.0-portable.exe';
const sizeMb = (f) => (fs.statSync(f).size / 1048576).toFixed(1);

const token = await gitCredential();
const title = 'Qing Tools 1.13.0 — 咻给好友：绑定、分享、心动';
const body = [
  title,
  '',
  '### 这一版新增',
  '',
  '- **亲密好友**：设置 → 亲密好友，填对方用户名发申请，对方同意就绑上；最多 3 个，随时能解除。',
  '- **小飞机**：Qing 事项每行多了一个小飞机按钮，点开选好友，「咻」一声飞走，服务端给对方复制一份独立事项。',
  '- **收到的时候有心跳**：岛会横向抖一下，边缘散射一圈粉色光点，同时弹通知条、自动写进自己的 Qing 事项。',
  '- **独立副本**：你改你的、他改他的，互不影响；对方的完成状态你也看不到。',
  '- 顺带修好 1.12.1 的问题：归属本机数据时，笔记里的图片会一起搬进账号分区（之前会裂图）。',
  '',
  '### 下载',
  '',
  '| 版本 | 大小 | 链接 |',
  '| --- | --- | --- |',
  `| 安装版（推荐） | ${sizeMb(setup)} MB | https://qing.ccyyqq.com/island/update/QingTools-1.13.0-setup.exe |`,
  `| 便携版 | ${sizeMb(portable)} MB | https://qing.ccyyqq.com/island/update/QingTools-1.13.0-portable.exe |`,
  '',
  `SHA-256（安装版）：\`${sha(setup)}\``,
  '',
  '### 系统要求',
  '',
  'Windows 10 / 11 x64。装完自动常驻托盘，开机自启。官网：https://qingtools.ccyyqq.com/',
  ''
].join('\n');

const res = await fetch('https://api.github.com/repos/LeCauchemar/qing-tools/releases', {
  method: 'POST',
  headers: {
    authorization: 'Bearer ' + token,
    accept: 'application/vnd.github+json',
    'content-type': 'application/json',
    'user-agent': 'qing-tools-release-script'
  },
  body: JSON.stringify({ tag_name: 'v1.13.0', name: title, body, draft: false, prerelease: false })
});
const data = await res.json();
console.log(res.status, data.html_url || data.message);
