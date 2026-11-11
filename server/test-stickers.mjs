const API = 'https://chat.ccyyqq.com/island/api';
const j = async (r) => ({ status: r.status, data: await r.json().catch(() => ({})) });

const created = await fetch(API + '/rooms', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ deviceName: 'sticker-test' })
}).then(j);
const s = created.data;
console.log('create', created.status, s.code, s.roomId, !!s.token);

// 上传一张 png（build/icon-256.png）
const fs = await import('node:fs/promises');
const buf = await fs.readFile('build/icon-256.png');
const up = await fetch(API + '/upload', {
  method: 'POST',
  headers: { 'Content-Type': 'image/png' },
  body: buf
}).then(j);
console.log('upload', up.status, JSON.stringify(up.data));

const mediaId = up.data.mediaId;
const add = await fetch(`${API}/rooms/${s.roomId}/stickers`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ deviceId: s.deviceId, token: s.token, mediaId, name: '开心' })
}).then(j);
console.log('sticker add', add.status, JSON.stringify(add.data).slice(0, 220));

const add2 = await fetch(`${API}/rooms/${s.roomId}/stickers`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ deviceId: s.deviceId, token: s.token, mediaId, name: '开心' })
}).then(j);
console.log('dup', add2.status, add2.data.duplicated === true);

const list = await fetch(`${API}/rooms/${s.roomId}/stickers?device=${s.deviceId}&token=${s.token}`).then(j);
console.log('list', list.status, 'count', (list.data.stickers || []).length, list.data.stickers?.[0]?.url);

const info = await fetch(`${API}/rooms/${s.roomId}?device=${s.deviceId}&token=${s.token}`).then(j);
console.log('info has stickers', Array.isArray(info.data.stickers), info.data.stickers?.length);

// 以表情方式发送
const send = await fetch(`${API}/rooms/${s.roomId}/messages`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ deviceId: s.deviceId, token: s.token, kind: 'sticker', mediaId, clientId: 'c-test-sticker' })
}).then(j);
console.log('send sticker', send.status, send.data.message?.kind, send.data.message?.url);

const rm = await fetch(`${API}/rooms/${s.roomId}/stickers/${add.data.sticker.id}/remove`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ deviceId: s.deviceId, token: s.token })
}).then(j);
console.log('remove', rm.status, (rm.data.stickers || []).length);
