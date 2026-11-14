// 对指定窗口（DSH_CDP_MATCH）整页截图：node tools/shot-target.mjs shots/out.png
const [, , out] = process.argv;
const port = process.env.DSH_CDP_PORT || '9222';
const match = process.env.DSH_CDP_MATCH || 'index.html';
const fs = await import('node:fs');

const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = targets.find((t) => t.type === 'page' && t.url.includes(match));
if (!page) {
  console.error('no target for', match, targets.map((t) => t.url));
  process.exit(1);
}
const ws = new WebSocket(page.webSocketDebuggerUrl);
let seq = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
});
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
const send = (method, params) =>
  new Promise((resolve) => {
    const id = ++seq;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });

const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
if (!shot.result || !shot.result.data) {
  console.error(JSON.stringify(shot).slice(0, 400));
  process.exit(1);
}
fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
console.log('saved', out, 'bytes', fs.statSync(out).size);
ws.close();
