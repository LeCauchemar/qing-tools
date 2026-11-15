import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';

const REPO = 'LeCauchemar/qing-tools';

function token() {
  const out = execFileSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n',
    encoding: 'utf8'
  });
  const m = out.match(/^password=(.+)$/m);
  if (!m) throw new Error('no github token');
  return m[1].trim();
}

const TOKEN = token();

const head = (tag) => ({
  authorization: 'Bearer ' + TOKEN,
  accept: 'application/vnd.github+json',
  'content-type': 'application/json',
  'user-agent': 'qing-tools-release'
});

const shaOf = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const RELEASES = [
  {
    tag: 'v1.16.2',
    name: 'Qing Tools 1.16.2 — 钉到桌面的便条，图片终于看得见了',
    version: '1.16.2',
    sha: shaOf('dist/QingTools-1.16.2-setup.exe'),
    body: `## 修的是什么

「事项同步」会把笔记里的图片改写成云端键 \`[[img:cloud:…]]\`。主界面早就会按前缀分流，但桌面便条是独立窗口，仍然硬拼 \`islandclip://note/cloud:…\`——地址非法，所以钉到桌面就变成破图。

## 改了什么

- 便条窗口按前缀解析图片：\`cloud:\` → 又拍云 CDN，其余走本地 \`islandclip://\`
- 便条与「看大图」窗口的 CSP 放行 \`qing.ccyyqq.com\` / \`chat.ccyyqq.com\`，图片不会再被安全策略拦成破图
- 「看大图」的地址改在主进程里分流，标题只显示文件名（不再是整串 cloud key）
- 图片真的加载失败时画一条虚线占位，不再露出破图图标 + 大号 alt

### 下载

| | |
|---|---|
| 安装版（推荐） | https://qing.ccyyqq.com/island/update/QingTools-1.16.2-setup.exe |
| 便携版 | https://qing.ccyyqq.com/island/update/QingTools-1.16.2-portable.exe |
| 官网 | https://qingtools.ccyyqq.com/ |
| 开发记录 | https://qingtools.ccyyqq.com/changelog.html |

安装版 SHA-256：\`${'PLACEHOLDER'}\`

### 系统要求

Windows 10 / 11（x64），约 280 MB 磁盘空间。
`
  },
  {
    tag: 'v1.16.3',
    name: 'Qing Tools 1.16.3 — 重启之后，钉在桌面上的便条还在',
    version: '1.16.3',
    sha: shaOf('dist/QingTools-1.16.3-setup.exe'),
    body: `## 修的是什么

重启之后，钉在桌面上的便条会整批消失（数据里还是 \`pinned: true\`）。
原因是启动时先按「本机分区」贴了一次便条，随后登录态恢复、数据切到「账号分区」，却没人再贴一次。

## 改了什么

- 切换数据分区时重新同步便条窗口（\`useProfile()\` 里补 \`syncStickies()\`）
- 本机模式与账号登录两种启动方式下，便条都会自动回到屏幕上
- 便条里的云端图片继续正常加载（1.16.2 的修复一起生效）

### 下载

| | |
|---|---|
| 安装版（推荐） | https://qing.ccyyqq.com/island/update/QingTools-1.16.3-setup.exe |
| 便携版 | https://qing.ccyyqq.com/island/update/QingTools-1.16.3-portable.exe |
| 官网 | https://qingtools.ccyyqq.com/ |
| 开发记录 | https://qingtools.ccyyqq.com/changelog.html |

安装版 SHA-256：\`${'PLACEHOLDER'}\`

### 系统要求

Windows 10 / 11（x64），约 280 MB 磁盘空间。
`
  }
];

for (const r of RELEASES) {
  const body = r.body.replace('PLACEHOLDER', r.sha);

  const exists = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/${r.tag}`, {
    headers: head(r.tag)
  });
  if (exists.status === 200) {
    console.log(r.tag, 'already exists ->', (await exists.json()).html_url);
    continue;
  }

  const res = await fetch(`https://api.github.com/repos/${REPO}/releases`, {
    method: 'POST',
    headers: head(r.tag),
    body: JSON.stringify({ tag_name: r.tag, name: r.name, body, draft: false, prerelease: false })
  });
  const data = await res.json();
  console.log(r.tag, res.status, data.html_url || JSON.stringify(data).slice(0, 300));
}
