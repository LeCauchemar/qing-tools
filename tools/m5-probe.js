(async () => {
  const wait = (ms) => new Promise((s) => setTimeout(s, ms));
  const r = {};
  const lg = await api.account.login({ username: 'm3pepgdd8', password: 'M3-probe-123' });
  r.login = !!(lg && lg.ok);
  await wait(900);
  const name = 'M5-测试机';
  const res = await chatFetch('/api/rooms', { method: 'POST', body: { deviceName: name } });
  r.created = !!(res && res.ok);
  if (res && res.ok) {
    chatAddRoom(res.data, name);
    r.code = res.data.code;
  }
  await wait(500);
  if (r.code) r.claim = await api.account.claimRoom(r.code);
  const idx = (S.chat.rooms || []).findIndex((x) => x.code === r.code);
  if (idx >= 0) chatDropRoom(S.chat.rooms[idx], '');
  r.before = (S.chat.rooms || []).length;
  await syncAccountRooms();
  await wait(800);
  r.after = (S.chat.rooms || []).length;
  r.hasRoom = (S.chat.rooms || []).some((x) => x.code === r.code);
  r.mine = await api.account.myRooms();
  const i2 = (S.chat.rooms || []).findIndex((x) => x.code === r.code);
  if (i2 >= 0) await chatLeave(i2);
  await wait(600);
  r.leftRooms = (S.chat.rooms || []).length;
  return JSON.stringify(r);
})()
