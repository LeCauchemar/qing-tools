/**
 * 短信验证码「跟着账号走」自测
 * 自己起一个临时服务端（ISLAND_DATA 指向临时目录），跑完自动清理。
 *   node tools\test-sms-account.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'island-smsacc-'));
const PORT = 3407;
const BASE = 'http://127.0.0.1:' + PORT;
const MASTER = 'master-' + Date.now().toString(36);
const HOOK = 'hook-' + Date.now().toString(36);

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

async function api(method, pathname, body, token) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(BASE + pathname, {
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

/** 打开一条 SSE，收集 event: sms 的 data */
async function openSse(pathname) {
  const ctrl = new AbortController();
  const res = await fetch(BASE + pathname, { signal: ctrl.signal });
  const out = { status: res.status, events: [], hello: false, close: () => ctrl.abort() };
  if (res.status !== 200) {
    try {
      out.body = await res.json();
    } catch {
      out.body = null;
    }
    return out;
  }
  (async () => {
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, i);
          buf = buf.slice(i + 2);
          if (chunk.includes('event: hello')) out.hello = true;
          const ev = /^event: (\S+)/m.exec(chunk);
          const dat = /^data: (.+)$/m.exec(chunk);
          if (ev && ev[1] === 'sms' && dat) {
            try {
              out.events.push(JSON.parse(dat[1]));
            } catch {
              /* ignore */
            }
          }
        }
      }
    } catch {
      /* aborted */
    }
  })();
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitHello(s, ms = 2000) {
  const t0 = Date.now();
  while (!s.hello && Date.now() - t0 < ms) await sleep(50);
  return s.hello;
}
async function waitPort() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE + '/api/health');
      if (r.ok) return true;
    } catch {
      /* not yet */
    }
    await sleep(150);
  }
  return false;
}

const child = spawn(process.execPath, [path.join(ROOT, 'server', 'index.mjs')], {
  env: {
    ...process.env,
    ISLAND_PORT: String(PORT),
    ISLAND_DATA: DATA,
    ISLAND_READ_TOKEN: MASTER,
    ISLAND_HOOK_TOKEN: HOOK
  },
  stdio: ['ignore', 'ignore', 'pipe']
});
child.stderr.on('data', (d) => process.stderr.write('[srv] ' + d));

const stamp = Date.now().toString(36).slice(-6);

