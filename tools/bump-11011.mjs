import fs from 'node:fs';

const root = 'D:/deepseek harness daily/dynamic-island';
const rd = (p) => fs.readFileSync(`${root}/${p}`, 'utf8');
const wr = (p, s) => fs.writeFileSync(`${root}/${p}`, s);

// 1) package.json
const pkg = JSON.parse(rd('package.json'));
pkg.version = '1.10.11';
wr('package.json', JSON.stringify(pkg, null, 2) + '\n');

// 2) changelog：追加条目 + 定点改版本相关串（历史条目的 1.10.10 必须留着）
let cl = rd('site/changelog.html');
const entry = [
  '    <article class="cl-item v5">',
  '      <div class="cl-side"><b>1.10.11</b><i>11-11</i></div>',
  '      <div class="cl-body">',
  '        <h3>提醒事项的日期时间看得见了</h3>',
  '        <ul>',
  '          <li>原生 <code>datetime-local</code> 之前按浅色 scheme 画，深色面板上是黑字黑底 —— 现在 <code>color-scheme</code> 跟着主题走，两套主题都清清楚楚。</li>',
  '          <li>日期框统一 26px 高、等宽数字，日历图标 hover 变亮，聚焦有强调色描边。</li>',
  '          <li>删掉提醒卡下面那段长提示，空状态不再占地方。</li>',
  '        </ul>',
  '      </div>',
  '    </article>',
  '',
].join('\n');
cl = cl.replace('    <article class="cl-item v4">', entry + '    <article class="cl-item v4">');
cl = cl.replace('开发记录 · Qing Tools 从 1.0 到 1.10.10', '开发记录 · Qing Tools 从 1.0 到 1.10.11');
cl = cl.replace('到 1.10.10，它替你', '到 1.10.11，它替你');
cl = cl.replace('<b>55</b><span>个可安装版本（1.0 → 1.10.10）</span>', '<b>56</b><span>个可安装版本（1.0 → 1.10.11）</span>');
cl = cl.replace('七天五十五个版本', '七天五十六个版本');
cl = cl.replace(/QingTools-1\.10\.10-setup\.exe/g, 'QingTools-1.10.11-setup.exe');
cl = cl.replace(/QingTools-1\.10\.10-portable\.exe/g, 'QingTools-1.10.11-portable.exe');
cl = cl.replace('<span class="dim">v1.10.10</span>', '<span class="dim">v1.10.11</span>');
wr('site/changelog.html', cl);

// 3) 首页 / 接入页 / README：整页替换（这些文件里没有历史条目）
for (const p of ['site/index.html', 'site/iphone.html', 'site/android.html', 'README.md']) {
  wr(p, rd(p).replace(/1\.10\.10/g, '1.10.11'));
}

// 4) CHANGELOG.md
let md = rd('CHANGELOG.md');
const sec = [
  '## 1.10.11 · 提醒事项的日期时间看得见了（11-11）',
  '',
  '- 原生 `datetime-local` 在深色面板里是「黑字黑底」：页面从来没声明过 `color-scheme`，Chromium 按浅色 scheme 画控件内部。现在 `html[data-theme="dark"] { color-scheme: dark }`、`light` 对应 `light`，日期、时间、下拉、滚动条一起跟着主题走。',
  '- 日期框统一 26px 高、等宽数字，`::-webkit-calendar-picker-indicator` 默认 55% 不透明度、hover 到 92%，聚焦加强调色描边。',
  '- 删掉提醒卡下面那段「到点会像拍一拍那样抖一下…」的提示，空状态不再占位。',
  '',
].join('\n');
md = md.replace('## 几个绕不过去的工程决定', sec + '## 几个绕不过去的工程决定');
md = md.replace('从 1.0 到 1.10.10，七天里发了 55 个可安装版本', '从 1.0 到 1.10.11，七天里发了 56 个可安装版本');
wr('CHANGELOG.md', md);

console.log('bump ok');
