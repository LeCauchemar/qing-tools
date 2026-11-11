// 官网演示台在多种视口宽度下的布局自检
import { spawn } from 'node:child_process';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const WIDTHS = [1440, 900, 700, 620, 520, 430, 375];
const BASE = 'file:///D:/deepseek%20harness%20daily/dynamic-island/site/index.html';

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function cdp(port, expr) {
  const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const page = list.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });
  const call = (id, method, params) =>
    new Promise((res) => {
      const onMsg = (e) => {
        const m = JSON.parse(e.data);
        if (m.id !== id) return;
        ws.removeEventListener('message', onMsg);
        res(m.result);
      };
      ws.addEventListener('message', onMsg);
      ws.send(JSON.stringify({ id, method, params }));
    });
  return { ws, call };
}

const PROBE = `(() => {
  const st = document.querySelector('#stage');
  if (!st) return JSON.stringify({ err: 'no stage' });
  const isl = document.querySelector('#isl');
  const wall = document.querySelector('.wall');
  const r = isl.getBoundingClientRect();
  const w = wall.getBoundingClientRect();
  const body = document.querySelector('.p-body');
  const tabs = document.querySelector('.p-tabs');
  return JSON.stringify({
    vw: innerWidth,
    sc: getComputedStyle(st).getPropertyValue('--sc').trim() || '1',
    state: st.dataset.state,
    isl: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    wall: { x: Math.round(w.x), y: Math.round(w.y), w: Math.round(w.width), h: Math.round(w.height) },
    fitsX: r.left >= w.left - 1 && r.right <= w.right + 1,
    fitsY: r.bottom <= w.bottom + 1,
    tabsOverflow: tabs ? tabs.scrollWidth - tabs.clientWidth : null,
    bodyOverflow: body ? body.scrollHeight - body.clientHeight : null,
    docW: document.documentElement.scrollWidth
  });
})()`;

for (const width of WIDTHS) {
  const port = 9400 + WIDTHS.indexOf(width);
  const child = spawn(
    EDGE,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${process.env.TEMP}\\edge-probe-${port}`,
      `--window-size=${width},1100`,
      `${BASE}?nofx=1&state=panel`
    ],
    { stdio: 'ignore', detached: false }
  );
  await wait(3200);
  let data;
  try {
    const { ws, call } = await cdp(port);
    await call(9, 'Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: true
    });
    await wait(600);
    const out = await call(1, 'Runtime.evaluate', {
      expression: PROBE,
      awaitPromise: true,
      returnByValue: true
    });
    data = out.result && out.result.value;
    ws.close();
  } catch (e) {
    data = JSON.stringify({ err: String(e.message || e) });
  }
  console.log(width, data);
  child.kill();
  await wait(300);
}
