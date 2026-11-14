// M3 频道认领自测：本地 `ISLAND_DATA=D:\temp\island-claim ISLAND_PORT=3399 node server\index.mjs`
// 跑 `node tools\test-claim.mjs`（BASE 可覆盖，注意结尾不要带 /island）
const BASE = (process.env.BASE || 'http://127.0.0.1:3399').replace(/\/$/, '');

let pass = 0;
let failn = 0;
const check = (name, cond, extra) => {
  if (cond) {
    pass += 1;
    console.log('  ok  ' + name);
  } else {
    failn += 1;
    console.log('  FAIL ' + name, extra === undefined ? '' : JSON.stringify(extra));
  }
};

async function call(method, path, { token, body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = 'Bearer ' + token;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let data = null;
  try {
    data = await res.json();
  } catch (_) {}
  return { status: res.status, data: data || {} };
}

const uname = 'clm' + Date.now().toString(36).slice(-6);
const pw = 'Claim-test-123';

const room = await call('POST', '/api/rooms', { body: { deviceName: '认领测试机' } });
check('建房', room.status === 200 && !!room.data.code, room.data);
const code = room.data.code;

const reg = await call('POST', '/api/auth/register', { body: { username: uname, password: pw, deviceName: 'test-a' } });
check('注册 A', reg.data.ok === true && !!reg.data.token, reg.data);
const tokenA = reg.data.token;

const c1 = await call('POST', '/api/rooms/claim', { token: tokenA, body: { code } });
check('A 认领成功', c1.data.ok === true && c1.data.claimed === true, c1.data);

const c2 = await call('POST', '/api/rooms/claim', { token: tokenA, body: { code } });
check('A 再认领 = already', c2.data.ok === true && c2.data.already === true, c2.data);

const own = await call('GET', '/api/rooms/owner?code=' + code);
check('owner 查询是 A', own.data.ok === true && own.data.claimed === true && own.data.owner && own.data.owner.username === uname, own.data);

const unameB = uname + 'b';
const regB = await call('POST', '/api/auth/register', { body: { username: unameB, password: pw, deviceName: 'test-b' } });
const c3 = await call('POST', '/api/rooms/claim', { token: regB.data.token, body: { code } });
check('B 认领被拒（先到先得）', c3.data.ok === false && c3.data.code === 'taken', c3.data);

const noauth = await call('POST', '/api/rooms/claim', { body: { code } });
check('未登录认领 401', noauth.status === 401 || noauth.data.code === 'unauthorized', noauth.data);

const badcode = await call('POST', '/api/rooms/claim', { token: tokenA, body: { code: 'ZZZZZZZZZZZZ' } });
check('不存在的码 404', badcode.data.ok === false && badcode.data.code === 'not_found', badcode.data);

console.log('\n' + pass + ' passed, ' + failn + ' failed');
console.log('cleanup: ' + uname + ' / ' + unameB + ' / room ' + code);
process.exit(failn ? 1 : 0);
