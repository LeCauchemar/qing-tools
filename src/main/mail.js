'use strict';
/**
 * IMAP 邮件（支持多账户）：
 *   1) 每个账户常连接 + IDLE 推送，新邮件秒级到达
 *   2) 轮询兜底（服务器不支持 IDLE / 连接断开时）
 *   3) 按需拉正文，抽验证码与激活链接
 *
 * 数据结构：
 *   store.data.mail.accounts = [{ id, label, host, port, secure, user, pass, auth, clientId, refresh, account,
 *                                 total, unseen, error, mode }]
 *   store.data.mail.items    = [{ key: '<accId>:<uid>', accId, accLabel, uid, seq, subject, ... }]
 */
const { encryptSecret, decryptSecret } = require('./store');
const { decodePart, analyze } = require('./mail-text');
const msOauth = require('./ms-oauth');

const PROVIDERS = {
  qq: { label: 'QQ 邮箱', host: 'imap.qq.com', port: 993, secure: true, hint: '设置 → 账户 → 开启 IMAP，使用「授权码」而不是登录密码' },
  '163': { label: '网易 163', host: 'imap.163.com', port: 993, secure: true, hint: '设置 → POP3/SMTP/IMAP → 开启 IMAP，使用客户端授权码' },
  '126': { label: '网易 126', host: 'imap.126.com', port: 993, secure: true, hint: '同上，使用客户端授权码' },
  gmail: { label: 'Gmail', host: 'imap.gmail.com', port: 993, secure: true, hint: '需开启两步验证并生成「应用专用密码」' },
  outlook: { label: 'Outlook', host: 'outlook.office365.com', port: 993, secure: true, hint: '微软 2024-09 起停用了密码登录 IMAP，Outlook / Hotmail 需要 OAuth 授权' },
  aliyun: { label: '阿里企业邮', host: 'imap.qiye.aliyun.com', port: 993, secure: true, hint: '使用邮箱密码或专用密码' },
  custom: { label: '自定义', host: '', port: 993, secure: true, hint: '填写你的 IMAP 服务器地址与端口' }
};

const BODY_LIMIT = 256 * 1024;
const ITEMS_PER_ACCOUNT = 30;
const MAX_BODIES = 8;

function friendlyError(err) {
  const msg = String((err && (err.responseText || err.message)) || err || '');
  const code = (err && err.code) || '';
  if (/Basic authentication is disabled|Login is disabled|logon is disabled|basic auth/i.test(msg)) {
    return '微软邮箱已停用「密码 / 授权码」登录（2024 年 9 月起），只能走 OAuth 授权；也可以改用 QQ / 163 / Gmail 邮箱';
  }
  if (/AUTHENTICATIONFAILED|Invalid credentials|LOGIN failed|AUTHENTICATE/i.test(msg) || (err instanceof Error && err.name === 'AuthenticationFailure')) {
    return '账号或授权码不正确（QQ/163 邮箱必须用授权码，不是登录密码）';
  }
  if (code === 'ENOTFOUND' || /ENOTFOUND|getaddrinfo/i.test(msg)) return '服务器地址无法解析，请检查 IMAP 服务器填写';
  if (code === 'ETIMEDOUT' || /timeout|ETIMEDOUT/i.test(msg)) return '连接超时，请检查网络或端口（SSL 一般是 993）';
  if (code === 'ECONNREFUSED') return '服务器拒绝连接，端口可能不对';
  if (/certificate|self signed/i.test(msg)) return 'SSL 证书校验失败';
  if (/Too many|LOGIN LIMIT|频繁/i.test(msg)) return '登录过于频繁，请稍后再试';
  if (/IDLE/i.test(msg)) return '服务器不支持 IMAP IDLE，已改用定时检查';
  return msg.slice(0, 160) || '未知错误';
}

