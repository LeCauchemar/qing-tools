// M6 自测：绑定 + 分享收发
const BASE = process.env.BASE || 'http://127.0.0.1:3399';
let pass = 0;
let failed = 0;
function chk(name, ok, extra) {
  if (ok) {
    pass++;
    console.log('  ok   ' + name);
  } else {
    failed++;
    console.log('  FAIL ' + name + (extra ? '  ' + JSON.stringify(extra) : ''));
  }
}
async function call(method, p, body, token) {
  const res = await fetch(BASE + p, {
    method,
    headers: Object.assign({ 'content-type': 'application/json' }, token ? { authorization: 'Bearer ' + token } : {}),
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}
const tag = Math.random().toString(36).slice(2, 7);
const A = 'm6a' + tag;
const B = 'm6b' + tag;

const ra = await call('POST', '/api/auth/register', { username: A, password: 'pass12345', deviceName: 'devA' });
chk('register A', ra.status === 200 && ra.data.ok, ra.data);
const rb = await call('POST', '/api/auth/register', { username: B, password: 'pass12345', deviceName: 'devB' });
chk('register B', rb.status === 200 && rb.data.ok, rb.data);
const ta = ra.data.token;
const tb = rb.data.token;

let r = await call('POST', '/api/bindings', { username: B }, ta);
chk('A 申请绑定 B', r.status === 200 && r.data.ok && r.data.accepted === false, r.data);
const bindId = r.data.id;

r = await call('GET', '/api/bindings', undefined, tb);
chk('B 看到 1 条待处理', r.data.incoming && r.data.incoming.length === 1, r.data);

r = await call('POST', `/api/bindings/${bindId}/accept`, {}, tb);
chk('B 同意', r.data.ok && r.data.accepted, r.data);

r = await call('GET', '/api/bindings', undefined, ta);
chk('A 好友 1 个', r.data.friends && r.data.friends.length === 1 && r.data.friends[0].username === B, r.data.friends);

r = await call('POST', '/api/shares', { toUserId: rb.data.user.id, kind: 'note', text: '一起吃火锅' }, ta);
chk('A 分享事项', r.status === 200 && r.data.ok, r.data);

r = await call('GET', '/api/shares/inbox', undefined, tb);
chk('B 收件箱 1 条', r.data.items && r.data.items.length === 1 && r.data.items[0].item.text === '一起吃火锅', r.data);
const shareId = r.data.items[0].id;

r = await call('POST', `/api/shares/${shareId}/read`, {}, tb);
chk('B 标记已读', r.data.ok, r.data);
r = await call('GET', '/api/shares/inbox', undefined, tb);
chk('已读后收件箱空', r.data.items.length === 0, r.data);

r = await call('POST', '/api/bindings', { username: A }, ta);
chk('不能绑定自己', r.data.code === 'bad_request', r.data);

r = await call('POST', '/api/shares', { toUserId: rb.data.user.id, kind: 'note', text: 'x' }, ta);
chk('仍能分享（好友）', r.status === 200, r.data);

r = await call('DELETE', `/api/bindings/${bindId}`, undefined, ta);
chk('解除绑定', r.data.ok && r.data.removed, r.data);
r = await call('GET', '/api/bindings', undefined, tb);
chk('B 好友清零', r.data.friends.length === 0, r.data.friends);

r = await call('POST', '/api/shares', { toUserId: rb.data.user.id, kind: 'note', text: 'y' }, ta);
chk('非好友分享被拒', r.status === 403 && r.data.code === 'not_friend', r.data);

r = await call('GET', '/api/bindings', undefined, null);
chk('未登录 401', r.status === 401, r.data);

console.log(`\n${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
