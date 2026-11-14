'use strict';
/**
 * 账号客户端（M2）
 * - 只做「这台电脑」的登录态：token + 用户快照，token 用 DPAPI 加密后落 account.json
 * - 所有请求走 https://chat.ccyyqq.com/island（和服务端同一套接口，见 docs/qing-account-plan.md §6）
 * - 401 一律视为「登录已失效」：清掉本地 token，让界面回到未登录
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { app, safeStorage } = require('electron');

const BASE = 'https://chat.ccyyqq.com/island';
const TIMEOUT = 15000;

function fileOf() {
  return path.join(app.getPath('userData'), 'account.json');
}

function encrypt(plain) {
  if (!plain) return '';
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return 'dpapi:' + safeStorage.encryptString(String(plain)).toString('base64');
    }
  } catch (_) {
    /* ignore */
  }
  return 'b64:' + Buffer.from(String(plain), 'utf8').toString('base64');
}

function decrypt(value) {
  if (!value) return '';
  try {
    if (value.startsWith('dpapi:')) return safeStorage.decryptString(Buffer.from(value.slice(6), 'base64'));
    if (value.startsWith('b64:')) return Buffer.from(value.slice(4), 'base64').toString('utf8');
  } catch (_) {
    /* ignore */
  }
  return '';
}

class Account {
  constructor() {
    this.token = '';
    this.expiresAt = 0;
    this.user = null;
    this.checkedAt = 0;
    this._load();
  }

  _load() {
    try {
      const raw = JSON.parse(fs.readFileSync(fileOf(), 'utf8'));
      this.token = decrypt(raw.tokenEnc || '');
      this.expiresAt = Number(raw.expiresAt) || 0;
      this.user = raw.user || null;
    } catch (_) {
      /* 首次运行没有这个文件 */
    }
  }

  _save() {
    const body = {
      version: 1,
      tokenEnc: encrypt(this.token),
      expiresAt: this.expiresAt,
      user: this.user,
      savedAt: Date.now()
    };
    const file = fileOf();
    const tmp = file + '.tmp';
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(body, null, 2), 'utf8');
    fs.renameSync(tmp, file);
  }

  _clear() {
    this.token = '';
    this.expiresAt = 0;
    this.user = null;
    try {
      fs.unlinkSync(fileOf());
    } catch (_) {
      /* ignore */
    }
  }

  get signedIn() {
    return !!this.token && !!this.user;
  }

  status() {
    return {
      signedIn: this.signedIn,
      user: this.user,
      expiresAt: this.expiresAt,
      server: BASE,
      deviceName: this.deviceName()
    };
  }

  deviceName() {
    let host = '';
    try {
      host = os.hostname();
    } catch (_) {
      /* ignore */
    }
    return (host || 'Windows').slice(0, 40);
  }

  async _call(method, pathname, opts = {}) {
    const { body, auth = true, timeout = TIMEOUT } = opts;
    const headers = { 'content-type': 'application/json' };
    if (auth && this.token) headers.authorization = 'Bearer ' + this.token;
    let res;
    try {
      res = await fetch(BASE + pathname, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeout)
      });
    } catch (e) {
      const timeoutish = e && (e.name === 'TimeoutError' || e.name === 'AbortError');
      return { ok: false, code: timeoutish ? 'timeout' : 'network', message: timeoutish ? '服务器没响应，稍后再试' : '连不上服务器，检查一下网络' };
    }
    let data = {};
    try {
      data = await res.json();
    } catch (_) {
      data = { ok: false, code: 'bad_response', message: '服务器返回看不懂的内容（HTTP ' + res.status + '）' };
    }
    if (res.status === 401 || data.code === 'unauthorized') {
      this._clear();
      return { ok: false, code: 'unauthorized', message: data.message || '登录已过期，请重新登录' };
    }
    if (!res.ok && !data.message) {
      return { ok: false, code: data.code || 'http_' + res.status, message: '请求失败（HTTP ' + res.status + '）' };
    }
    return data;
  }

  _applyAuth(data) {
    if (!data || !data.ok || !data.token) return data;
    this.token = data.token;
    this.expiresAt = Number(data.expiresAt) || 0;
    this.user = data.user || null;
    this._save();
    return data;
  }

  /** 用户名是否可用（注册前预检） */
  async check(username) {
    const u = String(username || '').trim();
    if (!u) return { ok: false, code: 'bad_username', message: '先填用户名' };
    return this._call('GET', '/api/auth/check?u=' + encodeURIComponent(u), { auth: false });
  }

  async register({ username, password, nick } = {}) {
    const data = await this._call('POST', '/api/auth/register', {
      auth: false,
      body: { username, password, nick, deviceName: this.deviceName() }
    });
    return this._applyAuth(data);
  }

  async login({ username, password } = {}) {
    const data = await this._call('POST', '/api/auth/login', {
      auth: false,
      body: { username, password, deviceName: this.deviceName() }
    });
    return this._applyAuth(data);
  }

  async recover({ username, code, newPassword } = {}) {
    const data = await this._call('POST', '/api/auth/recover', {
      auth: false,
      body: { username, code, newPassword, deviceName: this.deviceName() }
    });
    return this._applyAuth(data);
  }

  /** 认领一个频道（先到先得）；已经归属别人会返回 { ok:false, code:'taken' } */
  claimRoom(code) {
    return this._call('POST', '/api/rooms/claim', { body: { code: String(code || '').replace(/\s+/g, '') } });
  }

  /** 这个账号名下的频道列表（M5：换台电脑登录，频道能自己回来） */
  myRooms() {
    return this._call('GET', '/api/me/rooms');
  }

  /** 亲密好友（M6）：列表 / 申请 / 同意 / 拒绝 / 解除 */
  bindings() {
    return this._call('GET', '/api/bindings');
  }

  bind(username) {
    return this._call('POST', '/api/bindings', { body: { username: String(username || '').trim() } });
  }

  bindingAct(id, act) {
    const a = act === 'accept' ? 'accept' : act === 'reject' ? 'reject' : '';
    if (!a) return this._call('DELETE', '/api/bindings/' + encodeURIComponent(id));
    return this._call('POST', '/api/bindings/' + encodeURIComponent(id) + '/' + a, { body: {} });
  }

  /** 把一条事项分享给好友（服务端复制一份到对方名下） */
  share({ toUserId, kind, text, sourceItem } = {}) {
    return this._call('POST', '/api/shares', {
      body: { toUserId, kind: kind === 'todo' ? 'todo' : 'note', text: String(text || ''), sourceItem: sourceItem || '' }
    });
  }

  /** 我收到的分享（未读） */
  shareInbox() {
    return this._call('GET', '/api/shares/inbox');
  }

  shareRead(id) {
    return this._call('POST', '/api/shares/' + encodeURIComponent(id) + '/read', { body: {} });
  }

  /** 拉一次账号信息 + 设备列表；顺带校验 token 是否还有效 */
  async me() {
    if (!this.token) return { ok: false, code: 'unauthorized', message: '还没登录' };
    const data = await this._call('GET', '/api/me');
    if (data && data.ok) {
      this.user = data.user || this.user;
      this.checkedAt = Date.now();
      this._save();
    }
    return data;
  }

  async revokeSession(id) {
    return this._call('DELETE', '/api/me/sessions/' + encodeURIComponent(id));
  }

  async logout() {
    let out = { ok: true };
    if (this.token) out = await this._call('POST', '/api/auth/logout');
    this._clear();
    return out && out.ok === false ? out : { ok: true };
  }

  async logoutAll() {
    let out = { ok: true };
    if (this.token) out = await this._call('POST', '/api/auth/logout-all');
    this._clear();
    return out && out.ok === false ? out : { ok: true };
  }

  async remove({ username, password, code } = {}) {
    const data = await this._call('DELETE', '/api/me', { body: { username, password, code } });
    if (data && data.ok) this._clear();
    return data;
  }
}

