import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';

const REPO = 'LeCauchemar/qing-tools';
const TAG = 'v1.16.0';

function token() {
  const out = execFileSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n',
    encoding: 'utf8'
  });
  const m = out.match(/^password=(.+)$/m);
  if (!m) throw new Error('no github token');
  return m[1].trim();
}

const setup = 'dist/QingTools-1.16.0-setup.exe';
const sha = crypto.createHash('sha256').update(fs.readFileSync(setup)).digest('hex');

const body = `## Qing Tools 1.16.0 — Qing 事项跟着账号走

- 每一项都带版本号落到云端：本机改完 0.5 秒后自动上传，另一台电脑 20 秒内自己长出来（包括待办的勾）
- 删除也会同步：一边删掉，另一边下次同步就消失，不会「复活」
- 两台电脑同时改同一条：以最后写入的为准，被覆盖的那版留成一条「另一台设备改过的版本」，不丢字
- 笔记里的图片自动传到又拍云，正文只留一个云端 key，另一台电脑直接看图
- 设置页账号区多了一行「事项同步」：几条事项、上次同步几秒前、有没有待上传，也能手动「立即同步」

### 下载

| | |
|---|---|
| 安装版（推荐） | https://qing.ccyyqq.com/island/update/QingTools-1.16.0-setup.exe |
| 便携版 | https://qing.ccyyqq.com/island/update/QingTools-1.16.0-portable.exe |
| 官网 | https://qingtools.ccyyqq.com/ |
| 开发记录 | https://qingtools.ccyyqq.com/changelog.html |

安装版 SHA-256：\`${sha}\`

### 系统要求

Windows 10 / 11（x64），约 280 MB 磁盘空间。
`;

const res = await fetch(`https://api.github.com/repos/${REPO}/releases`, {
  method: 'POST',
  headers: {
    authorization: 'Bearer ' + token(),
    accept: 'application/vnd.github+json',
    'content-type': 'application/json',
    'user-agent': 'qing-tools-release'
  },
  body: JSON.stringify({
    tag_name: TAG,
    name: 'Qing Tools 1.16.0 — Qing 事项跟着账号走',
    body,
    draft: false,
    prerelease: false
  })
});
const data = await res.json();
console.log(res.status, data.html_url || JSON.stringify(data).slice(0, 300));
