import { execFileSync } from 'node:child_process';

const REPO = 'LeCauchemar/qing-tools';
const TAG = 'v1.14.0';

function token() {
  const out = execFileSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n',
    encoding: 'utf8'
  });
  const m = out.match(/^password=(.+)$/m);
  if (!m) throw new Error('no github token');
  return m[1].trim();
}

const sha = process.env.SETUP_SHA || '';
const body = `## Qing Tools 1.14.0 — 频道跟着账号走

- 加入过的频道记在账号上：换台电脑登录，频道自己回来（先到先得，别人抢不走）
- 设备与消息都带账号：同一个人开两台电脑，群里只算一个人、只占一票
- @ 与拍一拍按人走，两台设备同时收到
- 投票踢人按人算，过半口径不变；被投的账号整体移出频道
- 已读位置按人保存，一台电脑看过，另一台红点也灭
- 登录前就加入的老频道会在登录后自动认到账号上（\`POST /api/rooms/:id/attach\`）

### 下载

| | |
|---|---|
| 安装版（推荐） | https://qing.ccyyqq.com/island/update/QingTools-1.14.0-setup.exe |
| 便携版 | https://qing.ccyyqq.com/island/update/QingTools-1.14.0-portable.exe |
| 官网 | https://qingtools.ccyyqq.com/ |
| 开发记录 | https://qingtools.ccyyqq.com/changelog.html |

安装版 SHA-256：\`${sha || '见 latest.json'}\`

### 系统要求

Windows 10 / 11（x64），约 280 MB 磁盘空间。
`;

const payload = JSON.stringify({
  tag_name: TAG,
  name: 'Qing Tools 1.14.0 — 频道跟着账号走',
  body,
  draft: false,
  prerelease: false
});

const res = await fetch(`https://api.github.com/repos/${REPO}/releases`, {
  method: 'POST',
  headers: {
    authorization: 'Bearer ' + token(),
    accept: 'application/vnd.github+json',
    'content-type': 'application/json'
  },
  body: payload
});
const text = await res.text();
console.log(res.status, text.slice(0, 300));