async function main() {
  if (!(await waitPort())) throw new Error('服务端没起来');

  console.log('[1] 两个账号 + 各自的手机密钥');
  const a = await api('POST', '/api/auth/register', { username: 'sa' + stamp, password: 'pw12345678', nick: '甲' });
  const b = await api('POST', '/api/auth/register', { username: 'sb' + stamp, password: 'pw12345678', nick: '乙' });
  ok(a.data.ok && b.data.ok, '注册两个账号', { a: a.data.code, b: b.data.code });
  const ta = a.data.token;
  const tb = b.data.token;

  const devA = await api('POST', '/api/sms/devices', { name: '甲的手机' }, ta);
  ok(devA.data.ok && devA.data.token, '甲用账号建手机密钥', devA.data);
  ok(devA.data.item && !devA.data.item.revoked, '设备可用');

  const devB = await api('POST', '/api/sms/devices', { name: '乙的手机' }, tb);
  ok(devB.data.ok && devB.data.token, '乙用账号建手机密钥');

  console.log('[2] 订阅流按账号隔离');
  const streamA = await openSse('/api/sms/stream?token=' + encodeURIComponent(ta));
  const streamB = await openSse('/api/sms/stream?token=' + encodeURIComponent(tb));
  ok(streamA.status === 200 && (await waitHello(streamA)), '甲的账号能订阅');
  ok(streamB.status === 200 && (await waitHello(streamB)), '乙的账号能订阅');

  const pushA = await api('POST', '/api/hook/sms?token=' + encodeURIComponent(devA.data.token), {
    from: '95588',
    text: '【工商银行】验证码 731942，5 分钟内有效'
  });
  ok(pushA.data.ok && pushA.data.code === '731942', '手机推送成功（甲）', pushA.data);
  await sleep(350);
  ok(streamA.events.length === 1 && streamA.events[0].code === '731942', '甲收到自己的验证码', streamA.events);
  ok(streamB.events.length === 0, '乙收不到甲的验证码', streamB.events);

  const pushB = await api('POST', '/api/hook/sms?token=' + encodeURIComponent(devB.data.token), {
    from: '10086',
    text: '验证码 552211，请勿泄露'
  });
  ok(pushB.data.ok, '手机推送成功（乙）');
  await sleep(350);
  ok(streamB.events.length === 1 && streamB.events[0].code === '552211', '乙收到自己的验证码');
  ok(streamA.events.length === 1, '甲的消息数量没被乙污染', streamA.events.length);

  console.log('[3] 设备列表按账号隔离');
  const listA = await api('GET', '/api/sms/devices', undefined, ta);
  const listB = await api('GET', '/api/sms/devices', undefined, tb);
  ok(listA.data.mode === 'user' && listA.data.items.length === 1, '甲只看到自己 1 台', listA.data);
  ok(listB.data.mode === 'user' && listB.data.items.length === 1, '乙只看到自己 1 台', listB.data);
  ok(listA.data.items[0].id !== listB.data.items[0].id, '两台手机不是同一条记录');

  console.log('[4] 历史短信按账号隔离');
  const smsA = await api('GET', '/api/sms?limit=10&token=' + encodeURIComponent(ta));
  ok(smsA.data.ok && smsA.data.items.length === 1 && smsA.data.items[0].code === '731942', '甲只读到自己的短信', smsA.data);
  const smsB = await api('GET', '/api/sms?limit=10&token=' + encodeURIComponent(tb));
  ok(smsB.data.ok && smsB.data.items.length === 1 && smsB.data.items[0].code === '552211', '乙只读到自己的短信');

  console.log('[5] 未登录的本机身份仍然能用（向后兼容）');
  const en = await api('POST', '/api/sms/enroll?token=' + encodeURIComponent(MASTER), { name: '老电脑' });
  ok(en.data.ok && en.data.token, '主密钥能换本机身份', en.data);
  const ownToken = en.data.token;
  const devO = await api('POST', '/api/sms/devices?token=' + encodeURIComponent(ownToken), { name: '老手机' });
  ok(devO.data.ok && devO.data.token, '本机身份能建手机密钥', devO.data);
  const streamO = await openSse('/api/sms/stream?token=' + encodeURIComponent(ownToken));
  ok(streamO.status === 200 && (await waitHello(streamO)), '本机身份能订阅');
  const pushO = await api('POST', '/api/hook/sms?token=' + encodeURIComponent(devO.data.token), {
    from: '1069',
    text: '验证码 998877'
  });
  ok(pushO.data.ok, '老手机推送成功');
  await sleep(350);
  ok(streamO.events.length === 1 && streamO.events[0].code === '998877', '本机身份收到自己的验证码', streamO.events);
  ok(streamA.events.length === 1, '账号甲收不到本机身份的验证码', streamA.events.length);

  console.log('[6] 登录用户不再走 enroll');
  const en2 = await api('POST', '/api/sms/enroll?token=' + encodeURIComponent(MASTER), { name: '又一台' }, ta);
  ok(en2.status === 400 && en2.data.code === 'use_account', '已登录时拒绝再发本机身份', en2.data);

  console.log('[7] 撤销 / 权限');
  const rev = await api('POST', '/api/sms/devices/' + devA.data.item.id + '/revoke', undefined, ta);
  ok(rev.data.ok, '甲能撤销自己的设备');
  const pushRev = await api('POST', '/api/hook/sms?token=' + encodeURIComponent(devA.data.token), { text: '验证码 111111' });
  ok(pushRev.status === 403 && pushRev.data.code === 'revoked', '被撤销的设备推不上来', pushRev.data);
  const steal = await api('POST', '/api/sms/devices/' + devB.data.item.id + '/revoke', undefined, ta);
  ok(steal.status === 404, '甲撤不掉乙的设备', steal.data);

  console.log('[8] 主密钥看全部');
  const listM = await api('GET', '/api/sms/devices?token=' + encodeURIComponent(MASTER));
  ok(listM.data.mode === 'master' && listM.data.items.length === 3, '主密钥能看到 3 台设备', listM.data.items && listM.data.items.length);

  streamA.close();
  streamB.close();
  streamO.close();
}

main()
  .catch((e) => {
    fail++;
    console.error('异常：', e);
  })
  .finally(async () => {
    child.kill();
    await sleep(200);
    try {
      fs.rmSync(DATA, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    console.log('\n通过 ' + pass + ' 项，失败 ' + fail + ' 项');
    process.exit(fail ? 1 : 0);
  });
