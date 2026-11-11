// 调试用：通过 CDP 操作渲染进程 / 截图
// 用法: node tools/cdp.mjs "<js 表达式>" [out.png]
//       node tools/cdp.mjs "@tools\script.js" [out.png]   ← 从文件读取表达式
const [, , rawExpr, out] = process.argv;

let expr = rawExpr;
if (expr && expr.startsWith('@')) {
  const fs = await import('node:fs');
  expr = fs.readFileSync(expr.slice(1), 'utf8');
}

const targets = await (await fetch(`http://127.0.0.1:${process.env.DSH_CDP_PORT || 9222}/json/list`)).json();
// 桌面上可能还开着小便条窗口；DSH_CDP_MATCH 可以指定目标（例如 sticky.html）
const match = process.env.DSH_CDP_MATCH;
const page = match
  ? targets.find((t) => t.type === 'page' && t.url.includes(match))
  : targets.find((t) => t.type === 'page' && /index\.html/.test(t.url)) ||
    targets.find((t) => t.type === 'page');
if (!page) {
  console.error('no page target');
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
let seq = 0;
const pending = new Map();

ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});

await new Promise((res, rej) => {
  ws.addEventListener('open', res);
  ws.addEventListener('error', rej);
});

const send = (method, params = {}) =>
  new Promise((res) => {
    const id = ++seq;
    pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
  });

if (expr) {
  const r = await send('Runtime.evaluate', {
    expression: expr,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true
  });
  const res = r.result || {};
  if (res.exceptionDetails) {
    console.log('EXCEPTION:', JSON.stringify(res.exceptionDetails.exception || res.exceptionDetails, null, 2));
  } else {
    console.log(typeof res.result?.value === 'string' ? res.result.value : JSON.stringify(res.result?.value, null, 2));
  }
}

if (out) {
  const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  const fs = await import('node:fs');
  fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
  console.log('saved', out);
}

ws.close();
process.exit(0);
