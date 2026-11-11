import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s, 'utf8');

/* ---------- package.json ---------- */
const pkgPath = 'package.json';
const pkg = JSON.parse(read(pkgPath));
if (pkg.version !== '1.10.7') {
  pkg.version = '1.10.7';
  write(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log('package.json -> 1.10.7');
}

/* ---------- site/changelog.html ---------- */
let cl = read('site/changelog.html');
const before = cl.length;
cl = cl
  .replaceAll('1.10.6', '1.10.7')
  .replace('<b>51</b>', '<b>52</b>')
  .replace('<b>6</b><span>天（11-05 → 11-10）', '<b>7</b><span>天（11-05 → 11-11）')
  .replace('六天，四十来个版本', '七天，四十来个版本')
  .replace('六天五十一个版本', '七天五十二个版本');

const entry = [
  '',
  '<article class="cl-item v5">',
  '<div class="cl-side"><b>1.10.7</b><i>11-11</i></div>',
  '<div class="cl-body">',
  '<h3>桌面便条：图片能点开看大图，纸也能拖着走、拉着改大小</h3>',
  '<ul class="cl-list">',
  '<li><b>点图片看大图。</b>便条里的截图以前只能看缩略图，现在点一下弹出一个独立的「看大图」窗口：滚轮以光标为中心缩放、按住拖动平移、双击回到适应大小、Esc 或 ✕ 关闭，窗口自己也能拖着标题栏移动。</li>',
  '<li><b>整张纸都能拖着走。</b>以前只有顶部那一条（还被胶带挡住一半）能拖，现在纸边、留白、底部都能拖，正文区专门留给打字和选字。</li>',
  '<li><b>右下角能改大小。</b>透明无边框窗口在 Windows 上没有系统缩放边框，所以自己做了右边、下边、右下角三条把手；拖完的尺寸会记住，下次打开还是这么大。</li>',
  '</ul>',
  '</div>',
  '</article>',
  ''
].join('\n');

const anchor = '\n</section>\n\n<footer class="foot">';
if (!cl.includes('1.10.7</b>')) {
  if (!cl.includes(anchor)) throw new Error('changelog anchor not found');
  cl = cl.replace(anchor, entry + anchor);
}
write('site/changelog.html', cl);
console.log('changelog', before, '->', cl.length);

/* ---------- site/index.html ---------- */
let idx = read('site/index.html');
const idxBefore = idx.length;
idx = idx.replaceAll('1.10.6', '1.10.7');
write('site/index.html', idx);
console.log('index', idxBefore, '->', idx.length);

/* ---------- CHANGELOG.md ---------- */
let md = read('CHANGELOG.md');
md = md
  .replace('从 1.0 到 1.10.6，六天里发了 51 个可安装版本', '从 1.0 到 1.10.7，七天里发了 52 个可安装版本')
  .replace('到 1.10.6 它已经', '到 1.10.7 它已经');

const mdEntry = [
  '## 1.10.7 · 便条能看大图、能拖能缩（11-11）',
  '',
  '- **点图看大图**：桌面便条里的图片以前只能看缩略图。现在点一下弹出独立窗口（viewer.html）：滚轮以光标为中心缩放（8%–800%）、按住拖动平移、双击回到适应大小、Esc/✕ 关闭；窗口标题栏可拖动，缩放百分比显示在右上角。',
  '- **整张纸都能拖**：纸张元素设成 -webkit-app-region: drag，正文、工具按钮、缩放把手显式 no-drag —— 不再只有顶部 30px 那一条能拖。',
  '- **自己做的缩放把手**：Windows 上透明无边框窗口没有系统缩放边框，改由渲染层在右边、下边、右下角放三条把手，pointerdown 用 rAF 合并后走 IPC sticky:resize，主进程 win.setSize() 落到窗口，尺寸照旧由 resized 事件记进便条数据。',
  ''
].join('\n');

const mdAnchor = '## 几个绕不过去的工程决定';
if (!md.includes('## 1.10.7')) {
  if (!md.includes(mdAnchor)) throw new Error('CHANGELOG anchor not found');
  md = md.replace(mdAnchor, mdEntry + '\n' + mdAnchor);
}
write('CHANGELOG.md', md);
console.log('CHANGELOG.md ok');
