(async () => {
  const wait = (ms) => new Promise((s) => setTimeout(s, ms));
  const r = {};
  r.p0 = await api.profile.info();
  await api.notes.add('M3-LOCAL-NOTE');
  await api.todos.add('M3-LOCAL-TODO');
  await wait(300);
  r.local = { notes: S.data.notes.length, todos: S.data.todos.length };
  const uname = 'm3p' + Date.now().toString(36).slice(-6);
  r.uname = uname;
  const reg = await api.account.register({ username: uname, password: 'M3-probe-123' });
  r.reg = { ok: reg.ok, code: reg.code, user: reg.user && reg.user.username, rec: !!reg.recoveryCode };
  await wait(700);
  r.p1 = await api.profile.info();
  r.acctBefore = { notes: S.data.notes.length, todos: S.data.todos.length };
  r.claimInfo = await api.account.claimInfo();
  r.claim = await api.account.claim();
  await wait(700);
  r.afterClaim = { notes: S.data.notes.map((n) => n.text.slice(0, 24)), todos: S.data.todos.length };
  const out = await api.account.logout();
  r.logout = { ok: out && out.ok !== false };
  await wait(900);
  r.p2 = await api.profile.info();
  r.backLocal = { notes: S.data.notes.length, todos: S.data.todos.length };
  return JSON.stringify(r);
})()
