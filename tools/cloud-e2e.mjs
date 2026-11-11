// 端到端验证：建房 → 上传图片（走又拍云）→ 发消息 → 检查 url/thumb
import fs from 'node:fs';
const API = process.env.API || 'https://chat.ccyyqq.com/island';
const png = fs.readFileSync('build/icon-256.png');

const post = async (p, body) => {
  const r = await fetch(API + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json();
};

const room = await post('/api/rooms', { deviceName: 'cloud-test' });
console.log('room', room.code, room.roomId);
const up = await fetch(`${API}/api/upload?room=${room.roomId}`, {
  method: 'POST',
  headers: { 'Content-Type': 'image/png' },
  body: png
});
const media = await up.json();
console.log('upload', up.status, { cloud: media.cloud, url: media.url, thumb: media.thumb, bytes: media.bytes });

const msg = await post(`/api/rooms/${room.roomId}/messages`, {
  deviceId: room.deviceId,
  token: room.token,
  kind: 'image',
  mediaId: media.mediaId,
  clientId: 'c' + Date.now()
});
console.log('send', msg.ok, msg.message ? msg.message.url : '', msg.message ? msg.message.thumb : '');

const img = await fetch(media.url);
console.log('GET full ', img.status, img.headers.get('content-type'), (await img.arrayBuffer()).byteLength);
const th = await fetch(media.thumb);
console.log('GET thumb', th.status, th.headers.get('content-type'), (await th.arrayBuffer()).byteLength);
