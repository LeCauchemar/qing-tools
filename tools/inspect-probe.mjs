// 通过 --inspect-brk 启动的 Electron 主进程里执行表达式
// 用法: node tools/inspect-probe.mjs "<expr>" [port]
const port = process.argv[3] || '9301';
const expr = process.argv[2] || '1+1';

const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = list.find((t) => t.type === 'node') || list[0];
const ws = new WebSocket(target.webSocketDebuggerUrl);
let seq = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
});
const send = (method, params = {}) =>
  new Promise((res) => {
    const id = ++seq;
    pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
  });
await new Promise((res) => ws.addEventListener('open', res, { once: true }));
await send('Runtime.enable');
await send('Debugger.enable');
await send('Runtime.runIfWaitingForDebugger');
await new Promise((r) => setTimeout(r, 1200));
const out = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true, includeCommandLineAPI: true });
console.log(JSON.stringify(out.result, null, 2));
ws.close();
process.exit(0);
