/* M5 dev 探针：在渲染层里跑，验证「频道跟着账号走」的客户端链路 */
(async () => {
  const out = {};
  const uname = 'm5c' + Math.random().toString(36).slice(2, 8);
  const pw = 'pw12345678';

  const reg = await api.account.register({ username: uname, password: pw });
  out.register = { ok: !!reg.ok, code: reg.code || '', user: reg.user ? reg.user.username : '' };
  if (!reg.ok) return out;

  await loadAccountToken();
  S.account.signedIn = true;
  S.account.user = reg.user || null;
  out.tokenLen = (S.account.userToken || '').length;

  // 建一个临时频道（走 chatFetch，应该自动带上 Authorization）
  const mk = await chatFetch('/api/rooms', { method: 'POST', body: { deviceName: 'M5-主机' } });
  out.create = { ok: mk.ok, userId: mk.data.userId || null, code: mk.data.code || '' };
  if (!mk.ok) return out;

  chatAddRoom(mk.data, 'M5-主机');
  const room = S.chat.rooms[S.chat.rooms.length - 1];
  out.roomUserId = room.userId || null;

  // 同一账号的第二台设备（用同一把 token 直接调接口）
  const r2 = await fetch('https://chat.ccyyqq.com/island/api/rooms/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + S.account.userToken },
    body: JSON.stringify({ code: room.code, deviceName: 'M5-备机' })
  }).then((r) => r.json());
  out.join2 = { ok: !!r2.ok, userId: r2.userId || null };

  // 刷新成员
  const info = await chatFetch('/api/rooms/' + room.roomId + '?device=' + encodeURIComponent(room.deviceId) + '&token=' + encodeURIComponent(room.token));
  if (info.ok && info.data.members) room.members = info.data.members;
  renderChatMembers();
  out.members = [...document.querySelectorAll('#chatMembers .member')].map((n) => n.textContent.trim());
  out.memberKeys = [...document.querySelectorAll('#chatMembers .member')].map((n) => n.dataset.dev);

  // 发一条消息
  await chatPost('text', 'M5 测试：我是登录用户发的', null, null, []);
  await new Promise((r) => setTimeout(r, 400));
  const last = room.messages[room.messages.length - 1];
  out.msg = { kind: last.kind, userId: last.userId || null, text: last.text };

  // @ 一个人（自己的 key）
  const my = myPersonKey();
  out.myKey = my;
  addMention('M5-主机', room.deviceId);
  out.mentionKeys = [...S.chat.mentions.keys()];

  // 已读上报
  await chatMarkRead(room);
  const rd = await chatFetch('/api/rooms/' + room.roomId + '/read?device=' + encodeURIComponent(room.deviceId) + '&token=' + encodeURIComponent(room.token));
  out.read = { ok: rd.ok, unread: rd.data.unread, lastReadId: rd.data.lastReadId || null };

  // 收尾：退出频道 + 删账号（临时）
  await chatFetch('/api/rooms/' + room.roomId + '/leave', {
    method: 'POST',
    body: { deviceId: room.deviceId, token: room.token }
  });
  S.chat.rooms = S.chat.rooms.filter((r) => r.roomId !== room.roomId);
  chatPersist();
  chatRender();
  const del = await api.account.remove({ username: uname, password: pw, code: reg.recoveryCode });
  out.deleted = { ok: !!del.ok, code: del.code || '' };
  out.uname = uname;
  return out;
})()
