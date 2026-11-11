// 量官网在指定视口下的真实布局：先按视口尺寸开窗，再导航，避免窗口尺寸被会话恢复覆盖
// 用法: node tools/site-probe.mjs <url> <width> <height> [js表达式]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const url = process.argv[2] || 'https://qingtools.ccyyqq.com/';
const W = Number(process.argv[3] || 430);
const H = Number(process.argv[4] || 920);
const expr = process.argv[5] || `(() => {
  const out = [];
  document.querySelectorAll('body *').forEach((n) => {
    const b = n.getBoundingClientRect();
    if (b.width > 0 && b.right > innerWidth + 1) out.push({ tag: n.tagName.toLowerCase(), cls: String(n.className).slice(0, 36), w: Math.round(b.width), r: Math.round(b.right) });
  });
  return { vw: innerWidth, vh: innerHeight, docW: document.documentElement.scrollWidth, bodyW: document.body.scrollWidth, over: out.slice(0, 14) };
})()`;

const edge = ['C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p));
const port = 9400 + Math.floor(Math.random() * 300);
const profile = path.join(os.tmpdir(), 'qt-probe-' + Date.now());
const child = spawn(edge, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${port}`, `--window-size=${W},${H}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore', windowsHide: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let wsUrl = '';
for (let i = 0; i < 60; i++) {
  await sleep(200);
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const page = list.find((t) => t.type === 'page');
    if (page) { wsUrl = page.webSocketDebuggerUrl; break; }
  } catch {}
}
if (!wsUrl) { console.error('no target'); child.kill(); process.exit(1); }

const ws = new WebSocket(wsUrl);
let id = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m.error); pending.delete(m.id); }
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await new Promise((r) => ws.addEventListener('open', r));

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url });
await sleep(2200);
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await sleep(600);
const out = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
console.log(JSON.stringify(out?.result?.value ?? out, null, 2));
try { ws.close(); } catch {}
child.kill();
process.exit(0);
