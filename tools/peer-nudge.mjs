// 以第二台设备加入指定房间，发一条「拍一拍」给指定设备
const BASE = process.env.QT_API || 'https://chat.ccyyqq.com/island';
const code = process.argv[2];
const target = process.argv[3];
const name = process.argv[4] || 'peer-nudger';

const post = async (path, body) => {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return { status: r.status, d: await r.json().catch(() => null) };
};

const join = await post('/api/rooms/join', { code, deviceName: name, replace: true });
if (!join.d || !join.d.ok) {
  console.log('join failed', join.status, JSON.stringify(join.d));
  process.exit(1);
}
const roomId = join.d.roomId;
const me = join.d.deviceId;
const token = join.d.token;
console.log('joined as', me, 'room', roomId);

const order = process.argv[5] || 'nudge';
let res;
if (order === 'nudge') {
  res = await post(`/api/rooms/${roomId}/messages`, {
    deviceId: me,
    token,
    kind: 'nudge',
    mentions: [target],
    clientId: 'peer-nudge-' + Date.now()
  });
} else {
  res = await post(`/api/rooms/${roomId}/messages`, {
    deviceId: me,
    token,
    kind: 'text',
    text: '@' + (process.argv[6] || 'chenyuqing-life') + ' 测试一下彩虹提醒',
    mentions: [target],
    clientId: 'peer-at-' + Date.now()
  });
}
console.log(order, res.status, JSON.stringify(res.d && res.d.message));
