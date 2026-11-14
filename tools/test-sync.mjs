// M7 自测：Qing 事项增量同步（items / changes / 冲突副本 / SSE / 图片直传）
const BASE = process.env.BASE || 'http://127.0.0.1:3399';
let pass = 0;
let failed = 0;
function chk(name, ok, extra) {
  if (ok) {
    pass++;
    console.log('  ok   ' + name);
  } else {
    failed++;
    console.log('  FAIL ' + name + (extra !== undefined ? '  ' + JSON.stringify(extra) : ''));
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
const U = 'm7u' + tag;
const reg = await call('POST', '/api/auth/register', { username: U, password: 'pass12345', deviceName: 'devA' });
chk('register', reg.status === 200 && reg.data.ok, reg.data);
const t = reg.data.token;

let r = await call('POST', '/api/items', { id: 'itm_client_' + tag, kind: 'note', text: '第一条：晚上七点开会' }, t);
chk('create item（客户端给 id）', r.data.ok && r.data.item.id === 'itm_client_' + tag, r.data);
const id = r.data.item.id;
const seq1 = r.data.seq;
chk('create 产生 seq', seq1 > 0, seq1);

r = await call('GET', '/api/items?since=0', undefined, t);
chk('首次同步给全量', r.data.ok && r.data.full === true && r.data.items.length === 1 && r.data.items[0].text.includes('七点'), r.data.items);

r = await call('GET', '/api/sync?since=' + seq1, undefined, t);
chk('since=seq1 没有新东西', r.data.ok && r.data.items.length === 0, r.data);

r = await call('PATCH', '/api/items/' + id, { text: '第一条（改）：晚上八点开会', baseUpdatedAt: r.data.seq ? 0 : 0 }, t);
chk('patch 文本', r.data.ok && r.data.item.text.includes('八点'), r.data);
const seq2 = r.data.seq;
chk('patch 产生新 seq', seq2 > seq1, { seq1, seq2 });
chk('patch 没误判冲突', r.data.conflictId === null, r.data.conflictId);

r = await call('GET', '/api/items?since=' + seq1, undefined, t);
chk('增量拉到改动', r.data.ok && r.data.items.length === 1 && r.data.items[0].text.includes('八点'), r.data.items);

const staleBase = r.data.items[0].updatedAt - 5000;
r = await call('PATCH', '/api/items/' + id, { text: '另一台设备写的版本', baseUpdatedAt: staleBase }, t);
chk('过期 base + 文本不同 → 冲突副本', r.data.ok && !!r.data.conflictId, r.data);
const conflictId = r.data.conflictId;

r = await call('GET', '/api/items?since=0', undefined, t);
const copy = (r.data.items || []).find((x) => x.id === conflictId);
chk('冲突副本内容 = 被覆盖的那版', !!copy && copy.text.includes('八点') && copy.origin && copy.origin.conflict === true, copy);

r = await call('PATCH', '/api/items/' + id, { pinned: true }, t);
chk('钉住', r.data.ok && r.data.item.pinned === true, r.data.item);

r = await call('DELETE', '/api/items/' + id, undefined, t);
chk('钉住的不能删（409 pinned）', r.data.ok === false && r.data.code === 'pinned', r.data);

r = await call('PATCH', '/api/items/' + id, { pinned: false }, t);
chk('取消钉住', r.data.ok && r.data.item.pinned === false, r.data.item);

const seqBeforeDel = r.data.seq;
r = await call('DELETE', '/api/items/' + id, undefined, t);
chk('软删除成功', r.data.ok && r.data.id === id, r.data);

r = await call('GET', '/api/items?since=' + seqBeforeDel, undefined, t);
const gone = (r.data.items || []).find((x) => x.id === id);
chk('增量里能看到墓碑 deleted=true', !!gone && gone.deleted === true, gone);

r = await call('GET', '/api/items?since=0', undefined, t);
chk('全量里没有已删的', !(r.data.items || []).some((x) => x.id === id), r.data.items && r.data.items.map((x) => x.id));

r = await call('GET', '/api/items?since=0');
chk('未登录 401', r.data.ok === false && (r.status === 401 || r.data.code === 'unauthorized'), r.data);

// 图片直传（1x1 PNG）
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);
const upRes = await fetch(BASE + '/api/items/image', {
  method: 'POST',
  headers: { 'content-type': 'image/png', authorization: 'Bearer ' + t },
  body: png
});
const up = await upRes.json().catch(() => ({}));
chk('图片直传（本地无云存储时允许 cloud_off）', (up.ok && String(up.key).startsWith('cloud:')) || up.code === 'cloud_off', up);

if (up.ok) {
  r = await call('POST', '/api/items', { id: 'itm_img_' + tag, kind: 'note', text: '带图', images: [up.key] }, t);
  chk('事项带图保存', r.data.ok && r.data.item.images[0] === up.key, r.data.item);
  chk('图片有可访问 url', !!r.data.item.urls[up.key], r.data.item.urls);
}

// SSE：连上之后改一条，应该收到 event: sync
const ac = new AbortController();
const sse = await fetch(BASE + '/api/sync/stream?token=' + encodeURIComponent(t), {
  headers: { accept: 'text/event-stream' },
  signal: ac.signal
});
const reader = sse.body.getReader();
const dec = new TextDecoder();
let buf = '';
const readFor = async (ms, needle) => {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    if (needle && buf.includes(needle)) return true;
  }
  return false;
};
const hello = await readFor(3000, 'event: hello');
chk('SSE 握手（hello）', hello, buf.slice(0, 120));
await call('POST', '/api/items', { id: 'itm_sse_' + tag, kind: 'todo', text: 'SSE 推送测试' }, t);
const gotSync = await readFor(4000, 'event: sync');
chk('SSE 收到 sync 事件', gotSync, buf.slice(-160));
ac.abort();

// 清理：删掉这次建的（含冲突副本）
r = await call('GET', '/api/items?since=0', undefined, t);
for (const it of r.data.items || []) {
  await call('PATCH', '/api/items/' + it.id, { pinned: false }, t);
  await call('DELETE', '/api/items/' + it.id, undefined, t);
}
r = await call('DELETE', '/api/me', { username: U, password: 'pass12345', code: reg.data.recoveryCode }, t);
chk('注销测试账号', r.data.ok, r.data);

console.log('\n' + pass + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
