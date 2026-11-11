// 用 CDP 截「岛上那一块」：先跑一段表达式把界面摆好，再按 island 的矩形裁一张 PNG。
// 用法: node tools\cap.mjs shots\xxx.png "<js 表达式>"
import fs from 'node:fs';
import path from 'node:path';

const out = process.argv[2] || 'shots\\cap.png';
let expr = process.argv[3] || '';
if (expr.startsWith('@')) expr = fs.readFileSync(expr.slice(1), 'utf8');
const port = process.env.DSH_CDP_PORT || '9222';

const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = list.find((t) => t.type === 'page' && /index\.html/.test(t.url)) || list.find((t) => t.type === 'page');
if (!page) {
  console.error('no page');
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  const p = pending.get(msg.id);
  if (p) {
    pending.delete(msg.id);
    p(msg);
  }
});
await new Promise((r) => ws.addEventListener('open', r));
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const mid = ++id;
    pending.set(mid, resolve);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });

const run = async (code) => {
  const r = await send('Runtime.evaluate', { expression: code, awaitPromise: true, returnByValue: true });
  if (r.result && r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
  return r.result && r.result.result ? r.result.result.value : null;
};

if (expr) await run(expr);
// 光标不在岛上时渲染层会自己收起，截图前假装鼠标在上面
await run('S.pointerIn=true');
await new Promise((r) => setTimeout(r, 900));

const rect = await run(
  "(()=>{const r=document.getElementById('island').getBoundingClientRect();return JSON.stringify({x:r.x,y:r.y,w:r.width,h:r.height})})()"
);
const box = JSON.parse(rect);
const pad = 26;
const clip = {
  x: Math.max(0, box.x - pad),
  y: Math.max(0, box.y - 8),
  width: Math.min(4000, box.w + pad * 2),
  height: box.h + 26,
  scale: 2
};
const shot = await send('Page.captureScreenshot', { format: 'png', clip, fromSurface: true });
const buf = Buffer.from(shot.result.data, 'base64');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, buf);
console.log(JSON.stringify({ out, box, bytes: buf.length }));
ws.close();