/** 在 bodyStructure 里找第一个可读的文本段 */
function pickTextPart(node, depth = 0) {
  if (!node || depth > 8) return null;
  const type = String(node.type || '').toLowerCase();
  const disp = String(node.disposition || '').toLowerCase();
  if (disp === 'attachment') return null;
  if (node.childNodes && node.childNodes.length) {
    let html = null;
    for (const child of node.childNodes) {
      const found = pickTextPart(child, depth + 1);
      if (found && !found.isHtml) return found; // text/plain 优先
      if (found && !html) html = found;
    }
    return html;
  }
  if (type.startsWith('text/')) {
    return { part: node.part || '1', charset: node.charset || 'utf-8', isHtml: type === 'text/html' };
  }
  return null;
}

/** 同时找出 HTML 版和纯文本版（multipart/alternative 里两者常常都有） */
function pickParts(node, depth = 0, out = { html: null, text: null }) {
  if (!node || depth > 8) return out;
  const type = String(node.type || '').toLowerCase();
  const disp = String(node.disposition || '').toLowerCase();
  if (disp === 'attachment') return out;
  if (node.childNodes && node.childNodes.length) {
    for (const child of node.childNodes) pickParts(child, depth + 1, out);
    return out;
  }
  const part = { part: node.part || '1', charset: node.charset || 'utf-8', isHtml: type === 'text/html' };
  if (type === 'text/html') {
    if (!out.html) out.html = part;
    if (!out.text) out.fallbackText = part;
  } else if (type.startsWith('text/')) {
    if (!out.text) out.text = part;
  }
  return out;
}

function uidOf(key) {
  const s = String(key || '');
  const i = s.indexOf(':');
  return i >= 0 ? s.slice(i + 1) : s;
}

function accIdOf(key) {
  const s = String(key || '');
  const i = s.indexOf(':');
  return i >= 0 ? s.slice(0, i) : '';
}

class MailService {
  constructor(store, hooks = {}) {
    this.store = store;
    this.onChange = hooks.onChange || (() => {});
    this.onNewMail = hooks.onNewMail || (() => {});
    this.log = hooks.log || (() => {});
    this.timer = null;
    /** @type {Map<string, {want:boolean, watching:boolean, client:any, retry:number, exists:number, stop:null|Function}>} */
    this.watchers = new Map();
    /** @type {Map<string, {value:string, expiresAt:number}>} */
    this.tokens = new Map();
    /** 正文缓存：key -> { text, html, isHtml } */
    this.bodies = new Map();
    this.busy = new Set();
    this.migrate();
  }

  // ------------------------------------------------------------ 账户数据
  get accounts() {
    const m = this.store.data.mail;
    if (!Array.isArray(m.accounts)) m.accounts = [];
    return m.accounts;
  }

  migrate() {
    const m = this.store.data.mail;
    if (!Array.isArray(m.accounts)) m.accounts = [];
    const old = m.config;
    if (old && old.host) {
      const dup = m.accounts.some((a) => a.user === old.user && a.host === old.host);
      if (!dup) {
        m.accounts.push({
          id: 'acc_' + Date.now().toString(36),
          label: old.label || old.user || '邮箱',
          host: old.host,
          port: Number(old.port) || 993,
          secure: old.secure !== false,
          user: old.user || '',
          pass: old.pass || '',
          auth: old.auth === 'oauth' ? 'oauth' : 'password',
          clientId: old.clientId || '',
          refresh: old.refresh || '',
          account: old.account || '',
          total: Number(old.total) || 0,
          unseen: Number(old.unseen) || 0,
          error: '',
          mode: 'off'
        });
      }
      // 旧的 items：补 key / accId
      const first = m.accounts[0];
      if (first && Array.isArray(m.items)) {
        m.items = m.items.map((i) => (i.key ? i : { ...i, key: first.id + ':' + i.uid, accId: first.id, accLabel: first.label }));
      }
    }
    if (old !== undefined) delete m.config;
    if (!Array.isArray(m.items)) m.items = [];
    if (typeof m.unseen !== 'number') m.unseen = 0;
    this.store.save();
  }

