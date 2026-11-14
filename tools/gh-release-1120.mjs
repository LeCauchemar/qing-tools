import { spawn } from 'node:child_process';

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

const token = await gitCredential();
const body = [
  'Qing Tools 1.12.0 — Qing 事项、账号归属、频道跟着账号走',
  '',
  '### 这一版新增',
  '',
  '- **备忘录 + 待办 = Qing 事项**：输入框上方两个 chip 选类型；待办前面带圆圈，点一下打勾（划掉变淡）。小工具里那张待办卡整张撤掉。',
  '- **待办建好自动钉到桌面右上角**；钉住的备忘录 / 剪贴板条目删除按钮置灰，先取消钉在桌面才能删。',
  '- **登录后可以把本机旧数据归到账号名下**：设置页出现归属卡片（N 条备忘录 · N 个待办 · N 条提醒 · N 个纪念日），可先导出备份再归；本机与账号数据分区存放，登录退出各用各的。',
  '- **频道跟着账号走**：登录后本机频道逐个认领到账号名下（先到先得），换台电脑登同一账号，频道自动加回来。',
  '- **设置页最下面多了「退出登录」**，只退出这台电脑。',
  '',
  '### 下载',
  '',
  '| 版本 | 大小 | 链接 |',
  '| --- | --- | --- |',
  '| 安装版（推荐） | 101.8 MB | https://qing.ccyyqq.com/island/update/QingTools-1.12.0-setup.exe |',
  '| 便携版 | 93.0 MB | https://qing.ccyyqq.com/island/update/QingTools-1.12.0-portable.exe |',
  '',
  'SHA-256（安装版）：`952fff73ad2a7f40348dbd85de789d8dfc23f0499de82c8c88382e3ccae2def8`',
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
    tag_name: 'v1.12.0',
    name: 'Qing Tools 1.12.0 — Qing 事项、账号归属、频道跟着账号走',
    body,
    draft: false,
    prerelease: false
  })
});
const data = await res.json();
console.log(res.status, data.html_url || data.message);
