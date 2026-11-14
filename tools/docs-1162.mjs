import fs from 'node:fs';

const AG = 'D:/deepseek harness daily/AGENTS.md';
const HO = 'D:/deepseek harness daily/dynamic-island/HANDOFF.md';

const agentsBlock = `
## 1.16.2 · 便条里的云端图片（2026-11-14）

1. 事项同步会把正文里的 \`[[img:<file>]]\` 改写成 \`[[img:cloud:<key>]]\`（\`sync.js\` 的 \`cloudify()\`），所以**任何渲染笔记图片的地方都必须按前缀分流**：\`cloud:\` → \`https://qing.ccyyqq.com/<key>\`，其余 → \`islandclip://note/<file>\`。主界面有 \`imgSrcOf()\`，便条窗口（\`sticky.js\`）**之前漏了**，于是钉到桌面就变成破图。
2. 便条窗口是独立 \`BrowserWindow\`，CSP 也独立：\`sticky.html\` 的 \`img-src\` 必须放行 \`https://qing.ccyyqq.com\`（以及 chat 域），否则即使 URL 对了也会被拦成破图。
3. 「看大图」窗口的 URL 由**主进程**拼（\`sticky:view\`），同一个 cloud 前缀要在主进程里再分流一次；标题用 \`云 key 的 basename\`，不要把 \`cloud:island/note/...\` 整串塞给用户看。
4. 便条里的图片加 \`error\` 兜底：\`.pic.bad\` 画一条虚线占位，不露出破图图标 + 巨大的 alt 字。
5. 验证手法：dev 里 \`api.notes.togglePin(id)\` 打开便条（**启动时不会自动重建便条窗口**，必须 pin 一次才会出现），CDP 用 \`DSH_CDP_MATCH=sticky.html\` / \`viewer.html\` 分别取两个窗口，断言 \`.pic\` 的 \`src\` 是 https 且 \`naturalWidth > 0\`、看大图窗口的 \`#img.naturalWidth\` 同样 > 0。
`;

let ag = fs.readFileSync(AG, 'utf8');
if (!ag.includes('## 1.16.2 · 便条里的云端图片')) ag = ag.replace(/\s*$/, '\n') + agentsBlock;
fs.writeFileSync(AG, ag, 'utf8');

const handoff = `## 2026-11-14 18:30 · 1.16.2 · DeepSeekRuntime
- 改了什么：便条窗口按前缀解析图片（\`cloud:\` 走又拍云 CDN、其余走 \`islandclip://\`），\`sticky.html\` 的 CSP 放行 CDN；主进程的 \`sticky:view\` 同步分流并改用文件名当「看大图」标题；图片加载失败时给虚线占位。
- 为什么：事项同步把图片改写成 \`cloud:<key>\` 之后，便条还按本地文件去取，钉到桌面上就是一张破图；点开看大图也拼错了 URL，于是「这张图读不出来」。
- 怎么验证：dev 与装机版各测一遍——便条里 \`.pic.src\` 是 \`https://qing.ccyyqq.com/island/note/...\`、\`naturalWidth 967\`；点图后看大图窗口 \`#img.naturalWidth 967\`、标题 \`dfba3dcd7cc14d5d3f.png\`；本地文件（无 cloud 前缀）仍走 \`islandclip://\`。
- 下一步 / 已知问题：图片在 CDN 上只增不删（删条目不回收对象）；便条窗口启动时不会自动重建，只有 pin 动作会开窗。

`;

let ho = fs.readFileSync(HO, 'utf8');
if (!ho.includes('1.16.2 · DeepSeekRuntime')) ho = ho.replace(/^/, handoff);
fs.writeFileSync(HO, ho, 'utf8');

console.log('agents', ag.length, ag.includes('\uFFFD'), 'handoff', ho.length);