  account(id) {
    return this.accounts.find((a) => a.id === id) || null;
  }

  get configured() {
    return this.accounts.some((a) => this.isReady(a));
  }

  isReady(acc) {
    if (!acc || !acc.host || !acc.user) return false;
    if (acc.auth === 'oauth') return !!acc.refresh;
    return !!acc.pass;
  }

  plainCfg(raw) {
    if (!raw) return null;
    const dec = (v) =>
      v && (String(v).startsWith('dpapi:') || String(v).startsWith('b64:')) ? decryptSecret(v) : v || '';
    return {
      id: String(raw.id || ''),
      label: raw.label || '',
      host: String(raw.host || '').trim(),
      port: Number(raw.port) || 993,
      secure: raw.secure !== false,
      user: String(raw.user || '').trim(),
      pass: String(dec(raw.pass) || ''),
      auth: raw.auth === 'oauth' ? 'oauth' : 'password',
      clientId: String(raw.clientId || '').trim(),
      refresh: String(dec(raw.refresh) || ''),
      account: String(raw.account || '')
    };
  }

  cfgOf(acc) {
    return this.plainCfg(acc);
  }

  /** 聚合状态写回 store，供界面显示 */
  syncStats() {
    const m = this.store.data.mail;
    const accs = this.accounts;
    m.unseen = accs.reduce((n, a) => n + (Number(a.unseen) || 0), 0);
    m.total = accs.reduce((n, a) => n + (Number(a.total) || 0), 0);
    const modes = accs.map((a) => a.mode || 'off');
    m.mode = modes.includes('idle')
      ? 'idle'
      : modes.includes('connecting')
        ? 'connecting'
        : accs.some((a) => this.isReady(a))
          ? 'poll'
          : 'off';
    const err = accs.find((a) => a.error);
    m.watchError = err ? err.error : '';
    m.error = err ? err.error : null;
  }

  setAccMode(acc, mode, error = '') {
    if (!acc) return;
    if (acc.mode === mode && (acc.error || '') === (error || '')) return;
    acc.mode = mode;
    acc.error = error || '';
    this.syncStats();
    this.store.save();
    this.onChange();
    this.reschedule();
  }

  // ------------------------------------------------------------ OAuth
  async accessToken(acc, force = false) {
    const cfg = this.plainCfg(acc) || {};
    const now = Date.now();
    const cached = this.tokens.get(cfg.id || cfg.user);
    if (!force && cached && cached.expiresAt - now > 120000) return cached.value;
    if (!cfg.refresh) throw new Error('微软授权已失效，请重新点「用微软账户登录」');
    const r = await msOauth.refreshAccessToken(cfg.clientId, cfg.refresh);
    if (!r.ok) throw new Error('微软授权续期失败：' + (r.error || '未知原因'));
    this.tokens.set(cfg.id || cfg.user, { value: r.accessToken, expiresAt: now + (Number(r.expiresIn) || 3600) * 1000 });
    if (r.refreshToken && r.refreshToken !== cfg.refresh) {
      const stored = this.account(cfg.id);
      if (stored && stored.auth === 'oauth') {
        stored.refresh = encryptSecret(r.refreshToken);
        this.store.save();
      }
    }
    return r.accessToken;
  }

  /** 登录成功后把 OAuth 结果写进某个账户（没指定就新建一个） */
  applyOAuth(result, meta = {}) {
    const base = meta.base || {};
    let acc = meta.accountId ? this.account(meta.accountId) : null;
    if (!acc) {
      acc = {
        id: 'acc_' + Date.now().toString(36),
        total: 0,
        unseen: 0,
        error: '',
        mode: 'off'
      };
      this.accounts.push(acc);
    }
    acc.label = base.label || acc.label || 'Outlook';
    acc.host = base.host || acc.host || 'outlook.office365.com';
    acc.port = Number(base.port || acc.port || 993);
    acc.secure = true;
    acc.user = result.account || base.user || acc.user || '';
    acc.auth = 'oauth';
    acc.clientId = String(meta.clientId || acc.clientId || '').trim();
    acc.refresh = encryptSecret(result.refreshToken || '');
    acc.account = result.account || '';
    acc.pass = '';
    this.tokens.set(acc.id, {
      value: result.accessToken,
      expiresAt: Date.now() + (Number(result.expiresIn) || 3600) * 1000
    });
    acc.error = '';
    this.syncStats();
    this.store.save();
    this.onChange();
    return acc;
  }

