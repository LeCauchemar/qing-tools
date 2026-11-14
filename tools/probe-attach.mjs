// 用装机版里的账号 token + 频道设备 token，直接打 /attach，验证服务端补丁
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const http = require('node:http');

const PORT = process.env.DSH_CDP_PORT || '9223';

async function targets() {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  return r.json();
}

function evalIn(wsUrl, expr) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true } }));
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id === 1) {
        ws.close();
        resolve(m.result && m.result.result ? m.result.result.value : null);
      }
    };
    ws.onerror = (e) => reject(new Error('ws error'));
    setTimeout(() => reject(new Error('timeout')), 8000);
  });
}

const list = await targets();
const page = list.find((t) => t.type === 'page' && /index\.html/.test(t.url));
if (!page) throw new Error('no page');
const info = await evalIn(page.webSocketDebuggerUrl, `(()=>{const r=(S.chat.rooms||[])[0]||{};return {roomId:r.roomId,deviceId:r.deviceId,token:r.token,at:S.account.userToken||''}})()`);
console.log('room', info.roomId, 'device', info.deviceId, 'tokenLen', (info.at || '').length);

const body = JSON.stringify({ deviceId: info.deviceId, token: info.token });
const res = await fetch(`https://chat.ccyyqq.com/island/api/rooms/${info.roomId}/attach`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: 'Bearer ' + info.at },
  body
});
console.log('attach', res.status, await res.text());

const info2 = await fetch(`https://chat.ccyyqq.com/island/api/rooms/${info.roomId}/info?deviceId=${info.deviceId}&token=${encodeURIComponent(info.token)}`);
const j = await info2.json();
console.log('members', JSON.stringify((j.members || []).map((m) => ({ n: m.name, u: m.userId || null, me: !!m.me }))));
