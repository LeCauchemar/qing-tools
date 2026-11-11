// 连到已经开着 --remote-debugging-port 的浏览器，采样演示台状态序列
const port = process.env.PORT || 9333;
const url = process.env.URL_MATCH || 'site/index.html';

const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const target = list.find((t) => t.type === 'page' && t.url.includes(url));
if (!target) {
  console.log('no page target; got:', list.map((t) => t.url).join(' | '));
  process.exit(1);
}

const ws = new WebSocket(target.webSocketDebuggerUrl);
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

function send(method, params) {
  const id = ++seq;
  return new Promise((resolve) => {
    pend.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function val(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result && r.result.exceptionDetails) return 'EXC ' + r.result.exceptionDetails.text;
  return r.result && r.result.result ? r.result.result.value : null;
}

const round = Number(process.env.ROUNDS || 14);
const gap = Number(process.env.GAP || 900);
const seen = [];
for (let i = 0; i < round; i++) {
  const row = await val(
    'JSON.stringify({s:document.getElementById("stage").dataset.state,' +
      ' tab:(document.querySelector("#stage .p-tab.active")||{}).textContent,' +
      ' step:(document.getElementById("demoStep")||{}).textContent,' +
      ' cur:(document.getElementById("cur")||{}).style.transform})'
  );
  seen.push(row);
  await new Promise((r) => setTimeout(r, gap));
}
seen.forEach((r, i) => console.log(String(i).padStart(2, '0'), r));
ws.close();
