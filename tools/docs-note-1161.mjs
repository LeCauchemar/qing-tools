import fs from 'node:fs';

const agents = 'D:\\deepseek harness daily\\AGENTS.md';
let a = fs.readFileSync(agents, 'utf8');
if (!a.includes('## 1.16.1')) {
  const block = [
    '',
    '## 1.16.1 · 小纸条改两栏（11-14）',
    '',
    '- 面板宽度改在 `#stage[data-state="panel"] .island` 里覆盖成 `--isl-w: 640px`（原 576）；所有页签一起变宽，已验证六个页签都没有横向溢出。',
    '- 小纸条结构：`.chat-split`（`display:grid; grid-template-columns: 150px minmax(0,1fr)`）→ 左 `.chat-side`（频道 + 好友），右 `.chat-main`（gate / chat-room）。左右各自 `min-height:0` + `overflow-y`，拉高窗口只有消息区变长。',
    '- 左栏里 `.rooms` / `.cp-list` 必须改 `flex-direction: column`、子项 `width: 100%`；`.room-chip .r-copy/.r-exit` 默认 `opacity:0`，hover 或 `.active` 才露出（否则 150px 会挤成一团）。',
    '- 左栏「+」按钮走 `data-act="chat-new"` → `window.confirm` → `chatCreate()`；已有两个频道时先 toast 拦掉。',
    '- 验证方法：`tools\\m7b-audit.js`（量矩形 + 两两重叠检测）、`tools\\m7b-audit2.js`（内存里造两个频道 + 三个好友，测完还原）、`tools\\m7b-gate.js`（未加入时的 gate 是否溢出）。',
    ''
  ].join('\n');
  a = a.trimEnd() + '\n' + block;
  fs.writeFileSync(agents, a);
  console.log('agents', a.length, a.includes('\uFFFD'));
} else {
  console.log('agents already');
}

const handoff = 'HANDOFF.md';
let h = fs.readFileSync(handoff, 'utf8');
if (!h.includes('1.16.1 · DeepSeekRuntime')) {
  const entry = [
    '## 2026-11-14 17:40 · 1.16.1 · DeepSeekRuntime',
    '',
    '- 改了什么：小纸条页改成左频道/好友、右消息的两栏布局，面板加宽到 640px；频道与好友都改成整行竖向排列，频道上的复制/退出图标改成悬停才出现；左栏顶部加了新建频道按钮。',
    '- 为什么：原来频道 chip 横排换行、好友条也横排，元素挤在一起还有重叠。',
    '- 怎么验证：dev（CDP 9451，`QT_DATA_DIR=D:\\temp\\qt-chat`）用 `tools\\m7b-audit.js` 量到面板 640×448、左栏 150×344、消息区 460×250，两两重叠 0 项；`m7b-audit2.js` 造两个频道 + 三个好友后左栏 7 个元素自上而下不重叠（频道 30px、好友 28px 行高）；`m7b-tabs.js` 六个页签 `scrollWidth == clientWidth`。',
    '- 下一步 / 已知问题：好友区在未登录时整块隐藏（后端好友列表需要登录），登录后才会出现；`chat-new` 是直接建频道，没有单独的建频道表单。',
    ''
  ].join('\n');
  h = entry + h;
  fs.writeFileSync(handoff, h);
  console.log('handoff', h.length);
} else {
  console.log('handoff already');
}