  // ------------------------------------------------------------ 连接
  async connect(cfg, extra = {}) {
    const { ImapFlow } = require('imapflow');
    const auth =
      cfg.auth === 'oauth'
        ? { user: cfg.user, accessToken: await this.accessToken(cfg) }
        : { user: cfg.user, pass: cfg.pass };
    const client = new ImapFlow({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure !== false,
      auth,
      logger: false,
      emitLogs: false,
      tls: { rejectUnauthorized: false },
      socketTimeout: 60000,
      greetingTimeout: 12000,
      maxIdleTime: 4 * 60 * 1000,
      ...extra
    });
    client.on('error', () => {});
    await client.connect();
    return client;
  }

  // ------------------------------------------------------------ 生命周期
  start() {
    for (const acc of this.accounts) {
      if (!this.isReady(acc)) continue;
      this.refresh({ silent: true, accId: acc.id }).catch(() => {});
      this.startWatch(acc.id);
    }
    this.reschedule();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const id of [...this.watchers.keys()]) this.stopWatch(id);
  }

  reschedule() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (!this.configured) return;
    const mins = Math.min(60, Math.max(1, Number(this.store.data.settings.pollMinutes) || 3));
    const anyIdle = this.accounts.some((a) => a.mode === 'idle');
    const every = anyIdle ? Math.max(mins, 15) : mins;
    this.timer = setInterval(() => this.refresh({ silent: true }).catch(() => {}), every * 60 * 1000);
  }

  watcher(id) {
    let w = this.watchers.get(id);
    if (!w) {
      w = { want: false, watching: false, client: null, retry: 0, exists: 0, stop: null };
      this.watchers.set(id, w);
    }
    return w;
  }

  startWatch(id) {
    const acc = this.account(id);
    if (!acc || !this.isReady(acc)) return;
    const w = this.watcher(id);
    w.want = true;
    if (w.watching) return;
    w.watching = true;
    this.watchLoop(id).catch((err) => {
      this.log('watch loop 退出', id, String(err && err.message));
      w.watching = false;
    });
  }

  stopWatch(id) {
    const w = this.watchers.get(id);
    if (!w) return;
    w.want = false;
    if (w.stop) {
      try {
        w.stop();
      } catch (_) {}
      w.stop = null;
    }
    if (w.client) {
      try {
        w.client.close();
      } catch (_) {}
      w.client = null;
    }
    const acc = this.account(id);
    if (acc) this.setAccMode(acc, 'off');
  }

  async watchLoop(id) {
    const w = this.watcher(id);
    let backoff = 2000;
    while (w.want) {
      const acc = this.account(id);
      if (!acc || !this.isReady(acc)) break;
      let client = null;
      try {
        this.setAccMode(acc, 'connecting');
        client = await this.connect(this.cfgOf(acc));
        w.client = client;
        client.on('exists', (ev) => this.onExists(id, ev));
        await client.mailboxOpen('INBOX');
        w.exists = (client.mailbox && client.mailbox.exists) || 0;
        w.probed = 0;
        w.retry = 0;
        backoff = 2000;
        this.setAccMode(acc, 'idle');
        this.log('idle 已连上', acc.host, 'exists=', w.exists);
        // 第一次连上只静默同步；之后每次重连都按「有新邮件」走一遍，否则断线期间收到的信会被吞掉
        const firstConnect = !w.everConnected;
        w.everConnected = true;
        this.refresh({ silent: firstConnect, via: firstConnect ? 'connect' : 'reconnect', accId: id }).catch(() => {});

        await new Promise((resolve) => {
          let done = false;
          let lastProbe = Date.now();
          const finish = () => {
            if (done) return;
            done = true;
            clearInterval(iv);
            resolve();
          };
          // IDLE 有时会被服务器静默掐断（TCP 半开），收不到 close，
          // 所以每 30 秒探一次：连接不可用了就重连；每 2 分钟用 STATUS 兜底查一次新邮件。
          const iv = setInterval(() => {
            if (done) return;
            try {
              if (!client || client.usable === false) {
                this.log('idle 连接不可用，重连', id);
                finish();
                return;
              }
              if (Date.now() - lastProbe < 120000) return;
              lastProbe = Date.now();
              client
                .status('INBOX', { messages: true, unseen: true })
                .then((st) => {
                  const n = Number(st && st.messages);
                  if (Number.isFinite(n) && n > w.exists + (w.probed || 0)) {
                    w.probed = n - w.exists;
                    this.refresh({ silent: false, via: 'probe', accId: id }).catch(() => {});
                  }
                })
                .catch(() => {
                  if (!done) finish();
                });
            } catch (_) {
              if (!done) finish();
            }
          }, 30000);
          client.once('close', finish);
          client.once('error', finish);
          w.stop = finish;
        });

        if (w.want) {
          const cur = this.account(id);
          if (cur) this.setAccMode(cur, 'poll', '连接已断开，正在重连');
          w.retry += 1;
          backoff = Math.min(60000, 2000 * Math.pow(2, Math.min(w.retry, 4)));
        }
      } catch (err) {
        const msg = friendlyError(err);
        this.log('idle 连接失败', id, msg);
        const cur = this.account(id);
        if (cur) this.setAccMode(cur, 'poll', msg);
        w.retry += 1;
        backoff = Math.min(60000, 3000 * Math.pow(2, Math.min(w.retry, 4)));
      } finally {
        w.stop = null;
        const c = client;
        w.client = null;
        if (c) {
          try {
            c.removeAllListeners('close');
            c.removeAllListeners('error');
            c.close();
          } catch (_) {}
        }
      }
      if (!w.want) break;
      await new Promise((r) => setTimeout(r, backoff));
    }
    w.watching = false;
    const acc = this.account(id);
    if (acc && acc.mode !== 'off') this.setAccMode(acc, this.isReady(acc) ? 'poll' : 'off');
  }

  onExists(id, ev) {
    const w = this.watcher(id);
    const count = Number(ev && ev.count);
    const prev = Number(ev && ev.prevCount);
    const now = Number.isFinite(count) ? count : w.exists + 1;
    const was = Number.isFinite(prev) ? prev : w.exists;
    w.exists = now;
    w.probed = 0;
    if (!(now > was)) return;
    clearTimeout(w.pending);
    w.pending = setTimeout(() => {
      this.refresh({ silent: false, via: 'push', accId: id }).catch(() => {});
    }, 900);
  }

  // ------------------------------------------------------------ 同步
  async refresh({ silent = false, via = 'poll', accId = '' } = {}) {
    const targets = accId ? [this.account(accId)].filter(Boolean) : this.accounts.filter((a) => this.isReady(a));
    if (!targets.length) return { ok: false, skipped: true };
    const results = [];
    for (const acc of targets) {
      if (this.busy.has(acc.id)) continue;
      this.busy.add(acc.id);
      // eslint-disable-next-line no-await-in-loop
      const r = await this.refreshOne(acc, { silent, via });
      this.busy.delete(acc.id);
      results.push({ id: acc.id, ...r });
    }
    this.syncStats();
    this.store.save();
    this.onChange();
    const ok = results.some((r) => r.ok);
    return {
      ok,
      total: this.store.data.mail.total,
      unseen: this.store.data.mail.unseen,
      fresh: results.reduce((n, r) => n + (r.fresh || 0), 0),
      results,
      message: ok ? '' : (results[0] && results[0].message) || ''
    };
  }

  async refreshOne(acc, { silent = false, via = 'poll' } = {}) {
    let client;
    let pendingPush = null;
    try {
      client = await this.connect(this.cfgOf(acc));
      const st = await client.status('INBOX', { messages: true, unseen: true });
      const total = st.messages || 0;
      const unseen = st.unseen || 0;

      const items = [];
      if (total > 0) {
        const start = Math.max(1, total - (ITEMS_PER_ACCOUNT - 1));
        const lock = await client.getMailboxLock('INBOX');
        try {
          for await (const msg of client.fetch(`${start}:*`, { envelope: true, flags: true, uid: true })) {
            const env = msg.envelope || {};
            const from = (env.from && env.from[0]) || {};
            const key = acc.id + ':' + msg.uid;
            const old = (this.store.data.mail.items || []).find((i) => i.key === key);
            items.push({
              key,
              accId: acc.id,
              accLabel: acc.label || acc.user,
              uid: msg.uid,
              seq: msg.seq,
              subject: env.subject || '(无主题)',
              fromName: from.name || '',
              fromAddr: from.address || '',
              date: env.date ? new Date(env.date).toISOString() : null,
              seen: msg.flags ? msg.flags.has('\\Seen') : false,
              code: old ? old.code || '' : '',
              codeOthers: (old && old.codeOthers) || [],
              links: old ? old.links || [] : [],
              preview: old ? old.preview || '' : '',
              fetched: old ? !!old.fetched : false
            });
          }
        } finally {
          lock.release();
        }
      }
      items.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

      const before = new Set((this.store.data.mail.items || []).filter((i) => i.accId === acc.id).map((i) => i.key));
      const fresh = items.filter((i) => !i.seen && !before.has(i.key));

      // 合并：其它账户的条目原样保留
      const others = (this.store.data.mail.items || []).filter((i) => i.accId !== acc.id);
      this.store.data.mail.items = others.concat(items).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

      acc.total = total;
      acc.unseen = unseen;
      acc.error = '';
      acc.lastSync = Date.now();
      this.syncStats();
      this.store.save();
      this.onChange();

      if (fresh.length && via === 'push') {
        // 不在这个连接上抓正文：同账号并发连接容易被服务器拒/超时，
        // 之前就是这样导致推送出去的邮件没有验证码，要手动展开详情才出现。
        pendingPush = {
          newest: fresh[0],
          info: { count: this.store.data.mail.unseen, fresh: fresh.length, silent, via, account: acc }
        };
      }
      return { ok: true, total, unseen, fresh: fresh.length };
    } catch (err) {
      const message = friendlyError(err);
      acc.error = message;
      this.store.save();
      this.onChange();
      return { ok: false, message };
    } finally {
      try {
        client && (await client.logout());
      } catch (_) {}
      // 连接关掉之后再补抓验证码，抓不到就隔一会儿重试一次
      if (pendingPush) this.pushEnriched(pendingPush).catch((err) => console.error('[mail] push enrich failed', err));
    }
  }

  async pushEnriched({ newest, info }) {
    let out = { ...newest };
    for (let i = 0; i < 2 && !out.code; i += 1) {
      const d = await this.detail(newest.key, { quiet: true, force: i > 0 }).catch(() => null);
      if (d && d.ok) {
        out = {
          ...out,
          code: d.code || out.code || '',
          codeOthers: d.codeOthers || [],
          links: d.links || out.links || [],
          preview: d.preview || out.preview || ''
        };
      }
      if (!out.code) await new Promise((r) => setTimeout(r, 1200));
    }
    // 正文里实在没有，就从主题里再抽一次（很多站把验证码写在标题上）
    if (!out.code) {
      try {
        const guess = analyze(String(newest.subject || '') + '\n' + String(newest.fromName || ''));
        if (guess && guess.code) out.code = guess.code;
      } catch (_) {}
    }
    this.onNewMail(out, info);
  }

  // ------------------------------------------------------------ 正文 / 验证码
  async detail(key, { quiet = false, force = false } = {}) {
    const item = (this.store.data.mail.items || []).find((i) => i.key === key);
    if (!item) return { ok: false, message: '邮件不在了，刷新看看' };
    const cachedBody = this.bodies.get(key);
    if (item.fetched && !force && cachedBody) {
      return {
        ok: true,
        cached: true,
        code: item.code || '',
        codeOthers: item.codeOthers || [],
        links: item.links || [],
        preview: item.preview || '',
        subject: item.subject || '',
        fromName: item.fromName || '',
        fromAddr: item.fromAddr || '',
        date: item.date || null,
        account: item.accLabel || '',
        text: cachedBody.text || '',
        html: cachedBody.html || '',
        isHtml: !!cachedBody.isHtml
      };
    }
    const acc = this.account(item.accId);
    if (!acc || !this.isReady(acc)) return { ok: false, message: '这个邮箱还没配置好' };

    const uid = String(item.uid);
    let client;
    try {
      client = await this.connect(this.cfgOf(acc));
      const lock = await client.getMailboxLock('INBOX');
      let parsed = { code: '', links: [], preview: '', text: '' };
      let htmlRaw = '';
      let textRaw = '';
      let isHtml = false;
      try {
        const found = await client.fetchOne(uid, { bodyStructure: true }, { uid: true });
        const parts = pickParts(found && found.bodyStructure);
        const grab = async (p) => {
          if (!p) return '';
          const { content } = await client.download(uid, p.part, { uid: true, maxBytes: BODY_LIMIT });
          const chunks = [];
          for await (const chunk of content) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
          }
          return decodePart(Buffer.concat(chunks), p.charset);
        };
        textRaw = await grab(parts.text);
        htmlRaw = await grab(parts.html);
        isHtml = !!htmlRaw;
        parsed = analyze(textRaw || htmlRaw || '', { isHtml: !textRaw && !!htmlRaw });
      } finally {
        lock.release();
      }

      item.code = parsed.code || '';
      item.codeOthers = parsed.codeOthers || [];
      item.links = parsed.links || [];
      item.preview = parsed.preview || '';
      item.fetched = true;
      item.fetchedAt = Date.now();
      this.bodies.set(key, { text: textRaw || parsed.text || '', html: htmlRaw, isHtml });
      while (this.bodies.size > MAX_BODIES) {
        const oldest = this.bodies.keys().next().value;
        this.bodies.delete(oldest);
      }
      this.store.save();
      if (!quiet) this.onChange();
      return {
        ok: true,
        code: item.code,
        codeOthers: item.codeOthers,
        links: item.links,
        preview: item.preview,
        subject: item.subject || '',
        fromName: item.fromName || '',
        fromAddr: item.fromAddr || '',
        date: item.date || null,
        account: item.accLabel || '',
        text: textRaw || parsed.text || '',
        html: htmlRaw,
        isHtml
      };
    } catch (err) {
      const message = friendlyError(err);
      if (!quiet) this.onChange();
      return { ok: false, message };
    } finally {
      try {
        client && (await client.logout());
      } catch (_) {}
    }
  }

  async markRead(key) {
    const item = (this.store.data.mail.items || []).find((i) => i.key === key);
    if (!item) return { ok: false };
    const acc = this.account(item.accId);
    if (!acc || !this.isReady(acc)) return { ok: false };
    let client;
    try {
      client = await this.connect(this.cfgOf(acc));
      const lock = await client.getMailboxLock('INBOX');
      try {
        await client.messageFlagsAdd(String(item.uid), ['\\Seen'], { uid: true });
      } finally {
        lock.release();
      }
      if (!item.seen) {
        item.seen = true;
        acc.unseen = Math.max(0, (Number(acc.unseen) || 1) - 1);
      }
      this.syncStats();
      this.store.save();
      this.onChange();
      return { ok: true };
    } catch (err) {
      return { ok: false, message: friendlyError(err) };
    } finally {
      try {
        client && (await client.logout());
      } catch (_) {}
    }
  }

  // ------------------------------------------------------------ 增删改 / 测试
  async test(raw) {
    const cfg = this.plainCfg(raw);
    if (!cfg) return { ok: false, message: '请先填写服务器与账号' };
    const stored = cfg.id ? this.account(cfg.id) : null;
    if (stored) {
      // 界面留空的字段沿用已保存的凭据
      if (!cfg.pass) cfg.pass = decryptSecret(stored.pass) || '';
      if (!cfg.refresh) cfg.refresh = decryptSecret(stored.refresh) || '';
      if (!cfg.clientId) cfg.clientId = stored.clientId || '';
      if (!cfg.user) cfg.user = stored.user || '';
    }
    let client;
    try {
      client = await this.connect(cfg);
      await client.mailboxOpen('INBOX');
      const st = await client.status('INBOX', { messages: true, unseen: true });
      return { ok: true, message: '连接成功：共 ' + (st.messages || 0) + ' 封，未读 ' + (st.unseen || 0) };
    } catch (err) {
      return { ok: false, message: friendlyError(err) };
    } finally {
      try {
        client && (await client.logout());
      } catch (_) {}
    }
  }

  save(raw) {
    const cfg = this.plainCfg(raw);
    if (!cfg) return { ok: false, message: '配置为空' };
    let acc = cfg.id ? this.account(cfg.id) : null;
    if (!acc) {
      acc = { id: 'acc_' + Date.now().toString(36), total: 0, unseen: 0, error: '', mode: 'off' };
      this.accounts.push(acc);
    }
    acc.label = cfg.label || cfg.user || acc.label || '邮箱';
    acc.host = cfg.host;
    acc.port = cfg.port;
    acc.secure = cfg.secure;
    acc.user = cfg.user;
    acc.auth = cfg.auth;
    // 密码留空 = 沿用旧授权码，避免「改了服务器结果密码被清空」
    acc.pass = cfg.pass ? encryptSecret(cfg.pass) : acc.pass || '';
    if (cfg.auth === 'oauth') {
      acc.refresh = cfg.refresh ? encryptSecret(cfg.refresh) : acc.refresh || '';
      acc.clientId = cfg.clientId || acc.clientId || '';
      acc.account = cfg.account || acc.account || '';
    }
    acc.error = '';
    this.syncStats();
    this.store.save();
    this.restartWatch(acc.id);
    this.reschedule();
    this.onChange();
    if (this.isReady(acc)) this.refresh({ silent: true, accId: acc.id }).catch(() => {});
    return { ok: true, id: acc.id };
  }

  remove(id) {
    const i = this.accounts.findIndex((a) => a.id === id);
    if (i < 0) return { ok: false };
    this.stopWatch(id);
    this.tokens.delete(id);
    this.accounts.splice(i, 1);
    this.store.data.mail.items = (this.store.data.mail.items || []).filter((m) => m.accId !== id);
    for (const k of [...this.bodies.keys()]) if (accIdOf(k) === id) this.bodies.delete(k);
    this.syncStats();
    this.store.save();
    this.restartWatch();
    this.reschedule();
    this.onChange();
    return { ok: true };
  }

  restartWatch(id = '') {
    if (id) {
      this.stopWatch(id);
      this.startWatch(id);
      return;
    }
    for (const a of this.accounts) {
      this.stopWatch(a.id);
      this.startWatch(a.id);
    }
  }

  disconnect() {
    for (const a of [...this.accounts]) this.remove(a.id);
  }
}

module.exports = { MailService, PROVIDERS, pickTextPart, friendlyError, uidOf, accIdOf };
