(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  const uname = 'm7' + Math.random().toString(36).slice(2, 8);
  const reg = await api.account.register({ username: uname, password: 'pass12345' });
  out.user = uname;
  out.reg = { ok: reg.ok, code: !!reg.recoveryCode, err: reg.message || '' };
  await sleep(1500);
  out.status0 = await api.sync.status();
  const n = await api.notes.add('M7-LOCAL-1 本地新建的', 'note');
  out.localId = n && n.note ? n.note.id : '';
  await sleep(3000);
  out.status1 = await api.sync.status();
  out.token = await api.account.token();
  out.notes = (S.data.notes || []).map((x) => ({ id: x.id, t: x.text, remote: !!x.remote }));
  return out;
})()
