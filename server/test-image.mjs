// 以第二台电脑身份上传并发送一张图片，用于测试客户端图片消息
import fs from 'node:fs';
const BASE = 'https://chat.ccyyqq.com/island';
const [code, file, name = 'office-pc'] = process.argv.slice(2);

const join = await fetch(BASE + '/api/rooms/join', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code, deviceName: name, replace: true })
}).then((r) => r.json());
if (!join.ok) throw new Error('join failed: ' + JSON.stringify(join));

const buf = fs.readFileSync(file);
const up = await fetch(BASE + '/api/upload', {
  method: 'POST',
  headers: { 'Content-Type': 'image/png' },
  body: buf
}).then((r) => r.json());
if (!up.ok) throw new Error('upload failed: ' + JSON.stringify(up));

const sent = await fetch(BASE + '/api/rooms/' + join.roomId + '/messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    deviceId: join.deviceId,
    token: join.token,
    kind: 'image',
    text: '看这个',
    mediaId: up.mediaId,
    clientId: 'img' + Date.now().toString(36)
  })
}).then((r) => r.json());
console.log('image sent', sent.ok, up.url, buf.length, 'bytes');
