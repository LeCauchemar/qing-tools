import fs from 'node:fs';

const VER = '1.13.0';
const OLD = '1.12.1';
const COUNT_OLD = '<b>59</b>';
const COUNT_NEW = '<b>60</b>';

// 1) package.json
const pkgPath = 'package.json';
const pkg = fs.readFileSync(pkgPath, 'utf8');
fs.writeFileSync(pkgPath, pkg.replace(`"version": "${OLD}"`, `"version": "${VER}"`));

// 2) site/changelog.html
let cl = fs.readFileSync('site/changelog.html', 'utf8');
cl = cl.split(COUNT_OLD).join(COUNT_NEW);
cl = cl.split(`（1.0 → ${OLD}）`).join(`（1.0 → ${VER}）`);
cl = cl.split('<b>9</b><span>天（11-05 → 11-13）</span>').join('<b>10</b><span>天（11-05 → 11-14）</span>');
cl = cl.split('九天，五十多个版本').join('十天，六十个版本');
cl = cl.split(`开发记录 · Qing Tools 从 1.0 到 1.11.0`).join(`开发记录 · Qing Tools 从 1.0 到 ${VER}`);
cl = cl
  .split('Qing Tools 九天五十七个版本的开发过程')
  .join('Qing Tools 十天六十个版本的开发过程');
cl = cl.split(`v${OLD}`).join(`v${VER}`);
cl = cl.split(`QingTools-${OLD}-setup.exe`).join(`QingTools-${VER}-setup.exe`);
cl = cl.split(`QingTools-${OLD}-portable.exe`).join(`QingTools-${VER}-portable.exe`);

const entry = [
  '',
  '  <article class="cl-item v1">',
  '    <div class="cl-side"><b>1.13.0</b><span>11-14</span></div>',
  '    <div class="cl-body">',
  '      <h2>咻给好友：绑一个人，事项一键飞过去</h2>',
  '      <ul>',
  '        <li><b>亲密好友</b>：设置 → 亲密好友，填对方用户名发申请，对方同意就绑上，最多 3 个，随时能解除。</li>',
  '        <li><b>小飞机</b>：Qing 事项每行多了一个小飞机，点开选一个好友，「咻」一下飞走，服务端给对面复制一份独立事项。</li>',
  '        <li><b>收的时候有心跳</b>：对面收到时岛会横向抖一下，边缘散射一圈粉色光点，同时弹通知条、写进自己的 Qing 事项。</li>',
  '        <li>复制是<b>一份独立副本</b>：你改你的、他改他的，互不影响；对方的完成状态你也看不到。</li>',
  '      </ul>',
  '    </div>',
  '  </article>',
  ''
].join('\n');
const idx = cl.lastIndexOf('</section>');
cl = cl.slice(0, idx) + entry + cl.slice(idx);
fs.writeFileSync('site/changelog.html', cl);

// 3) 官网首页 + README 的版本串
for (const f of ['site/index.html', 'README.md']) {
  const s = fs.readFileSync(f, 'utf8');
  fs.writeFileSync(f, s.split(OLD).join(VER));
}

// 4) README 功能表加一行
let rd = fs.readFileSync('README.md', 'utf8');
if (!rd.includes('| **亲密好友 / 咻** |')) {
  const anchor = '| **账号** |';
  const i = rd.indexOf(anchor);
  const nl = rd.indexOf('\n', i);
  const row =
    '\n| **亲密好友 / 咻** | 设置里绑最多 3 个好友（发申请、对方同意）；Qing 事项行上的小飞机把这条事项复制给对方，收到时岛抖一下 + 边缘粉色光点，写进对方自己的 Qing 事项 |';
  rd = rd.slice(0, nl) + row + rd.slice(nl);
  fs.writeFileSync('README.md', rd);
}

// 5) CHANGELOG.md
let ch = fs.readFileSync('CHANGELOG.md', 'utf8');
ch = ch.split('从 1.0 到 ' + OLD).join('从 1.0 到 ' + VER);
ch = ch.split('59 个可安装版本').join('60 个可安装版本');
const sec = [
  '',
  `## ${VER} · 咻给好友（11-14）`,
  '',
  '- 设置 → 亲密好友：按用户名申请、对方同意、最多 3 个、可解除；对方申请在同一个列表里同意/拒绝。',
  '- Qing 事项每行多一个小飞机：选好友后「咻」一声飞走，服务端 `POST /api/shares` 给对方复制一条独立事项（`items.origin` 记来源）。',
  '- 收到时：岛抖动 + 边缘粉色光点散射（Canvas 40 粒子 / 900ms）+ 通知条 + 自动写进自己的 Qing 事项并标记已读。',
  '- 服务端新增 `bindings` / `shares` 接口：列表、申请、同意、拒绝、解除、分享、收件箱、已读；自测 `tools/test-share.mjs` 16 项全过。',
  ''
].join('\n');
const at = ch.indexOf('## 几个绕不过去的工程决定');
ch = at >= 0 ? ch.slice(0, at) + sec + '\n' + ch.slice(at) : ch + sec;
fs.writeFileSync('CHANGELOG.md', ch);

console.log('bumped', VER);
