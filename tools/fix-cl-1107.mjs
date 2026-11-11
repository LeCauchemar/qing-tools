import fs from 'node:fs';

const p = 'site/changelog.html';
let t = fs.readFileSync(p, 'utf8');

// 1) 上一轮 replaceAll 把 1.10.6 那条也改成了 1.10.7，先改回去
const wrong = '<div class="cl-side"><b>1.10.7</b><i>11-10</i></div>\n      <div class="cl-body">\n        <h3>通知条底部的进度线';
const right = '<div class="cl-side"><b>1.10.6</b><i>11-10</i></div>\n      <div class="cl-body">\n        <h3>通知条底部的进度线';
if (t.includes(wrong)) {
  t = t.replace(wrong, right);
  console.log('restored 1.10.6 header');
}

// 2) 插入 1.10.7 的新条目
const entry = [
  '',
  '    <article class="cl-item v5">',
  '      <div class="cl-side"><b>1.10.7</b><i>11-11</i></div>',
  '      <div class="cl-body">',
  '        <h3>桌面便条：图片能点开看大图，纸也能拖着走、拉着改大小</h3>',
  '        <ul class="cl-list">',
  '          <li><b>点图片看大图。</b>便条里的截图以前只能看缩略图，现在点一下弹出一个独立的「看大图」窗口：滚轮以光标为中心缩放、按住拖动平移、双击回到适应大小、Esc 或 ✕ 关闭，窗口自己也能拖着标题栏移动。</li>',
  '          <li><b>整张纸都能拖着走。</b>以前只有顶部那一条（还被胶带挡住一半）能拖，现在纸边、留白、底部都能拖，正文区专门留给打字和选字。</li>',
  '          <li><b>右下角能改大小。</b>透明无边框窗口在 Windows 上没有系统缩放边框，所以自己做了右边、下边、右下角三条把手；拖完的尺寸会记住，下次打开还是这么大。</li>',
  '        </ul>',
  '      </div>',
  '    </article>',
  ''
].join('\n');

const anchor = '\n  </section>\n\n  <footer class="foot">';
if (!t.includes('<b>1.10.7</b><i>11-11</i>')) {
  if (!t.includes(anchor)) throw new Error('anchor not found');
  t = t.replace(anchor, entry + anchor);
  console.log('inserted 1.10.7 entry');
}

fs.writeFileSync(p, t, 'utf8');
console.log('len', t.length);
