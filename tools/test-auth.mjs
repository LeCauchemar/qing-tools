// 账号接口自测（顺序敏感，别打乱）
const BASE = process.env.BASE || 'http://127.0.0.1:3399/island';
const api = async (path, opts = {}) => {
  const r = await fetch(BASE + path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(opts.token ? { Authorization: 'Bearer ' + opts.token } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ...j };
};
const line = (k, v) => console.log(String(k).padEnd(24), typeof v === 'string' ? v : JSON.stringify(v));
let pass = 0;
let failCount = 0;
const expect = (k, cond, detail) => {
  if (cond) pass++;
  else failCount++;
  console.log((cond ? 'PASS ' : 'FAIL ') + String(k).padEnd(30), detail === undefined ? '' : JSON.stringify(detail));
};

const name = 'test_' + Math.random().toString(36).slice(2, 7);
const pw1 = 'hunter2hunter';
const pw2 = 'newpass12345';

const reg = await api('/api/auth/register', { method: 'POST', body: { username: name, password: pw1, deviceName: '测试机' } });
expect('register', reg.ok && !!reg.token && !!reg.recoveryCode, { user: reg.user && reg.user.username, recovery: reg.recoveryCode });
const t1 = reg.token;
const r1 = reg.recoveryCode;

expect('duplicate (case-insensitive)', !(await api('/api/auth/register', { method: 'POST', body: { username: name.toUpperCase(), password: pw1 } })).ok);
const chk = await api('/api/auth/check?u=' + encodeURIComponent(name));
expect('check available=false', chk.available === false, chk);

const bad = await api('/api/auth/login', { method: 'POST', body: { username: name, password: 'wrong-pass' } });
expect('wrong password', bad.ok === false && bad.code === 'bad_credentials', bad);

const good = await api('/api/auth/login', { method: 'POST', body: { username: name, password: pw1, deviceName: '第二台' } });
expect('login ok', good.ok && !!good.token);
const t2 = good.token;

const me = await api('/api/me', { token: t1 });
expect('me: 2 sessions', me.ok && me.sessions.length === 2, me.sessions && me.sessions.map((s) => s.deviceName));

const noAuth = await api('/api/me');
expect('me without token → 401', noAuth.status === 401 && noAuth.code === 'unauthorized');

const recBad = await api('/api/auth/recover', { method: 'POST', body: { username: name, code: 'AAAA-BBBB-CCCC', newPassword: pw2 } });
expect('recover wrong code', recBad.ok === false && recBad.code === 'bad_recovery', recBad);

const rec = await api('/api/auth/recover', { method: 'POST', body: { username: name, code: r1, newPassword: pw2, deviceName: '恢复机' } });
expect('recover ok + new code', rec.ok && !!rec.recoveryCode && rec.recoveryCode !== r1, rec.recoveryCode);
const t3 = rec.token;
const r2 = rec.recoveryCode;

const old = await api('/api/me', { token: t1 });
expect('old sessions revoked after recover', old.status === 401, old);

const loginNew = await api('/api/auth/login', { method: 'POST', body: { username: name, password: pw2, deviceName: '新密码机' } });
expect('login with new password', loginNew.ok);
const t4 = loginNew.token;

const me3 = await api('/api/me', { token: t3 });
const other = me3.sessions.find((s) => !s.current);
const kick = await api('/api/me/sessions/' + other.id, { method: 'DELETE', token: t3 });
const me4 = await api('/api/me', { token: t3 });
expect('kick one device', kick.ok && me4.sessions.length === me3.sessions.length - 1, { before: me3.sessions.length, after: me4.sessions.length });

const kickSelf = await api('/api/me/sessions/' + me3.sessions.find((s) => s.current).id, { method: 'DELETE', token: t4 });
expect('cannot touch others session', kickSelf.ok === false || kickSelf.status === 401, kickSelf);

const outAll = await api('/api/auth/logout-all', { method: 'POST', token: t3 });
const afterAll = await api('/api/me', { token: t3 });
expect('logout-all revokes everything', outAll.ok && afterAll.status === 401);

const relog = await api('/api/auth/login', { method: 'POST', body: { username: name, password: pw2, deviceName: '三号机' } });
const t5 = relog.token;
expect('relogin ok', relog.ok);

const del = await api('/api/me', { method: 'DELETE', token: t5, body: { username: name, password: pw2, code: r2 } });
expect('delete account', del.ok, del);

const afterDel = await api('/api/auth/login', { method: 'POST', body: { username: name, password: pw2 } });
expect('login after delete blocked', afterDel.ok === false && (afterDel.code === 'bad_credentials' || afterDel.code === 'locked'), afterDel);

const reReg = await api('/api/auth/register', { method: 'POST', body: { username: name, password: pw1 } });
expect('username stays reserved', reReg.ok === false && reReg.code === 'taken', reReg);
const chk2 = await api('/api/auth/check?u=' + encodeURIComponent(name));
expect('check reserved=true', chk2.available === false && chk2.reserved === true, chk2);

// 限流/锁定放在最后（会污染后续登录）
const name2 = 'lock_' + Math.random().toString(36).slice(2, 7);
await api('/api/auth/register', { method: 'POST', body: { username: name2, password: pw1 } });
for (let i = 0; i < 5; i++) await api('/api/auth/login', { method: 'POST', body: { username: name2, password: 'nope-' + i } });
const locked = await api('/api/auth/login', { method: 'POST', body: { username: name2, password: pw1 } });
expect('lock after 5 fails', locked.ok === false && locked.code === 'locked', locked);

console.log('\n' + pass + ' passed, ' + failCount + ' failed');
process.exit(failCount ? 1 : 0);
