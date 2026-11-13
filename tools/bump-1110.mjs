'use strict';
// 1.11.0 一次性发版脚本：站点 changelog / CHANGELOG.md / 版本号串
// 只做定点替换，不对历史条目做 replaceAll（1.10.7 踩过这个坑）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const write = (p, s) => fs.writeFileSync(path.join(root, p), s, 'utf8');

const VER = '1.11.0';
const PREV = '1.10.11';
const log = [];

// ---------- package.json ----------
{
  const pkg = JSON.parse(read('package.json'));
  pkg.version = VER;
  write('package.json', JSON.stringify(pkg, null, 2) + '\n');
  log.push('package.json ' + VER);
}

// ---------- site/changelog.html ----------
{
  let s = read('site/changelog.html');
  const before = s.length;

  s = s.replace('七天，四十来个版本', '九天，四十来个版本');
  s = s.replace('<b>56</b><span>个可安装版本（1.0 → 1.10.11）</span>', '<b>57</b><span>个可安装版本（1.0 → 1.11.0）</span>');
  s = s.replace('<b>7</b><span>天（11-05 → 11-11）</span>', '<b>9</b><span>天（11-05 → 11-13）</span>');
  s = s.replace('到 1.10.11，它替你', '到 1.11.0，它替你');
  s = s.replace('<title>开发记录 · Qing Tools</title>', '<title>开发记录 · Qing Tools</title>');
  s = s.replace(/Qing Tools <span class="dim">v1\.10\.11<\/span>/, 'Qing Tools <span class="dim">v1.11.0</span>');
  s = s.replace(/QingTools-1\.10\.11-setup\.exe/g, 'QingTools-1.11.0-setup.exe');
  s = s.replace(/QingTools-1\.10\.11-portable\.exe/g, 'QingTools-1.11.0-portable.exe');

  const item = `
    <article class="cl-item v1">
      <div class="cl-side"><b>1.11.0</b><i>11-13</i></div>
      <div class="cl-body">
        <h3>有账号了：登录一次，换台电脑也是你</h3>
        <ul>
          <li>服务端先落了整套账号后端：注册 / 登录 / 找回 / 注销、设备列表、单个会话撤销、退出全部设备；密码和恢复码都用 <code>scrypt</code> 存哈希，登录态是不透明 token（库里只存 SHA-256），所以「踢掉某一台」是真的立刻失效。</li>
          <li>桌面端设置页最上面多了一组「账号」：用户名 + 密码登录或注册，注册完强制显示恢复码并要求勾选确认才能继续；已登录时能看到这台电脑在内的所有设备、最后活跃时间，逐台移除。</li>
          <li>token 用 Windows DPAPI（<code>safeStorage</code>）加密后存 <code>account.json</code>，关掉应用再开自动恢复登录；401 时自动清掉本地登录态并提示重新登录。</li>
          <li>找回密码用恢复码：换完密码旧码立即作废、当场给新码；注销要三重确认（用户名 + 密码 + 恢复码），注销后用户名永久保留、不会再放给别人。</li>
          <li>这一版只做账号本身，本地备忘录/待办等数据仍在「本地模式」；把它们归属到账号下（含换账号不串号的分区）是下一个里程碑。</li>
        </ul>
      </div>
    </div>
`;
  const marker = '\n  </section>\n\n  <footer class="foot">';
  const idx = s.lastIndexOf(marker);
  if (idx < 0) throw new Error('changelog marker not found');
  s = s.slice(0, idx) + item + s.slice(idx);
  write('site/changelog.html', s);
  log.push('changelog ' + before + ' -> ' + s.length);
}

// ---------- site/index.html / iphone / android ----------
for (const p of ['site/index.html', 'site/iphone.html', 'site/android.html']) {
  let s = read(p);
  const n = (s.match(/1\.10\.11/g) || []).length;
  s = s.split('1.10.11').join('1.11.0');
  write(p, s);
  log.push(p + ' replaced ' + n);
}

// ---------- README.md ----------
{
  let s = read('README.md');
  const n = (s.match(/1\.10\.11/g) || []).length;
  s = s.split('1.10.11').join('1.11.0');
  write('README.md', s);
  log.push('README.md replaced ' + n);
}

// ---------- CHANGELOG.md ----------
{
  let s = read('CHANGELOG.md');
  s = s.replace('从 1.0 到 1.10.11，七天里发了 56 个可安装版本', '从 1.0 到 1.11.0，九天里发了 57 个可安装版本');
  const sec = `## 1.11.0 · 账号：登录、设备列表、找回与注销（11-13）

- 服务端新增账号体系：注册 / 登录 / 找回 / 注销、设备列表、单台撤销、退出全部；密码与恢复码 scrypt 哈希、会话 token 只存 SHA-256。
- 桌面端设置页顶部新增「账号」：登录 / 注册 / 恢复码强制保存 / 设备列表 / 移除设备 / 退出 / 注销。
- 登录态用 DPAPI 加密落盘，重启自动恢复；401 自动清理并提示重新登录。
- 注销三重确认；用户名永久保留，不释放给他人。
- 本地数据仍在「本地模式」，归属到账号 + 分区在下一个里程碑。

`;
  const anchor = '## 几个绕不过去的工程决定';
  const i = s.indexOf(anchor);
  if (i < 0) throw new Error('CHANGELOG anchor not found');
  s = s.slice(0, i) + sec + s.slice(i);
  write('CHANGELOG.md', s);
  log.push('CHANGELOG.md +1 section');
}

console.log(log.join('\n'));
