// 轮询看大图窗口的位置/缩放，确认是否有东西在「把它挪走 / 放大」
const port = process.env.DSH_CDP_PORT || '9223';
const expr = `JSON.stringify({x:window.screenX,y:window.screenY,z:document.querySelector('#zoom').textContent,sw:innerWidth,sh:innerHeight})`;

async function targets() {
  const res = await fetch(`http://127.0.0.1:${port}/json/list`);
  return res.json();
}

async function evalIn(wsUrl, expression) {
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  ws.send(
    JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: { expression, returnByValue: true }
    })
  );
  const msg = await new Promise((r) => ws.addEventListener('message', (e) => r(JSON.parse(e.data))));
  ws.close();
  return msg?.result?.result?.value;
}

let i = 0;
const timer = setInterval(async () => {
  i++;
  try {
    const list = await targets();
    const v = list.find((t) => (t.url || '').includes('viewer.html'));
    if (!v) {
      console.log(`${i * 500}ms viewer=GONE targets=${list.length}`);
    } else {
      console.log(`${i * 500}ms ${await evalIn(v.webSocketDebuggerUrl, expr)}`);
    }
  } catch (err) {
    console.log(`${i * 500}ms err ${err.message}`);
  }
  if (i >= Number(process.env.PROBE_N || 12)) clearInterval(timer);
}, 500);
