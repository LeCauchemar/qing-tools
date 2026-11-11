import fs from 'node:fs';

const entry = `
    <article class="cl-item v5">
      <div class="cl-side"><b>1.10.6</b><i>11-10</i></div>
      <div class="cl-body">
        <h3>通知条底部的进度线，收回到药丸里面</h3>
        <ul class="cl-list">
          <li><b>线不再贴在药丸下沿。</b>收到消息弹出来的那条通知，底部有一根 2px 的倒计时进度线，原来是从窗口左边缘拉到右边缘、紧贴圆角下沿，看上去像一条浮在桌面上的细线；现在左右各缩 18px、抬高 7px、圆头 3px，整根都在深色药丸里面。</li>
          <li><b>配色跟着主题走。</b>进度用主题色混一点深色（82%），轨道只有 9% 的墨色 —— 深色主题不刺眼，浅色主题也不会消失。</li>
          <li><b>行为没变。</b>点击通知条仍按类型打开邮箱 / 小纸条，验证码那类点一下复制；进度线只是把「还能停留多久」画清楚。</li>
        </ul>
      </div>
    </article>
`;

const f = 'site/changelog.html';
let s = fs.readFileSync(f, 'utf8');
const anchor = '\n  </section>\n\n  <footer class="foot">';
if (!s.includes(anchor)) throw new Error('anchor missing');
s = s.replace(anchor, entry + anchor);
s = s.replace('<b>50</b><span>个可安装版本（1.0 → 1.10.5）</span>', '<b>51</b><span>个可安装版本（1.0 → 1.10.6）</span>');
s = s.replace(/QingTools-1\.10\.5-setup\.exe/g, 'QingTools-1.10.6-setup.exe');
s = s.replace(/QingTools-1\.10\.5-portable\.exe/g, 'QingTools-1.10.6-portable.exe');
s = s.replace('<span class="dim">v1.10.5</span>', '<span class="dim">v1.10.6</span>');
s = s.replace('从 1.0 到 1.10.5', '从 1.0 到 1.10.6');
s = s.replace('六天五十个版本', '六天五十一个版本');
s = s.replace('到 1.10.5，它替你收邮件', '到 1.10.6，它替你收邮件');
fs.writeFileSync(f, s);
console.log('changelog', s.length, s.includes('1.10.6'));

const g = 'site/index.html';
let t = fs.readFileSync(g, 'utf8');
const n = (t.match(/1\.10\.5/g) || []).length;
t = t.replace(/1\.10\.5/g, '1.10.6');
fs.writeFileSync(g, t);
console.log('index replaced', n);

let r = fs.readFileSync('README.md', 'utf8');
r = r.replace(/1\.10\.5/g, '1.10.6');
fs.writeFileSync('README.md', r);

let c = fs.readFileSync('CHANGELOG.md', 'utf8');
c = c.replace('从 1.0 到 1.10.5，六天里发了 50 个可安装版本', '从 1.0 到 1.10.6，六天里发了 51 个可安装版本').replace('到 1.10.5 它已经是一个', '到 1.10.6 它已经是一个');
const sec = '## 1.10.6 · 通知条进度线收回药丸内（11-10）\n\n- **取消全宽贴边**：`.peek-bar` 原来 `left/right:0; bottom:0; height:2px`，锚在岛矩形上、却不跟着圆角裁切，视觉上是一条浮在药丸下沿外面的细线。改成 `left/right:18px; bottom:7px; height:3px; border-radius:2px`，完全落在药丸内部。\n- **配色**：进度 `color-mix(in srgb, var(--accent) 82%, var(--ink))` + `opacity:.85`，轨道 `color-mix(in srgb, var(--ink) 9%, transparent)`，深浅两套主题都成立。\n- 通知条的行为（点击打开邮箱 / 小纸条、验证码点击复制、停留时长）未改。\n\n';
const anchor2 = '## 几个绕不过去的工程决定';
c = c.replace(anchor2, sec + anchor2);
fs.writeFileSync('CHANGELOG.md', c);
console.log('md ok');