let instance = null;
function account() {
  if (!instance) instance = new Account();
  return instance;
}

function registerAccountIpc(ipcMain, hooks = {}) {
  const a = account();
  const onIn = () => {
    try {
      if (hooks.onSignedIn && a.user) hooks.onSignedIn(a.user);
    } catch (_) {}
  };
  const onOut = () => {
    try {
      if (hooks.onSignedOut) hooks.onSignedOut();
    } catch (_) {}
  };
  const wrap = (fn) =>
    async (_e, payload) => {
      try {
        return await fn(payload || {});
      } catch (e) {
        return { ok: false, code: 'exception', message: String((e && e.message) || e) };
      }
    };
  ipcMain.handle('account:status', () => a.status());
  ipcMain.handle('account:check', wrap((p) => a.check(p.username)));
  ipcMain.handle(
    'account:register',
    wrap(async (p) => {
      const r = await a.register(p);
      if (r && r.ok) onIn();
      return r;
    })
  );
  ipcMain.handle(
    'account:login',
    wrap(async (p) => {
      const r = await a.login(p);
      if (r && r.ok) onIn();
      return r;
    })
  );
  ipcMain.handle(
    'account:recover',
    wrap(async (p) => {
      const r = await a.recover(p);
      if (r && r.ok) onIn();
      return r;
    })
  );
  ipcMain.handle('account:me', wrap(async () => {
    const r = await a.me();
    if (r && r.ok) onIn();
    return r;
  }));
  ipcMain.handle('account:revokeSession', wrap((p) => a.revokeSession(p.id)));
  ipcMain.handle('account:claimRoom', wrap((p) => a.claimRoom(p && p.code)));
  ipcMain.handle('account:myRooms', wrap(() => a.myRooms()));
  ipcMain.handle('account:bindings', wrap(() => a.bindings()));
  ipcMain.handle('account:bind', wrap((p) => a.bind(p && p.username)));
  ipcMain.handle('account:bindingAct', wrap((p) => a.bindingAct(p && p.id, p && p.act)));
  ipcMain.handle('account:share', wrap((p) => a.share(p)));
  ipcMain.handle('account:shareInbox', wrap(() => a.shareInbox()));
  ipcMain.handle('account:shareRead', wrap((p) => a.shareRead(p && p.id)));

  ipcMain.handle(
    'account:logout',
    wrap(async () => {
      const r = await a.logout();
      onOut();
      return r;
    })
  );
  ipcMain.handle(
    'account:logoutAll',
    wrap(async () => {
      const r = await a.logoutAll();
      onOut();
      return r;
    })
  );
  ipcMain.handle(
    'account:remove',
    wrap(async (p) => {
      const r = await a.remove(p);
      if (r && r.ok) onOut();
      return r;
    })
  );
  return a;
}

module.exports = { account, registerAccountIpc, ACCOUNT_BASE: BASE };
