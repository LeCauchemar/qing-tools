// 按指定视口宽度给官网演示台截图（走 CDP 设备模拟，绕开 Edge 的最小窗口宽度）
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = 'file:///D:/deepseek%20harness%20daily/dynamic-island/site/index.html';
const [, , widthArg = '430', stateArg = 'panel', outArg = 'shots/380-demo-mobile.png'] = process.argv;
const width = Number(widthArg);
const port = 9600 + (width % 100);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const child = spawn(
  EDGE,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${process.env.TEMP}\\edge-shot-${port}`,
    '--window-size=900,1200',
    `${BASE}?nofx=1&state=${stateArg}`
  ],
  { stdio: 'ignore' }
);
await wait(3500);

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

await call(1, 'Emulation.setDeviceMetricsOverride', {
  width,
  height: 900,
  deviceScaleFactor: 2,
  mobile: true
});
await wait(500);
const ev = await call(2, 'Runtime.evaluate', {
  expression: `(() => {
    const d = document.querySelector('#demo');
    d.scrollIntoView({ block: 'start' });
    const s = document.querySelector('#stage').getBoundingClientRect();
    const b = document.querySelector('.stage-bar').getBoundingClientRect();
    return JSON.stringify({ y: Math.round(s.y - b.height + 8), h: Math.round(s.height + b.height + 16), vw: innerWidth });
  })()`,
  returnByValue: true
});
const info = JSON.parse(ev.result.value);
await call(3, 'Runtime.evaluate', { expression: `window.scrollBy(0, ${info.y}); 1`, returnByValue: true });
await wait(700);
const shot = await call(4, 'Page.captureScreenshot', {
  format: 'png',
  captureBeyondViewport: false,
  clip: { x: 0, y: 0, width, height: Math.min(info.h, 900), scale: 1 }
});
fs.writeFileSync(outArg, Buffer.from(shot.data, 'base64'));
console.log(JSON.stringify({ out: outArg, width, state: stateArg, height: info.h }));
ws.close();
child.kill();
