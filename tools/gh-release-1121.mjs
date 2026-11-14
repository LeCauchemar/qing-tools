import { spawn } from 'node:child_process';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const VER = '1.12.1';

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

const setup = path.join('dist', `QingTools-${VER}-setup.exe`);
const portable = path.join('dist', `QingTools-${VER}-portable.exe`);
const sha = crypto.createHash('sha256').update(fs.readFileSync(setup)).digest('hex');
const mb = (n) => (n / 1048576).toFixed(1);

const token = await gitCredential();
const body = [
  `Qing Tools ${VER} — 归属之后，笔记里的图片也跟着搬过去`,
  '',
  '### 这一版修了什么',
  '',
  '- **归属之后图片不再裂**：把本机数据归到账号名下时，备忘录里 `[[img:…]]` 的图片文件也会一起复制到账号分区，之前只搬了文字、图片全变裂图。',
  '- 已经归属过的机器：把 `%APPDATA%\\DynamicIsland\\note-images\\` 里的文件复制到 `%APPDATA%\\DynamicIsland\\accounts\\<uid>\\note-images\\` 即可恢复历史图片。',
  '',
  '### 下载',
  '',
  '| 版本 | 大小 | 链接 |',
  '| --- | --- | --- |',
  `| 安装版（推荐） | ${mb(fs.statSync(setup).size)} MB | https://qing.ccyyqq.com/island/update/QingTools-${VER}-setup.exe |`,
  `| 便携版 | ${mb(fs.statSync(portable).size)} MB | https://qing.ccyyqq.com/island/update/QingTools-${VER}-portable.exe |`,
  '',
  `SHA-256（安装版）：\`${sha}\``,
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
  body: JSON.stringify({
    tag_name: `v${VER}`,
    name: `Qing Tools ${VER} — 归属之后，笔记里的图片也跟着搬过去`,
    body,
    draft: false,
    prerelease: false
  })
});
const data = await res.json();
console.log(res.status, data.html_url || data.message);
