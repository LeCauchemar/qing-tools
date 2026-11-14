import fs from 'node:fs';

const p = 'src/renderer/app.js';
let s = fs.readFileSync(p, 'utf8');
const before = s.length;
const done = [];

function rep(name, from, to) {
  if (!s.includes(from)) throw new Error('miss: ' + name);
  s = s.replace(from, to);
  done.push(name);
}

// 1) 账号 token 带进 S.account
rep(
  'S.account.userToken',
  "account: { signedIn: false, user: null, sessions: [], busy: false, msg: '', roomsClaimed: false, friends: [], requests: [], outgoing: [] }, // 账号（1.11.0 / M6）",
  "account: { signedIn: false, user: null, sessions: [], busy: false, msg: '', roomsClaimed: false, friends: [], requests: [], outgoing: [], userToken: '' }, // 账号（1.11.0 / M6）"
);

// 2) chatFetch 带上 Authorization（服务端据此把设备/消息记到账号上）
rep(
  'chatFetch auth',
  "  const init = { method: opts.method || 'GET', headers: {} };",
  "  const init = { method: opts.method || 'GET', headers: {} };\n" +
    "  if (S.account && S.account.userToken) init.headers.Authorization = 'Bearer ' + S.account.userToken;"
);

// 3) 人 → key 的换算
rep(
  'helpers',
  'function renderChatMembers() {',
  "function myPersonKey() {\n" +
    "  const s = curRoom();\n" +
    "  const uid = S.account && S.account.user && S.account.user.id;\n" +
    "  return uid ? 'u:' + uid : (s ? s.deviceId : '');\n" +
    "}\n\n" +
    "function memberKey(m) {\n" +
    "  if (!m) return '';\n" +
    "  return m.userId ? 'u:' + m.userId : m.id;\n" +
    "}\n\n" +
    'function renderChatMembers() {'
);

// 4) 成员列表按人归并（同一账号多台设备合成一个）
const oldMembers = fs
  .readFileSync(p, 'utf8')
  .slice(fs.readFileSync(p, 'utf8').indexOf('function renderChatMembers() {'));
const start = s.indexOf('function renderChatMembers() {');
const end = s.indexOf('\n}\n', s.indexOf('renderChatMeta();', start)) + 3;
const newMembers = `function renderChatMembers() {
  const s = curRoom();
  if (!s) return;
  // 按人归并：同一个账号的多台设备只显示一个成员，票数、@、拍一拍都按人算
  const groups = new Map();
  for (const m of s.members || []) {
    const key = memberKey(m);
    let g = groups.get(key);
    if (!g) {
      g = { key, name: m.name, ids: [], me: false, online: false, userId: m.userId || null };
      groups.set(key, g);
    }
    g.ids.push(m.id);
    if (m.id === s.deviceId) g.me = true;
    if (m.online !== false) g.online = true;
    if (!g.name && m.name) g.name = m.name;
  }
  el.chatMembers.innerHTML = [...groups.values()]
    .map((g) => {
      const me = g.me;
      const label = g.ids.length > 1 ? g.name + '（' + g.ids.length + ' 台）' : g.name;
      const cls = 'member' + (me ? ' me' : '') + (g.online === false && !me ? ' off' : '');
      const kick = me
        ? ''
        : '<button class="member-kick" data-act="chat-kick" data-dev="' + esc(g.key) + '" title="投票把 ' +
          esc(g.name) + ' 移出频道"><svg class="ic"><use href="#i-scale" /></svg></button>';
      return (
        '<span class="' + cls + '" data-dev="' + esc(g.key) + '" title="' +
        esc(g.name) + (g.online === false && !me ? ' · 离线' : ' · 在线') + (me ? '' : ' · 双击拍一拍') + '">' +
        '<i class="av" style="background:' + colorOf(g.name) + '">' + esc(initialOf(g.name, '')) + '</i>' +
        '<span>' + esc(label) + (me ? '（我）' : '') + '</span>' +
        '<i class="live"></i>' + kick + '</span>'
      );
    })
    .join('');
  renderChatMeta();
}
`;
s = s.slice(0, start) + newMembers + s.slice(end);
done.push('renderChatMembers rewrite');

