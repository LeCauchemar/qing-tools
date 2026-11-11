// 在已开着的页面上执行一段表达式并打印结果
const port = process.env.PORT || 9333;
const expr = process.argv[2] || '1+1';

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
const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
console.log(JSON.stringify(r.result && r.result.result ? r.result.result.value : r.result, null, 0));
ws.close();
