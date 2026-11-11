// 端到端验证：缩略图预热 + 拍一拍 + @提醒
import fs from 'node:fs';

const BASE = process.env.QT_API || 'https://chat.ccyyqq.com/island';

async function j(path, opt) {
  const r = await fetch(BASE + path, opt);
  const t = await r.text();
  let d = null;
  try {
    d = JSON.parse(t);
  } catch {
    d = { raw: t.slice(0, 200) };
  }
  return { status: r.status, d };
}

const post = (path, body) =>
  j(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const a = await post('/api/rooms', { deviceName: 'nudge-a' });
const code = a.d.code;
const roomId = a.d.roomId;
const b = await post('/api/rooms/join', { code, deviceName: 'nudge-b' });
console.log('room', code, 'a', a.d.deviceId, 'b', b.d.deviceId);

// 1) 上传图片：应当等缩略图好了才返回
const buf = fs.readFileSync(process.argv[2] || 'build/icon-256.png');
const up = await fetch(BASE + '/api/upload', {
  method: 'POST',
  headers: { 'Content-Type': 'image/png' },
  body: buf
});
const upJson = await up.json();
console.log('upload', up.status, {
  thumbReady: upJson.thumbReady,
  cloud: upJson.cloud,
  thumb: upJson.thumb
});
if (upJson.thumb) {
  const t = await fetch(upJson.thumb);
  console.log('thumb GET', t.status, t.headers.get('content-type'), (await t.arrayBuffer()).byteLength);
}

// 2) 发图片消息，B 能拿到 thumb
const img = await post(`/api/rooms/${roomId}/messages`, {
  deviceId: a.d.deviceId,
  token: a.d.token,
  kind: 'image',
  mediaId: upJson.mediaId,
  clientId: 'cli-img-1'
});
console.log('img msg thumb', img.d.message && img.d.message.thumb);

// 3) A 拍 B
const nd = await post(`/api/rooms/${roomId}/messages`, {
  deviceId: a.d.deviceId,
  token: a.d.token,
  kind: 'nudge',
  mentions: [b.d.deviceId],
  clientId: 'cli-nudge-1'
});
console.log('nudge', nd.status, nd.d.message && { kind: nd.d.message.kind, mentions: nd.d.message.mentions });

// 4) A 发一条 @B 的文字
const at = await post(`/api/rooms/${roomId}/messages`, {
  deviceId: a.d.deviceId,
  token: a.d.token,
  kind: 'text',
  text: '@nudge-b 看这里',
  mentions: [b.d.deviceId],
  clientId: 'cli-at-1'
});
console.log('at', at.status, at.d.message && { text: at.d.message.text, mentions: at.d.message.mentions });

// 5) 历史里 mentions 是否持久化
const hist = await j(`/api/rooms/${roomId}/messages?device=${b.d.deviceId}&token=${b.d.token}`);
const rows = hist.d.messages || [];
console.log('history', rows.map((m) => ({ kind: m.kind, mentions: m.mentions, thumb: !!m.thumb })));

// 6) 收尾：两个设备退出
await post(`/api/rooms/${roomId}/leave`, { deviceId: a.d.deviceId, token: a.d.token });
await post(`/api/rooms/${roomId}/leave`, { deviceId: b.d.deviceId, token: b.d.token });
console.log('cleaned');
