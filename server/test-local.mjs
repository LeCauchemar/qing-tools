// 本地端到端自测：建房 → 第二台设备加入 → 发消息 → SSE 收到 → 换机替换 → 满员拒绝
const BASE = process.env.ISLAND_BASE || 'http://127.0.0.1:3311/island';

const post = async (p, body, headers = {}) => {
  const r = await fetch(BASE + p, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });
  return r.json();
};
const get = async (p) => (await fetch(BASE + p)).json();

const uniq = Math.random().toString(36).slice(2, 8);
const dev1 = 'dev-' + uniq + '-a';
const dev2 = 'dev-' + uniq + '-b';

const created = await post('/api/rooms', { deviceId: dev1, deviceName: 'chenyuqing-life' });
console.log('create:', created.ok, created.code, created.members.map((m) => m.name));
const { roomId, token, code } = created;

// SSE 监听
const events = [];
const ac = new AbortController();
const sse = fetch(`${BASE}/api/stream?room=${roomId}&device=${dev1}&token=${token}`, {
  signal: ac.signal
}).then(async (res) => {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const ev = /event: (\w+)/.exec(chunk)?.[1];
      const data = /data: (.*)/.exec(chunk)?.[1];
      if (ev) events.push({ ev, data: data ? JSON.parse(data) : null });
    }
  }
}).catch(() => {});
await new Promise((r) => setTimeout(r, 400));

// 第二台设备
const joined = await post('/api/rooms/join', { code, deviceId: dev2, deviceName: 'office-pc' });
console.log('join:', joined.ok, joined.members.map((m) => m.name + (m.online ? '(在线)' : '')).join(','));

// 发消息
const sent = await post(`/api/rooms/${roomId}/messages`, {
  deviceId: dev2, token: joined.token, kind: 'text', text: '晚上吃什么？', clientId: 'c1'
});
console.log('send:', sent.ok, sent.message.text);
const dup = await post(`/api/rooms/${roomId}/messages`, {
  deviceId: dev2, token: joined.token, kind: 'text', text: '晚上吃什么？', clientId: 'c1'
});
console.log('dedupe:', dup.ok, !!dup.duplicated);

// 上传图片
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);
const upRes = await fetch(BASE + '/api/upload', {
  method: 'POST',
  headers: { 'Content-Type': 'image/png' },
  body: png
});
const up = await upRes.json();
console.log('upload:', up.ok, up.mediaId, up.bytes);
const imgSent = await post(`/api/rooms/${roomId}/messages`, {
  deviceId: dev1, token, kind: 'image', mediaId: up.mediaId
});
console.log('image msg:', imgSent.ok, imgSent.message.url);
const imgBack = await fetch('http://127.0.0.1:3311' + imgSent.message.url);
console.log('image fetch:', imgBack.status, imgBack.headers.get('content-type'), (await imgBack.arrayBuffer()).byteLength);

// 历史
const hist = await get(`/api/rooms/${roomId}/messages?device=${dev1}&token=${token}`);
console.log('history:', hist.messages.map((m) => m.kind + ':' + (m.text || m.mediaId)).join(' | '));

// 换机替换
const clash = await post('/api/rooms/join', { code, deviceId: 'dev-new', deviceName: 'office-pc' });
console.log('name clash:', clash.ok, clash.code);
const replaced = await post('/api/rooms/join', { code, deviceId: 'dev-new', deviceName: 'office-pc', replace: true });
console.log('replace:', replaced.ok, replaced.members.map((m) => m.name + (m.replacedFrom ? '[替换]' : '')).join(','));

// 满员
await post('/api/rooms/join', { code, deviceId: 'dev-3', deviceName: 'pc-3' });
await post('/api/rooms/join', { code, deviceId: 'dev-4', deviceName: 'pc-4' });
const full = await post('/api/rooms/join', { code, deviceId: 'dev-5', deviceName: 'pc-5' });
console.log('full:', full.ok, full.code, full.message);

// 错码
const bad = await post('/api/rooms/join', { code: 'AAAAAAAAAAAA', deviceId: 'x', deviceName: 'x' });
console.log('bad code:', bad.ok, bad.code);

await new Promise((r) => setTimeout(r, 400));
console.log('sse events:', events.map((e) => e.ev).join(','));
console.log('sse message payload:', JSON.stringify(events.find((e) => e.ev === 'message')?.data?.message?.text));
ac.abort();
process.exit(0);
