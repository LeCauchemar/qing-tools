// 以「第二台电脑」身份往匹配码里发一条消息，用于测试客户端实时接收
const BASE = 'https://chat.ccyyqq.com/island';
const code = process.argv[2];
const text = process.argv[3] || '来自另一台电脑的纸条';
const name = process.argv[4] || 'office-pc';

const j = async (path, opts) => {
  const res = await fetch(BASE + path, {
    method: (opts && opts.method) || 'GET',
    headers: opts && opts.body ? { 'Content-Type': 'application/json' } : undefined,
    body: opts && opts.body ? JSON.stringify(opts.body) : undefined
  });
  return { status: res.status, data: await res.json() };
};

const join = await j('/api/rooms/join', { method: 'POST', body: { code, deviceName: name, replace: true } });
if (!join.data.ok) {
  console.log('join failed', join.status, join.data);
  process.exit(1);
}
const { roomId, deviceId, token } = join.data;
const sent = await j('/api/rooms/' + roomId + '/messages', {
  method: 'POST',
  body: { deviceId, token, kind: 'text', text, clientId: 'x' + Date.now().toString(36) }
});
console.log('sent', sent.status, sent.data.ok, text);
