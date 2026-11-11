// 用 CDP 给已经开着的页面截一张（可先执行一段表达式再截）
const port = process.env.PORT || 9333;
const out = process.argv[2] || 'shots/site-shot.png';
const expr = process.argv[3] || '';
const waitMs = Number(process.env.WAIT || 900);
const fs = await import('node:fs');

const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const t = list.find((x) => x.type === 'page');
if (!t) {
  console.log('no page');
  process.exit(1);
}
const ws = new WebSocket(t.webSocketDebuggerUrl);
let seq = 0;
const pend = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) {
    pend.get(m.id)(m);
    pend.delete(m.id);
  }
});
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
const send = (method, params) => {
  const id = ++seq;
  return new Promise((res) => {
    pend.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
  });
};

if (expr) await send('Runtime.evaluate', { expression: expr, awaitPromise: true });
await new Promise((r) => setTimeout(r, waitMs));
const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
console.log('saved', out);
ws.close();
