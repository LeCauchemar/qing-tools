'use strict';

/**
 * Everything（voidtools）联动：
 * - 找已安装的 Everything.exe（注册表 → 常见目录 → 设置里手填）
 * - 需要时把 HTTP 服务器打开（127.0.0.1:8010）并把它启动起来
 * - 没装时用安装包里内置的官方安装程序静默安装（会弹一次 UAC），装完自动连上
 *
 * 对外只暴露 Promise 方法，永不 throw。
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFile, spawn } = require('node:child_process');

const PORT = 8010;
const HOST = '127.0.0.1';
const SETUP_NAME = 'Everything-1.4.1.1032.x64-Setup.exe';

function run(cmd, args, timeout = 20000) {
  return new Promise((resolve) => {
    let done = false;
    const child = execFile(cmd, args, { windowsHide: true, timeout }, (err, stdout, stderr) => {
      if (done) return;
      done = true;
      resolve({
        ok: !err,
        code: err && typeof err.code === 'number' ? err.code : err ? 1 : 0,
        out: String(stdout || '').trim(),
        err: String(stderr || '').trim()
      });
    });
    child.on('error', () => {
      if (done) return;
      done = true;
      resolve({ ok: false, code: -1, out: '', err: 'spawn failed' });
    });
  });
}

function exists(p) {
  try {
    return !!p && fs.existsSync(p);
  } catch {
    return false;
  }
}

/** 从注册表卸载项里找 InstallLocation */
async function regLocations() {
  const out = [];
  const keys = [
    'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
  ];
  for (const key of keys) {
    const r = await run('reg.exe', ['query', key, '/s', '/f', 'Everything', '/t', 'REG_SZ', '/v', 'InstallLocation'], 15000);
    if (!r.ok || !r.out) continue;
    for (const line of r.out.split(/\r?\n/)) {
      const m = /InstallLocation\s+REG_SZ\s+(.+)$/.exec(line);
      if (m && m[1].trim()) out.push(m[1].trim());
    }
  }
  return out;
}

async function uninstallVersion() {
  const keys = [
    'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Everything',
    'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Everything (x64)',
    'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Everything'
  ];
  for (const key of keys) {
    const r = await run('reg.exe', ['query', key, '/v', 'DisplayVersion'], 10000);
    if (r.ok) {
      const m = /DisplayVersion\s+REG_SZ\s+(.+)$/.exec(r.out);
      if (m) return m[1].trim();
    }
  }
  return '';
}

class EverythingService {
  constructor({ getSettings, log, resourcesPath } = {}) {
    this.getSettings = typeof getSettings === 'function' ? getSettings : () => ({});
    this.log = typeof log === 'function' ? log : () => {};
    this.resourcesPath = resourcesPath || process.resourcesPath || '';
    this.exe = '';
    this.version = '';
  }

  get port() {
    const s = this.getSettings() || {};
    const n = Number(s.everythingPort);
    return Number.isFinite(n) && n > 0 && n < 65536 ? Math.round(n) : PORT;
  }

  get base() {
    return `http://${HOST}:${this.port}`;
  }

  /** 内置安装包路径（打包后在 resources/everything/） */
  get setupFile() {
    const cands = [
      path.join(this.resourcesPath, 'everything', SETUP_NAME),
      path.join(__dirname, '..', '..', 'vendor', 'everything', SETUP_NAME)
    ];
    return cands.find(exists) || '';
  }

  iniPath() {
    // 安装版读的是 %APPDATA%\Everything\Everything.ini；只有「绿色版」（设置里手填 exe 且
    // exe 同目录有 ini）才用 exe 旁边的 ini。优先 APPDATA，避免改错文件后不生效。
    const appdata = process.env.APPDATA || '';
    const roaming = appdata ? path.join(appdata, 'Everything', 'Everything.ini') : '';
    if (roaming && exists(roaming)) return roaming;
    const s = this.getSettings() || {};
    const exeDir = this.exe ? path.dirname(this.exe) : '';
    const beside = exeDir ? path.join(exeDir, 'Everything.ini') : '';
    if (s.everythingPath && beside && exists(beside)) return beside;
    return roaming || beside;
  }

  readIni() {
    const p = this.iniPath();
    if (!exists(p)) return { path: p, text: '', map: {} };
    let text = '';
    try {
      text = fs.readFileSync(p, 'utf8');
    } catch {
      return { path: p, text: '', map: {} };
    }
    const map = {};
    for (const line of text.split(/\r?\n/)) {
      const m = /^([A-Za-z0-9_]+)=(.*)$/.exec(line);
      if (m) map[m[1]] = m[2];
    }
    return { path: p, text, map };
  }

  writeIniKeys(pairs) {
    const ini = this.readIni();
    if (!ini.path) return { ok: false, message: '找不到 Everything.ini' };
    const lines = ini.text ? ini.text.split(/\r?\n/) : [];
    const seen = new Set();
    const out = lines.map((line) => {
      const m = /^([A-Za-z0-9_]+)=(.*)$/.exec(line);
      if (m && Object.prototype.hasOwnProperty.call(pairs, m[1])) {
        seen.add(m[1]);
        return `${m[1]}=${pairs[m[1]]}`;
      }
      return line;
    });
    for (const [k, v] of Object.entries(pairs)) if (!seen.has(k)) out.push(`${k}=${v}`);
    try {
      if (!exists(ini.path + '.bak-qingtools')) fs.writeFileSync(ini.path + '.bak-qingtools', ini.text, 'utf8');
      fs.writeFileSync(ini.path, out.join('\r\n'), 'utf8');
      return { ok: true, path: ini.path };
    } catch (e) {
      return { ok: false, message: String(e && e.message ? e.message : e) };
    }
  }