// 5) @ 匹配：设备 id 或 u:<uid> 都算我被 @
rep(
  'atMe',
  "  const atMe = Array.isArray(m.mentions) && m.mentions.includes(room.deviceId);",
  "  const myKeys = [room.deviceId];\n" +
    "  if (S.account && S.account.user && S.account.user.id) myKeys.push('u:' + S.account.user.id);\n" +
    "  const atMe = Array.isArray(m.mentions) && m.mentions.some((k) => myKeys.includes(k));"
);

// 6) addMention 存“人”的 key
rep(
  'addMention key',
  '  S.chat.mentions.set(id, id);',
  "  const s0 = curRoom();\n" +
    "  const mm = s0 ? (s0.members || []).find((x) => x.id === id || (x.userId && 'u:' + x.userId === id)) : null;\n" +
    '  S.chat.mentions.set(mm ? memberKey(mm) : id, mm ? memberKey(mm) : id);'
);

// 7) 投票目标按人比较
rep(
  'vote target compare',
  '      const target = v.targetId === s.deviceId;',
  '      const target = v.targetId === myPersonKey();'
);
rep(
  'vote start guard',
  "  if (targetId === s.deviceId) return toast('不能投票踢自己，直接点右上角 ✕ 退出就行');",
  "  if (targetId === myPersonKey()) return toast('不能投票踢自己，直接点右上角 ✕ 退出就行');"
);

// 8) 已读：进频道 / 收到新消息时上报；别的设备已读要清红点
rep(
  'mark read fn',
  'async function chatLoadHistory(room) {',
  `async function chatMarkRead(room) {
  const r = room || curRoom();
  if (!r || !r.messages || !r.messages.length) return;
  const last = r.messages[r.messages.length - 1];
  if (!last || !last.id || String(last.id).startsWith('c')) return;
  if (r.lastReadId === last.id) return;
  r.lastReadId = last.id;
  const res = await chatFetch('/api/rooms/' + encodeURIComponent(r.roomId) + '/read', {
    method: 'POST',
    body: { deviceId: r.deviceId, token: r.token, messageId: last.id }
  }).catch(() => null);
  if (res && res.ok && res.data && res.data.lastReadId) r.lastReadId = res.data.lastReadId;
}

async function chatLoadHistory(room) {`
);

rep(
  'mark read after load',
  `  if (r === curRoom() && S.tab === 'chat') {
    renderChatMsgs();
    chatScrollToEnd(true);
  }
  chatRenderRooms();`,
  `  if (r === curRoom() && S.tab === 'chat') {
    renderChatMsgs();
    chatScrollToEnd(true);
    chatMarkRead(r);
  }
  chatRenderRooms();`
);

rep(
  'sse read event',
  "  es.addEventListener('message', (e) => {",
  `  es.addEventListener('read', (e) => {
    if (!alive()) return;
    try {
      const d = JSON.parse(e.data || '{}');
      const uid = S.account && S.account.user && S.account.user.id;
      if (d && uid && d.userId === uid && d.deviceId !== room.deviceId) {
        room.unread = 0;
        chatRenderRooms();
        renderBadges();
      }
    } catch {
      /* 忽略 */
    }
  });
  es.addEventListener('message', (e) => {`
);

// 主动聊天后也要刷新已读位置
rep(
  'mark read on push when active',
  `  if (room === curRoom() && S.tab === 'chat') {
    renderChatMsgs();
    chatScrollToEnd();
  }`,
  `  if (room === curRoom() && S.tab === 'chat') {
    renderChatMsgs();
    chatScrollToEnd();
    if (active) chatMarkRead(room);
  }`
);

// 9) 登录后把 token 交给渲染层
rep(
  'load token on status',
  'async function accLoadStatus() {',
  `async function loadAccountToken() {
  try {
    S.account.userToken = (api.account && api.account.token ? await api.account.token() : '') || '';
  } catch {
    S.account.userToken = '';
  }
}

async function accLoadStatus() {`
);

fs.writeFileSync(p, s);
console.log('ok', before, '->', s.length);
console.log(done.join(' | '));
