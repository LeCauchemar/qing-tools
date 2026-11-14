/**
 * M5 自测：频道跟账号走（身份 / @ / 拍一拍 / 投票按人 / 已读按人）
 * 用法：先起一个临时服务端
 *   $env:ISLAND_DATA="D:\temp\island-m5-test"; $env:ISLAND_PORT="3399"; node server\index.mjs
 * 再跑 node tools\test-m5.mjs
 */
const BASE = process.env.BASE || 'http://127.0.0.1:3399';

let pass = 0;
let fail = 0;
function ok(cond, label, extra) {
  if (cond) {
    pass++;
    console.log('  ok  ' + label);
  } else {
    fail++;
    console.log('  FAIL ' + label + (extra ? ' :: ' + JSON.stringify(extra) : ''));
  }
}

async function api(method, path, body, token) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data: data || {} };
}

const stamp = Date.now().toString(36).slice(-6);

async function main() {
  console.log('[1] 建房 + 两个账号进来');
  const a = await api('POST', '/api/rooms', { deviceName: '匿名甲' });
  ok(a.data.ok && a.data.code, '建房成功', a.data);
  const roomId = a.data.roomId;
  const code = a.data.code;
  const anonDev = a.data.deviceId;
  const anonTok = a.data.token;

  const u1 = await api('POST', '/api/auth/register', { username: 'm5a' + stamp, password: 'pw12345678', nick: '甲' });
  const u2 = await api('POST', '/api/auth/register', { username: 'm5b' + stamp, password: 'pw12345678', nick: '乙' });
  ok(u1.data.ok && u2.data.ok, '注册两个账号', { u1: u1.data.code, u2: u2.data.code });
  const t1 = u1.data.token;
  const t2 = u2.data.token;

  const j1 = await api('POST', '/api/rooms/join', { code, deviceName: '甲的电脑' }, t1);
  ok(j1.data.ok, '账号甲加入频道', j1.data);
  const j2 = await api('POST', '/api/rooms/join', { code, deviceName: '乙的电脑' }, t2);
  ok(j2.data.ok, '账号乙加入频道', j2.data);

  ok(j1.data.userId === u1.data.user.id, '加入时记下了账号甲', j1.data.userId);
  ok(j2.data.userId === u2.data.user.id, '加入时记下了账号乙', j2.data.userId);

  console.log('[2] 消息带账号');
  const m1 = await api(
    'POST',
    '/api/rooms/' + roomId + '/messages',
    { deviceId: j1.data.deviceId, token: j1.data.token, kind: 'text', text: '你好，我是甲' }
  );
  ok(m1.data.ok && m1.data.message.userId === u1.data.user.id, '消息里有发送者账号', m1.data.message);

  console.log('[3] @ 和拍一拍按人');
  const mention = await api(
    'POST',
    '/api/rooms/' + roomId + '/messages',
    {
      deviceId: j1.data.deviceId,
      token: j1.data.token,
      kind: 'text',
      text: '@乙 看一下',
      mentions: ['u:' + u2.data.user.id]
    }
  );
  ok(mention.data.ok && mention.data.message.mentions.includes('u:' + u2.data.user.id), '@ 用账号 token', mention.data.message);

  const nudge = await api(
    'POST',
    '/api/rooms/' + roomId + '/messages',
    { deviceId: j1.data.deviceId, token: j1.data.token, kind: 'nudge', mentions: ['u:' + u1.data.user.id] }
  );
  ok(nudge.data.ok, '拍一拍可以打给「人」的 key', nudge.data);

  const badNudge = await api(
    'POST',
    '/api/rooms/' + roomId + '/messages',
    { deviceId: j1.data.deviceId, token: j1.data.token, kind: 'nudge', mentions: ['u:nobody'] }
  );
  ok(!badNudge.data.ok, '拍不存在的人会被拒', badNudge.data);

  console.log('[4] 同一个人两台设备只算一个人');
  const j1b = await api('POST', '/api/rooms/join', { code, deviceName: '甲的备用机' }, t1);
  ok(j1b.data.ok, '账号甲第二台设备进房', j1b.data);
  const roster = await api('GET', '/api/rooms/' + roomId + '?device=' + anonDev + '&token=' + anonTok);
  ok(roster.data.ok, '匿名设备能读频道信息');
  const people = new Set((roster.data.members || []).map((m) => m.userId || m.id));
  ok(people.size === 3, '三个人（匿名甲 / 账号甲 / 账号乙）', [...people]);

  console.log('[5] 投票按人：目标 = 账号甲这个人');
  const vStart = await api(
    'POST',
    '/api/rooms/' + roomId + '/votes',
    { deviceId: j2.data.deviceId, token: j2.data.token, target: 'u:' + u1.data.user.id }
  );
  ok(vStart.data.ok, '对「账号甲」发起投票', vStart.data);
  const vote = vStart.data.vote || {};
  ok(vote.targetId === 'u:' + u1.data.user.id, '目标是人的 key', vote.targetId);
  ok(vote.eligible === 2, '有资格的是两个人（匿名甲 + 账号乙）', vote.eligible);
  ok(vote.need === 2, '四个人里的多数 → 2 票', vote.need);
  ok((vote.people || []).length === 3, 'people 里三个人', vote.people);

  const v2 = await api(
    'POST',
    '/api/rooms/' + roomId + '/votes/' + vote.id + '/ballot',
    { deviceId: j2.data.deviceId, token: j2.data.token, yes: true }
  );
  ok(v2.data.ok && v2.data.vote.yes === 1, '乙投同意（同一个人第二台设备也只会 1 票）', v2.data.vote);
  const v2b = await api(
    'POST',
    '/api/rooms/' + roomId + '/votes/' + vote.id + '/ballot',
    { deviceId: j1b.data.deviceId, token: j1b.data.token, yes: true }
  );
  ok(!v2b.data.ok, '被投的人不能投票', v2b.data);

  const v1 = await api(
    'POST',
    '/api/rooms/' + roomId + '/votes/' + vote.id + '/ballot',
    { deviceId: anonDev, token: anonTok, yes: true }
  );
  ok(v1.data.ok, '匿名甲投同意');
  ok(v1.data.vote.status === 'passed', '两票过半 → 投票通过', v1.data.vote);

  const afterKick = await api('GET', '/api/rooms/' + roomId + '/messages?device=' + j2.data.deviceId + '&token=' + j2.data.token);
  ok(afterKick.data.ok, '乙还在房间里');
  const membersNow = (await api('GET', '/api/rooms/' + roomId + '/messages?device=' + anonDev + '&token=' + anonTok)).data;
  ok(!!membersNow, '匿名甲也还在');

  const j1again = await api('POST', '/api/rooms/' + roomId + '/messages', {
    deviceId: j1.data.deviceId,
    token: j1.data.token,
    kind: 'text',
    text: '我被踢了吗'
  });
  ok(!j1again.data.ok, '被踢的设备不能再发消息', j1again.data);

  console.log('[6] 已读按人');
  const mark = await api(
    'POST',
    '/api/rooms/' + roomId + '/read',
    { deviceId: j2.data.deviceId, token: j2.data.token },
    t2
  );
  ok(mark.data.ok, '乙标记已读', mark.data);
  const st = await api('GET', '/api/rooms/' + roomId + '/read?device=' + j2.data.deviceId + '&token=' + j2.data.token);
  ok(st.data.ok && st.data.unread === 0, '乙的未读归零', st.data);

  const send2 = await api(
    'POST',
    '/api/rooms/' + roomId + '/messages',
    { deviceId: anonDev, token: anonTok, kind: 'text', text: '新消息' }
  );
  ok(send2.data.ok, '匿名甲发一条新消息');
  const st2 = await api('GET', '/api/rooms/' + roomId + '/read?device=' + j2.data.deviceId + '&token=' + j2.data.token);
  ok(st2.data.ok && st2.data.unread === 1, '乙的未读变成 1', st2.data);

  console.log('[7] 清理');
  await api('DELETE', '/api/me', { username: 'm5a' + stamp, password: 'pw12345678', code: u1.data.recoveryCode });
  await api('DELETE', '/api/me', { username: 'm5b' + stamp, password: 'pw12345678', code: u2.data.recoveryCode });

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