  /** 直接问 HTTP 接口，能拿到 JSON 就算活着 */
  async ping(timeout = 1500) {
    try {
      const ctl = AbortSignal.timeout(timeout);
      // 必须带个 search 表达式：空查询会让 Everything 把整个索引吐回来，响应会大到爆
      const res = await fetch(`${this.base}/?search=a&json=1&max=1`, { signal: ctl });
      if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
      const j = await res.json();
      return { ok: true, total: Number(j.totalResults) || 0 };
    } catch (e) {
      return { ok: false, message: String((e && e.message) || e) };
    }
  }

  /** 找 Everything.exe 并记下版本 */
  async detect() {
    const s = this.getSettings() || {};
    const cands = [];
    if (s.everythingPath) cands.push(s.everythingPath);
    for (const loc of await regLocations()) cands.push(path.join(loc, 'Everything.exe'));
    cands.push(
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Everything', 'Everything.exe'),
      path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Everything', 'Everything.exe'),
      'E:\\Program Files\\Everything\\Everything.exe',
      'D:\\Program Files\\Everything\\Everything.exe'
    );
    this.exe = cands.find(exists) || '';
    if (!this.version) this.version = await uninstallVersion();
    return { exe: this.exe, version: this.version };
  }

  async anyRunning() {
    const r = await run('tasklist.exe', ['/FI', 'IMAGENAME eq Everything.exe', '/NH'], 8000);
    return /Everything\.exe/i.test(r.out);
  }

  /** 保证「能查」：服务在跑 + HTTP 开着；必要时改 ini、拉起 Everything */
  async ensure({ start = true, force = false } = {}) {
    const p0 = await this.ping();
    if (p0.ok && !force) {
      if (!this.version) await this.detect();
      return { ok: true, state: 'ready', port: this.port, version: this.version, exe: this.exe };
    }

    const det = await this.detect();
    if (!det.exe) return { ok: false, state: 'missing', port: this.port, version: det.version };

    const wr = this.writeIniKeys({
      http_server_enabled: '1',
      http_server_port: String(this.port),
      http_server_bindings: HOST,
      // ETP 是 FTP 风格协议，和 HTTP 抢同一个端口时会让 HTTP 客户端报「协议冲突」——明确关掉
      etp_server_enabled: '0'
    });
    this.log('everything: ini', wr);

    if (start) {
      const running = await this.anyRunning();
      if (!running || force) {
        try {
          spawn(det.exe, ['-startup', '-minimized'], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
        } catch (e) {
          this.log('everything: spawn failed', String(e && e.message ? e.message : e));
        }
      } else {
        // 已经在跑但没开 HTTP：让它重读 ini
        await run('taskkill.exe', ['/IM', 'Everything.exe', '/F'], 8000);
        await new Promise((r) => setTimeout(r, 900));
        try {
          spawn(det.exe, ['-startup', '-minimized'], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
        } catch (e) {
          this.log('everything: respawn failed', String(e && e.message ? e.message : e));
        }
      }
    }

    for (let i = 0; i < 20; i += 1) {
      await new Promise((r) => setTimeout(r, 500));
      const p = await this.ping(1200);
      if (p.ok) {
        if (!this.version) this.version = await uninstallVersion();
        return { ok: true, state: 'started', port: this.port, version: this.version, exe: this.exe, total: p.total };
      }
    }
    return { ok: false, state: 'timeout', port: this.port, version: this.version, exe: this.exe };
  }

  /** 用内置安装包静默安装（UAC 一次），装完自动 ensure */
  async install() {
    const setup = this.setupFile;
    if (!setup) return { ok: false, message: '安装包里没有带 Everything 安装程序' };
    this.log('everything: install from', setup);
    const ps = [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      `$p = Start-Process -FilePath '${setup.replace(/'/g, "''")}' -ArgumentList '/S' -Verb RunAs -PassThru -Wait; exit $p.ExitCode`
    ];
    const r = await run('powershell.exe', ps, 300000);
    this.log('everything: install result', r);
    if (!r.ok) return { ok: false, message: r.err || '安装被取消或失败' };
    this.version = '';
    return this.ensure({ start: true, force: false });
  }

  async status() {
    const det = await this.detect();
    const p = await this.ping();
    return {
      ok: true,
      installed: !!det.exe,
      running: p.ok,
      exe: det.exe,
      version: det.version,
      port: this.port,
      base: this.base,
      total: p.ok ? p.total : 0,
      builtin: !!this.setupFile,
      message: p.ok ? '' : det.exe ? 'Everything 已安装，但搜索服务还没开' : '没有检测到 Everything'
    };
  }
}

module.exports = { EverythingService, PORT };
