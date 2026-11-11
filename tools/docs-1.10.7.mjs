import fs from 'node:fs';

let r = fs.readFileSync('README.md', 'utf8');
r = r.replaceAll('1.10.6', '1.10.7');
fs.writeFileSync('README.md', r, 'utf8');

const agentsPath = 'D:/deepseek harness daily/AGENTS.md';
let a = fs.readFileSync(agentsPath, 'utf8');
const add = [
  '',
  '## 1.10.7 便条看大图 / 拖动 / 缩放',
  '- 便条里的图片点击 → 独立「看大图」窗口（`src\\renderer\\viewer.html` + `viewer.js/css` + `src\\main\\viewer-preload.js`），主进程 `openViewer()` 创建：transparent + frameless + alwaysOnTop floating + 1180×880 上限；渲染层负责滚轮以光标为中心缩放（8%–800%）、拖动平移、双击还原，Esc/✕ 走 IPC `viewer:close`。',
  '- 桌面便条窗口是**透明无边框**的，Windows 上**没有系统缩放边框**（`resizable: true` 也没用）——缩放改由渲染层三条把手 `.rz-r/.rz-b/.rz-br` 实现：`pointerdown` 记 `screenX/screenY` 与 `innerWidth/innerHeight`，`pointermove` 用 rAF 合并后 `sticky.resize(w,h)` → 主进程 `ipcMain.on(\'sticky:resize\')` 里 `win.setSize()`；尺寸仍由 `resized/resize` 事件写回 `note.w/h`。',
  '- 拖动：`.paper` 设 `-webkit-app-region: drag`，`.note`/`.tools`/`.foot`/`.rz` 必须显式 `no-drag`，否则正文点不进去；以前只有顶部 `.grip`（还被胶带压住）能拖。',
  '- 图片点击要吞掉 `mousedown`（捕获阶段 `preventDefault`），否则 contenteditable 会先把光标挪到图前面。',
  '- `tools/cdp.mjs` 改用 `/json/list`：第二个及以后的 BrowserWindow（看大图窗口）有时不出现在 `/json` 里，`/json/list` 才全。',
  '- 测试便条时给 `api.notes.add()` 传**字符串**，传对象会存成 `[object Object]`；便条窗口的 `sticky:update` 在 `document.activeElement === note` 时会主动跳过（防覆盖正在输入），CDP 里要先 `blur()` 再推文本。',
  ''
].join('\n');
if (!a.includes('## 1.10.7 便条看大图')) {
  a = a.replace(/\s*$/, '\n') + add;
  fs.writeFileSync(agentsPath, a, 'utf8');
  console.log('agents ok');
} else {
  console.log('agents already');
}
console.log('readme', r.includes('QingTools-1.10.7-setup.exe'), r.includes('1.10.6'));
