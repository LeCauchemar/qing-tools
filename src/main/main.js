'use strict';
const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  Notification,
  globalShortcut,
  screen,
  shell,
  dialog,
  ipcMain,
  nativeImage,
  clipboard,
  ClipboardItem,
  desktopCapturer,
  protocol,
  net
} = require('electron');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { execFile, spawn } = require('node:child_process');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');

const { Store, uid } = require('./store');
const { ClipWatcher } = require('./clipboard-watcher');
const { MailService, PROVIDERS } = require('./mail');
const msOauth = require('./ms-oauth');
const sysinfo = require('./sysinfo');
const { SearchService } = require('./search');
const { EverythingService } = require('./everything');
let searchService = null;
let everythingService = null;
let oauthPending = null; // 正在进行中的微软设备代码授权

// ---------------------------------------------------------------- 基础环境
const isDev = process.argv.includes('--dev');
const isAutostart = process.argv.includes('--autostart');

const APP_NAME = 'Qing Tools';
// 数据目录沿用旧名，保证改名后老用户的便笺/剪贴板/邮箱配置不丢
const DATA_DIR = path.join(app.getPath('appData'), 'DynamicIsland');
app.setName(APP_NAME);
app.setPath('userData', DATA_DIR);
app.setAppUserModelId('com.dsh.dynamicisland');

const ROOT = path.join(__dirname, '..', '..');
const ASSETS = path.join(ROOT, 'assets');
// 小纸条 / 云存储后端（自建服务器，同时又拍云图床的入口）
const CLOUD_API = process.env.QT_CLOUD_API || 'https://chat.ccyyqq.com/island';
// 上传文件口令（服务端 upyun.json 里的 appToken；为空表示服务端不校验）
const CLOUD_TOKEN = process.env.QT_CLOUD_TOKEN || '';
let WIN_W = 760;
const WIN_H = 620;
// 实际窗口高度：小纸条往下拖高时窗口要跟着长，否则岛的下半截会被窗口裁掉
let winH = WIN_H;

// ---------------------------------------------------------------- 内存相关
// 1) 剪贴板图片走自定义协议按需读盘，不再把 base64 常驻内存
protocol.registerSchemesAsPrivileged([
  { scheme: 'islandclip', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
]);
// 2) 收紧 V8 堆上限，避免长时间运行后堆一直往上飘
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=192 --max-semi-space-size=4');
// 3) 关掉用不到的后台服务 / 特性
app.commandLine.appendSwitch(
  'disable-features',
  [
    'MediaRouter',
    'DialMediaRouteProvider',
    'Translate',
    'OptimizationHints',
    'AutofillServerCommunication',
    'CalculateNativeWinOcclusion',
    'InterestFeedContentSuggestions'
  ].join(',')
);
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disk-cache-size', String(32 * 1024 * 1024));
// GPU 进程常驻的着色器缓存，限制一下能省几十兆
app.commandLine.appendSwitch('gpu-program-cache-size-kb', '1024');

let win = null;
let tray = null;
let store = null;
let clip = null;
let mail = null;

// Everything 联动服务（懒创建；模块级，registerIpc 与 whenReady 都能用）
function getEverything() {
  if (!everythingService) {
    everythingService = new EverythingService({
      getSettings: () => (store && store.data ? store.data.settings : {}),
      log: (...a) => log('[everything]', ...a),
      resourcesPath: process.resourcesPath
    });
  }
  return everythingService;
}
let quitting = false;
let hiddenByUser = false;
let islandRect = null; // 屏幕绝对坐标(DIP)
let islandRel = null; // 窗口内坐标(DIP)，来自渲染进程
let winBox = null; // 上次算 islandRect 时的窗口 bounds
let pointerInside = false;
let clickThrough = true;
let pointerTimer = null;
let dbgAt = 0;
let maskOpen = false; // 图片预览遮罩打开时，窗口放大成整屏
const shortcuts = { select: '', shot: '' }; // 实际注册成功的键位（可能被别的软件占，会换备选）
let maskBase = null; // 遮罩前的窗口 bounds
let dragHold = false; // 用户正在拖动工具条

// 桌面小便条窗口：noteId -> BrowserWindow
const stickies = new Map();
const STICKY_W = 268;
const STICKY_H = 236;

// ---------------------------------------------------------------- 日志
function logPath() {
  try {
    const dir = path.join(app.getPath('userData'), 'logs');
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, 'main.log');
  } catch (_) {
    return null;
  }
}
function log(...args) {
  const line = `[${new Date().toISOString()}] ${args
    .map((a) => (typeof a === 'string' ? a : safeJson(a)))
    .join(' ')}\n`;
  if (isDev) process.stdout.write(line);
  const p = logPath();
  if (p) {
    try {
      fs.appendFileSync(p, line);
    } catch (_) {}
  }
}
function safeJson(v) {
  try {
    return JSON.stringify(v);
  } catch (_) {
    return String(v);
  }
}

// ---------------------------------------------------------------- 状态快照
function snapshot() {
  const d = store.data;
  const accounts = (d.mail.accounts || []).map((a) => ({
    id: a.id,
    label: a.label || a.user || '邮箱',
    user: a.user || '',
    host: a.host || '',
    port: Number(a.port) || 993,
    secure: a.secure !== false,
    auth: a.auth || 'password',
    account: a.account || '',
    oauthReady: a.auth === 'oauth' && !!a.refresh,
    clientId: a.clientId || '',
    total: Number(a.total) || 0,
    unseen: Number(a.unseen) || 0,
    mode: a.mode || 'off',
    error: a.error || '',
    lastSync: a.lastSync || 0
  }));
  const first = accounts[0] || null;
  return {
    settings: d.settings,
    notes: d.notes,
    clips: clip ? clip.list() : [],
    files: d.files,
    todos: d.todos || [],
    reminders: d.reminders || [],
    countdowns: d.countdowns || { payday: 0, anniversaries: [] },
    mail: {
      configured: accounts.length > 0,
      accounts,
      // 兼容旧字段：界面/通知里还会读这几个
      label: first ? first.label : '',
      user: first ? first.user : '',
      host: first ? first.host : '',
      port: first ? first.port : 993,
      secure: first ? first.secure : true,
      auth: first ? first.auth : 'password',
      account: first ? first.account : '',
      oauthReady: first ? first.oauthReady : false,
      clientId: first ? first.clientId : '',
      items: d.mail.items || [],
      total: d.mail.total || 0,
      unseen: d.mail.unseen || 0,
      lastSync: d.mail.lastSync || 0,
      lastVia: d.mail.lastVia || 'poll',
      mode: (mail && mail.accounts ? d.mail.mode : d.mail.mode) || 'off',
      watchError: d.mail.watchError || '',
      error: d.mail.error || null
    },
    meta: {
      version: app.getVersion(),
      dev: isDev,
      providers: PROVIDERS,
      autoStart: getAutoStart(),
      dataDir: app.getPath('userData'),
      hostname: os.hostname(),
      shortcuts
    }
  };
}

function broadcast() {
  if (win && !win.isDestroyed()) win.webContents.send('state:update', snapshot());
  // 桌面便条只关心自己那张便笺的正文
  for (const [id, w] of stickies) {
    if (!w || w.isDestroyed()) continue;
    const n = noteById(id);
    if (!n) continue;
    w.webContents.send('sticky:update', { id: n.id, text: n.text, updatedAt: n.updatedAt });
  }
}
function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

// ---------------------------------------------------------------- 窗口
// 窗口铺满整屏宽度，岛本身由渲染进程用 --isl-shift 在里面左右移动，
// 这样用户可以把工具条拖到顶部任意水平位置（点击穿透只在岛矩形内生效）。
function placeWindow() {
  if (!win || win.isDestroyed() || maskOpen) return;
  const d = screen.getPrimaryDisplay();
  const b = d.bounds; // DIP
  WIN_W = Math.max(760, Math.round(b.width));
  win.setBounds({
    x: Math.round(b.x),
    y: Math.round(b.y),
    width: WIN_W,
    height: winH
  });
}

// 小纸条拖高：渲染层要更高的岛时，先把窗口往下长到够用（最多到工作区高度）。
// 窗口本身透明并靠岛矩形做点击穿透，长高不会挡住桌面上的其它东西。
function fitWindowHeight(h) {
  if (!win || win.isDestroyed() || maskOpen) return { ok: false, height: winH, max: winH };
  const d = screen.getPrimaryDisplay();
  const max = Math.max(WIN_H, Math.round(d.workArea.height - 8));
  const want = Math.max(WIN_H, Math.min(max, Math.round(Number(h) || WIN_H)));
  if (want !== winH) {
    winH = want;
    const b = win.getBounds();
    win.setBounds({ x: b.x, y: b.y, width: b.width, height: winH });
    syncIslandRect();
  }
  return { ok: true, height: winH, max };
}

// 图片预览：把窗口临时放大成整屏遮罩，关闭时还原。
// 遮罩期间必须关掉鼠标穿透，否则整层遮罩点不到。
function setMask(on) {
  if (!win || win.isDestroyed()) return maskOpen;
  if (on === maskOpen) return maskOpen;
  maskOpen = on;
  if (on) {
    try {
      maskBase = win.getBounds();
    } catch (_) {
      maskBase = null;
    }
    const d = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const b = d.bounds;
    if (clickThrough) {
      clickThrough = false;
      try {
        win.setIgnoreMouseEvents(false);
      } catch (_) {}
    }
    win.setBounds({ x: b.x, y: b.y, width: b.width, height: b.height });
    try {
      win.setAlwaysOnTop(true, 'screen-saver');
      win.focus();
    } catch (_) {}
  } else {
    const target = maskBase || { x: 0, y: 0, width: WIN_W, height: WIN_H };
    maskBase = null;
    win.setBounds(target);
    placeWindow();
    send('cmd', { type: 'lb-close' });
  }
  syncIslandRect();
  return maskOpen;
}

// ---------------------------------------------------------------- 桌面小便条
function noteById(id) {
  return (store.data.notes || []).find((n) => n.id === id) || null;
}

function stickyDefaultPos(note) {
  if (note.pos && Number.isFinite(note.pos.x) && Number.isFinite(note.pos.y)) return note.pos;
  const d = screen.getPrimaryDisplay().workArea;
  const pinned = store.data.notes.filter((n) => n.pinned);
  const idx = Math.max(0, pinned.findIndex((n) => n.id === note.id));
  const cols = Math.max(1, Math.floor((d.width - 80) / (STICKY_W + 22)));
  return {
    x: d.x + d.width - STICKY_W - 30 - (idx % cols) * (STICKY_W + 22),
    y: d.y + 120 + Math.floor(idx / cols) * (STICKY_H + 22)
  };
}

function openSticky(noteId) {
  const note = noteById(noteId);
  if (!note) return null;
  const exist = stickies.get(noteId);
  if (exist && !exist.isDestroyed()) {
    exist.showInactive();
    return exist;
  }
  const pos = stickyDefaultPos(note);
  const w = new BrowserWindow({
    width: Math.max(190, Number(note.w) || STICKY_W),
    height: Math.max(150, Number(note.h) || STICKY_H),
    x: Math.round(pos.x),
    y: Math.round(pos.y),
    minWidth: 190,
    minHeight: 150,
    frame: false,
    transparent: true,
    resizable: true,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    show: false,
    hasShadow: false,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'sticky-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false
    }
  });
  try {
    w.setAlwaysOnTop(true, 'floating');
    w.setVisibleOnAllWorkspaces(true);
  } catch (_) {}
  w.loadFile(path.join(ROOT, 'src', 'renderer', 'sticky.html'), { query: { id: noteId } });
  w.once('ready-to-show', () => w.showInactive());

  let moveT = null;
  w.on('moved', () => {
    const b = w.getBounds();
    const n = noteById(noteId);
    if (!n) return;
    n.pos = { x: b.x, y: b.y };
    clearTimeout(moveT);
    moveT = setTimeout(() => {
      if (!quitting) store.save();
    }, 350);
  });
  w.on('closed', () => {
    stickies.delete(noteId);
  });
  // 手动缩放窗口后记住尺寸
  let sizeT = null;
  const rememberSize = () => {
    const b = w.getBounds();
    const n = noteById(noteId);
    if (!n) return;
    n.w = b.width;
    n.h = b.height;
    clearTimeout(sizeT);
    sizeT = setTimeout(() => {
      if (!quitting) store.save();
    }, 400);
  };
  w.on('resized', rememberSize);
  w.on('resize', rememberSize);
  stickies.set(noteId, w);
  return w;
}

function closeSticky(noteId) {
  const w = stickies.get(noteId);
  if (w && !w.isDestroyed()) w.close();
  stickies.delete(noteId);
}

// ---------------------------------------------------------------- 看大图
const viewers = new Set();

function openViewer(url, title) {
  const src = String(url || '');
  if (!/^(islandclip|https?|data):/i.test(src)) return null;
  const wa = screen.getPrimaryDisplay().workArea;
  const w = Math.min(1180, Math.round(wa.width * 0.82));
  const h = Math.min(880, Math.round(wa.height * 0.84));
  const win = new BrowserWindow({
    width: w,
    height: h,
    x: wa.x + Math.round((wa.width - w) / 2),
    y: wa.y + Math.round((wa.height - h) / 2),
    minWidth: 420,
    minHeight: 320,
    frame: false,
    transparent: true,
    resizable: true,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    show: false,
    hasShadow: false,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'viewer-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false
    }
  });
  try {
    win.setAlwaysOnTop(true, 'floating');
  } catch (_) {}
  win.loadFile(path.join(ROOT, 'src', 'renderer', 'viewer.html'), {
    query: { url: src, title: String(title || '') }
  });
  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });
  win.on('closed', () => viewers.delete(win));
  viewers.add(win);
  return win;
}

// 让窗口和「钉住的便笺」保持一一对应
function syncStickies() {
  const pinned = (store.data.notes || []).filter((n) => n.pinned);
  for (const n of pinned) openSticky(n.id);
  for (const id of [...stickies.keys()]) {
    if (!pinned.some((n) => n.id === id)) closeSticky(id);
  }
}

// ---------------------------------------------------------------- 热更新
// 更新清单必须是最新的：又拍云 CDN 会把 latest.json 缓存好几天（且忽略查询串），
// 所以清单优先走自己的服务器（发布即生效），CDN 只当兜底。
// 安装包反过来：优先走又拍云 CDN（100MB 不占服务器带宽），CDN 不通再回退服务器，
// 见 downloadSources() / fetchToFile()。
const UPDATE_BASES = () => {
  const s = (store.data.settings || {}).updateBase || '';
  const list = [
    String(s || '').replace(/\/+$/, ''),
    'https://chat.ccyyqq.com/island/update',           // 权威清单：自己的服务器，发布即生效
    process.env.QT_UPDATE_URL || '',
    'https://qing.ccyyqq.com/island/update'             // 兜底：又拍云 CDN（可能缓存旧清单）
  ];
  return [...new Set(list.filter(Boolean))];
};
let updateInfo = null;

function cmpVersion(a, b) {
  const pa = String(a || '0').split(/[.\-+]/).map((x) => parseInt(x, 10) || 0);
  const pb = String(b || '0').split(/[.\-+]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

async function checkUpdate() {
  const current = app.getVersion();
  let data = null;
  let base = '';
  let lastErr = '检查失败';
  for (const b of UPDATE_BASES()) {
    try {
      const res = await fetch(b + '/latest.json?t=' + Date.now(), {
        headers: { 'Cache-Control': 'no-cache' },
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) {
        lastErr = res.status === 404 ? '服务器上还没有发布版本' : '检查失败（' + res.status + '）';
        continue;
      }
      data = await res.json();
      base = b;
      break;
    } catch (err) {
      lastErr = '网络错误：' + (err && err.message ? err.message : '未知');
    }
  }
  if (!data) return { ok: false, message: lastErr };
  const latest = String(data.version || '').trim();
  if (!latest) return { ok: false, message: '版本信息不完整' };
  const hasUpdate = cmpVersion(latest, current) > 0;
  const file = data.file || 'QingTools-' + latest + '-setup.exe';
  updateInfo = {
    current,
    latest,
    hasUpdate,
    notes: String(data.notes || ''),
    size: Number(data.size) || 0,
    sha256: String(data.sha256 || ''),
    base,
    url: base + '/' + encodeURIComponent(file),
    file
  };
  return { ok: true, ...updateInfo };
}

// 安装包优先走又拍云 CDN（100MB 不占自己服务器的带宽），CDN 连不通 / 校验失败
// 再依次回退：清单来源的那台服务器 → 服务器固定地址。
const CDN_UPDATE = 'https://qing.ccyyqq.com/island/update';
const SERVER_UPDATE = 'https://chat.ccyyqq.com/island/update';

function downloadSources(file, base) {
  const name = encodeURIComponent(file);
  const list = [CDN_UPDATE + '/' + name, base ? String(base).replace(/\/+$/, '') + '/' + name : '', SERVER_UPDATE + '/' + name];
  return [...new Set(list.filter(Boolean))];
}

async function fetchToFile(src, target, total, expectHash) {
  const res = await fetch(src, { signal: AbortSignal.timeout(15 * 60 * 1000) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const size = Number(res.headers.get('content-length')) || total || 0;
  const hash = crypto.createHash('sha256');
  let got = 0;
  const out = fs.createWriteStream(target);
  try {
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      got += value.length;
      hash.update(value);
      out.write(Buffer.from(value));
      if (size) send('cmd', { type: 'update-progress', pct: Math.round((got / size) * 100) });
    }
    await new Promise((resolve, reject) => {
      out.on('error', reject);
      out.end(resolve);
    });
  } catch (err) {
    try {
      out.destroy();
    } catch (_) {}
    throw err;
  }
  const digest = hash.digest('hex');
  if (expectHash && digest.toLowerCase() !== String(expectHash).toLowerCase()) {
    throw new Error('校验不通过');
  }
  return digest;
}

async function downloadUpdate() {
  if (!updateInfo) {
    const r = await checkUpdate();
    if (!r.ok) return r;
  }
  if (!updateInfo.hasUpdate) return { ok: false, message: '已经是最新版本' };
  const dir = path.join(app.getPath('temp'), 'QingTools-update');
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, updateInfo.file);
  const sources = downloadSources(updateInfo.file, updateInfo.base);
  let lastErr = '下载失败';
  for (const src of sources) {
    try {
      send('cmd', { type: 'update-progress', pct: 0 });
      const digest = await fetchToFile(src, target, updateInfo.size, updateInfo.sha256);
      log('[update] downloaded', updateInfo.file, 'from', src);
      return { ok: true, file: target, source: src, sha256: digest };
    } catch (err) {
      lastErr = err && err.message ? err.message : '下载失败';
      log('[update] source failed', src, lastErr);
      try {
        if (fs.existsSync(target)) fs.unlinkSync(target);
      } catch (_) {}
    }
  }
  return { ok: false, message: '下载失败：' + lastErr };
}

/**
 * 装完自己重新起来：本进程先退出，由这个独立脚本负责
 * 「等安装包静默装完 → 把新版本的 exe 拉起来」。
 */
function applyUpdateAndRestart(setupFile) {
  try {
    const dir = path.dirname(setupFile);
    const exe = path.join(path.dirname(process.execPath), 'Qing Tools.exe');
    const script = path.join(dir, 'apply-update.cmd');
    const logFile = path.join(dir, 'apply-update.log');
    const q = (p) => '"' + p + '"';
    // 用 cmd 批处理比自己拉 powershell 稳：不涉及执行策略，也不依赖 PATH 里有 PS
    const lines = [
      '@echo off',
      'setlocal',
      'echo [%date% %time%] start>>' + q(logFile),
      'timeout /t 2 /nobreak >nul',
      'start "" /wait ' + q(setupFile) + ' /S',
      'echo [%date% %time%] installer exit=%errorlevel%>>' + q(logFile),
      'timeout /t 2 /nobreak >nul',
      'if exist ' + q(exe) + ' (start "" ' + q(exe) + ') else (start "" ' + q(setupFile) + ')',
      'echo [%date% %time%] relaunched>>' + q(logFile),
      'exit /b 0'
    ];
    fs.writeFileSync(script, lines.join('\r\n') + '\r\n', 'utf8');
    const child = spawn('cmd.exe', ['/c', script], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      cwd: dir
    });
    child.unref();
    log('update: applying', { setupFile, exe, script });
  } catch (err) {
    log('update: apply failed', String((err && err.message) || err));
  }
}

// ---------------------------------------------------------------- 图片：复制 / 另存
const MAX_IMG = 24 * 1024 * 1024;

async function fetchImage(url) {
  const u = String(url || '');
  if (!/^https?:\/\//i.test(u)) throw new Error('只支持网络图片');
  const res = await fetch(u, { redirect: 'follow' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const ab = await res.arrayBuffer();
  if (ab.byteLength > MAX_IMG) throw new Error('图片超过 24MB');
  const type = (res.headers.get('content-type') || 'image/png').split(';')[0].trim();
  return { buffer: Buffer.from(ab), type };
}

async function copyImageFromUrl(url) {
  try {
    const { buffer, type } = await fetchImage(url);
    const blob = new Blob([buffer], { type: type || 'image/png' });
    await clipboard.write([new ClipboardItem({ [type || 'image/png']: blob })]);
    return { ok: true, bytes: buffer.length };
  } catch (err) {
    // 老系统上用 PowerShell 兜底
    try {
      const { buffer, type } = await fetchImage(url).catch(() => {
        throw err;
      });
      const tmp = path.join(app.getPath('temp'), `island-${uid().slice(0, 6)}.${type.split('/')[1] || 'png'}`);
      fs.writeFileSync(tmp, buffer);
      await new Promise((resolve, reject) => {
        execFile(
          'powershell.exe',
          [
            '-NoProfile',
            '-STA',
            '-Command',
            `Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; $i=[System.Drawing.Image]::FromFile('${tmp}'); [System.Windows.Forms.Clipboard]::SetImage($i); $i.Dispose()`
          ],
          { windowsHide: true, timeout: 15000 },
          (e) => (e ? reject(e) : resolve())
        );
      });
      try {
        fs.unlinkSync(tmp);
      } catch (_) {}
      return { ok: true, bytes: buffer.length, via: 'powershell' };
    } catch (err2) {
      return { ok: false, message: String((err2 && err2.message) || err2) };
    }
  }
}

async function saveImageFromUrl(url, name) {
  try {
    const { buffer, type } = await fetchImage(url);
    const ext = (type.split('/')[1] || 'png').replace('jpeg', 'jpg');
    const stamp = new Date();
    const base =
      String(name || '').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 40).trim() ||
      `island-${stamp.getFullYear()}${String(stamp.getMonth() + 1).padStart(2, '0')}${String(
        stamp.getDate()
      ).padStart(2, '0')}`;
    const suggested = /\.(png|jpe?g|gif|webp|bmp)$/i.test(base) ? base : `${base}.${ext}`;
    const res = await dialog.showSaveDialog(win, {
      title: '保存图片',
      defaultPath: path.join(app.getPath('pictures'), suggested),
      filters: [
        { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    });
    if (res.canceled || !res.filePath) return { ok: false, canceled: true };
    fs.writeFileSync(res.filePath, buffer);
    return { ok: true, path: res.filePath };
  } catch (err) {
    return { ok: false, message: String((err && err.message) || err) };
  }
}

function createWindow() {
  try {
    WIN_W = Math.max(760, Math.round(screen.getPrimaryDisplay().bounds.width));
  } catch (_) {}
  win = new BrowserWindow({
    width: WIN_W,
    height: WIN_H,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    roundedCorners: false,
    alwaysOnTop: true,
    acceptFirstMouse: true,
    focusable: true,
    title: APP_NAME,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
      spellcheck: false,
      devTools: true
    }
  });

  try {
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.setSkipTaskbar(true);
  } catch (err) {
    log('window tweak failed', String(err));
  }

  win.setIgnoreMouseEvents(true, { forward: true });
  clickThrough = true;

  win.loadFile(path.join(ROOT, 'src', 'renderer', 'index.html'));

  win.once('ready-to-show', () => {
    placeWindow();
    win.showInactive();
    win.webContents.setZoomFactor(1);
    if (process.argv.includes('--devtools')) win.webContents.openDevTools({ mode: 'detach' });
  });

  win.webContents.on('did-finish-load', () => {
    broadcast();
    if (isDev) log('renderer loaded');
  });

  win.webContents.on('render-process-gone', (e, details) => {
    log('renderer gone', details);
    if (!quitting) {
      setTimeout(() => {
        try {
          win.reload();
        } catch (_) {}
      }, 800);
    }
  });

  win.on('close', (e) => {
    if (!quitting) {
      e.preventDefault();
      hideIsland();
    }
  });

  win.on('blur', () => {
    send('window:blur');
  });
}

function showIsland() {
  if (!win || win.isDestroyed()) return;
  hiddenByUser = false;
  if (maskOpen) setMask(false);
  placeWindow();
  // hideIsland() 会把命中矩形清空，重新显示后必须立刻按缓存的 islandRel 重建，
  // 否则指针轮询一直认为「不在岛上」→ 全程穿透，点不到任何东西。
  winBox = null;
  islandRect = null;
  syncIslandRect();
  pointerInside = false;
  win.showInactive();
  send('cmd', { type: 'wake' });
  // 显示后让渲染层重新量一次岛尺寸（隐藏期间可能变过形态）
  send('cmd', { type: 'resync' });
}

// 需要用户直接打字的时候（命令面板、重命名）主动把窗口激活：
// showIsland() 用的是 showInactive()，桌面上的岛永远不会抢焦点，
// 但输入框必须真的拿到键盘焦点，否则敲字都跑回原来的窗口里。
function focusForTyping() {
  if (!win || win.isDestroyed()) return;
  try {
    if (!win.isVisible()) win.show();
    win.setAlwaysOnTop(true, 'screen-saver');
    win.focus();
    if (typeof win.moveTop === 'function') win.moveTop();
  } catch {}
}

function hideIsland() {
  if (!win || win.isDestroyed()) return;
  if (maskOpen) setMask(false);
  hiddenByUser = true;
  islandRect = null;
  win.hide();
}function toggleIsland() {
  if (!win || win.isDestroyed()) return;
  if (win.isVisible() && !hiddenByUser) hideIsland();
  else showIsland();
}

// ---------------------------------------------------------------- 鼠标穿透（轮询命中）
// 渲染进程上报的是「窗口内坐标」，绝对坐标总是拿当前 bounds 现算，
// 否则启动早期 ready-to-show 之前拿到的旧 bounds 会让命中区域整体错位。
function syncIslandRect() {
  if (!win || win.isDestroyed() || !islandRel) {
    islandRect = null;
    winBox = null;
    return;
  }
  const b = win.getBounds();
  winBox = b;
  islandRect = {
    x: b.x + islandRel.x,
    y: b.y + islandRel.y,
    width: islandRel.width,
    height: islandRel.height
  };
}

function pointIn(rect, p, pad = 6) {
  return (
    p.x >= rect.x - pad &&
    p.x <= rect.x + rect.width + pad &&
    p.y >= rect.y - pad &&
    p.y <= rect.y + rect.height + pad
  );
}

function startPointerLoop() {
  if (pointerTimer) clearInterval(pointerTimer);
  pointerTimer = setInterval(() => {
    if (!win || win.isDestroyed() || !win.isVisible() || hiddenByUser) return;
    // 预览遮罩期间不参与穿透判定
    if (maskOpen) {
      if (clickThrough) {
        clickThrough = false;
        try {
          win.setIgnoreMouseEvents(false);
        } catch (_) {}
      }
      return;
    }
    // 正在拖动工具条：整个窗口都要能收到鼠标事件
    if (dragHold) {
      if (clickThrough) {
        clickThrough = false;
        try {
          win.setIgnoreMouseEvents(false);
        } catch (_) {}
      }
      return;
    }
    let p;
    try {
      p = screen.getCursorScreenPoint();
    } catch (_) {
      return;
    }
    // 窗口移动/缩放后重新校准命中区域
    try {
      const b = win.getBounds();
      if (!winBox || b.x !== winBox.x || b.y !== winBox.y || b.width !== winBox.width || b.height !== winBox.height) {
        syncIslandRect();
      }
    } catch (_) {}
    const inside = islandRect ? pointIn(islandRect, p) : false;
    if (isDev && Date.now() - dbgAt > 2000) {
      dbgAt = Date.now();
      log('ptr', { p, islandRect, b: win.getBounds(), cb: win.getContentBounds(), inside });
    }
    if (inside !== pointerInside) {
      pointerInside = inside;
      send('pointer:update', { inside, x: p.x, y: p.y });
    }
    if (inside) send('pointer:move', { x: p.x, y: p.y });

    const wantIgnore = !inside;
    if (wantIgnore !== clickThrough) {
      clickThrough = wantIgnore;
      try {
        if (wantIgnore) win.setIgnoreMouseEvents(true, { forward: true });
        else win.setIgnoreMouseEvents(false);
      } catch (err) {
        log('setIgnoreMouseEvents failed', String(err));
      }
    }
  }, 32);
}

// ---------------------------------------------------------------- 开机自启
function loginArgs() {
  if (app.isPackaged) return ['--autostart'];
  return [path.resolve(ROOT), '--autostart'];
}

function getAutoStart() {
  let probe = false;
  try {
    probe = !!app.getLoginItemSettings({ path: process.execPath, args: loginArgs() }).openAtLogin;
  } catch (_) {}
  // Windows 上 process.execPath 与实际写入注册表的路径常有一条是 8.3 短路径，
  // 直接比对 path 会误判成「没开」，所以再和已保存的设置取并集。
  const stored = !!(store && store.data && store.data.settings && store.data.settings.autoStart);
  return probe || stored;
}

function applyAutoStart(enabled) {
  try {
    app.setLoginItemSettings({
      openAtLogin: !!enabled,
      path: process.execPath,
      args: loginArgs()
    });
    log('autoStart ->', enabled, 'probe=', getAutoStart());
  } catch (err) {
    log('setLoginItemSettings failed', String(err));
  }
  return !!enabled;
}

// ---------------------------------------------------------------- 文件工具
function copyFilesToClipboard(paths) {
  return new Promise((resolve) => {
    if (!paths.length) return resolve({ ok: false, message: '没有文件' });
    const list = paths.map((p) => `'${String(p).replace(/'/g, "''")}'`).join(',');
    const script =
      'Add-Type -AssemblyName System.Windows.Forms;' +
      '$c = New-Object System.Collections.Specialized.StringCollection;' +
      `@(${list}) | ForEach-Object { if (Test-Path -LiteralPath $_) { [void]$c.Add((Resolve-Path -LiteralPath $_).Path) } };` +
      'if ($c.Count -gt 0) { [System.Windows.Forms.Clipboard]::SetFileDropList($c); Write-Output "OK" } else { Write-Output "EMPTY" }';
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-STA', '-Command', script],
      { windowsHide: true, timeout: 15000 },
      (err, stdout, stderr) => {
        if (err) return resolve({ ok: false, message: (stderr || err.message || '').slice(0, 200) });
        resolve({ ok: /OK/.test(stdout), message: /OK/.test(stdout) ? '已复制到剪贴板' : '复制失败' });
      }
    );
  });
}

function fileMeta(p) {
  try {
    const st = fs.statSync(p);
    return { exists: true, isDir: st.isDirectory(), size: st.size, mtime: st.mtimeMs };
  } catch (_) {
    return { exists: false, isDir: false, size: 0, mtime: 0 };
  }
}

// ---------------------------------------------------------------- IPC
function registerIpc() {
  ipcMain.handle('state:get', () => snapshot());

  ipcMain.on('island:rect', (e, r) => {
    if (!win || win.isDestroyed()) return;
    if (!r || !r.width) {
      islandRel = null;
      islandRect = null;
      return;
    }
    islandRel = { x: r.x, y: r.y, width: r.width, height: r.height };
    syncIslandRect();
  });

  ipcMain.on('ui:focus', () => {
    try {
      if (win && !win.isDestroyed()) win.focus();
    } catch (_) {}
  });

  // --- 便笺
  ipcMain.handle('notes:add', (e, text) => {
    const t = String(text || '').trim();
    if (!t) return { ok: false };
    const note = { id: uid('note'), text: t.slice(0, 4000), createdAt: Date.now(), updatedAt: Date.now(), pinned: false };
    store.data.notes.unshift(note);
    if (store.data.notes.length > 200) store.data.notes.length = 200;
    store.save();
    broadcast();
    return { ok: true, note };
  });
  // 备忘录里的图片：粘贴进来就落盘到 userData\note-images，正文只存文件名
  ipcMain.handle('notes:addImage', async (e, payload) => {
    const dataUrl = String((payload && payload.dataUrl) || '');
    const m = dataUrl.match(/^data:image\/([a-z0-9.+-]+);base64,([\s\S]+)$/i);
    if (!m) return { ok: false, message: '这个图片格式不认识' };
    const ext = m[1] === 'jpeg' ? 'jpg' : m[1].replace(/[^a-z0-9]/gi, '') || 'png';
    const buf = Buffer.from(m[2], 'base64');
    if (!buf.length) return { ok: false, message: '图片是空的' };
    if (buf.length > 24 * 1024 * 1024) return { ok: false, message: '图片超过 24MB' };
    const dir = path.join(app.getPath('userData'), 'note-images');
    try {
      await fs.promises.mkdir(dir, { recursive: true });
    } catch (_) {}
    const id = uid('note');
    const file = id + '.' + ext;
    await fs.promises.writeFile(path.join(dir, file), buf);
    const note = {
      id,
      text: String((payload && payload.text) || '').slice(0, 4000),
      image: file,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pinned: false
    };
    store.data.notes.unshift(note);
    if (store.data.notes.length > 200) store.data.notes.length = 200;
    store.save();
    broadcast();
    return { ok: true, note };
  });
  // 只把图片落盘，返回文件名：正文里用 [[img:<file>]] 标记它插在哪儿
  ipcMain.handle('notes:image', async (e, payload) => {
    const dataUrl = String((payload && payload.dataUrl) || '');
    const m = dataUrl.match(/^data:image\/([a-z0-9.+-]+);base64,([\s\S]+)$/i);
    if (!m) return { ok: false, message: '这个图片格式不认识' };
    const ext = m[1] === 'jpeg' ? 'jpg' : m[1].replace(/[^a-z0-9]/gi, '') || 'png';
    const buf = Buffer.from(m[2], 'base64');
    if (!buf.length) return { ok: false, message: '图片是空的' };
    if (buf.length > 24 * 1024 * 1024) return { ok: false, message: '图片超过 24MB' };
    const dir = path.join(app.getPath('userData'), 'note-images');
    try {
      await fs.promises.mkdir(dir, { recursive: true });
    } catch (_) {}
    const file = uid('note') + '.' + ext;
    try {
      await fs.promises.writeFile(path.join(dir, file), buf);
    } catch (err) {
      return { ok: false, message: '图片写不进去：' + String(err && err.message) };
    }
    return { ok: true, file };
  });
  // Windows 上复制的是文件 / 文件夹时，剪贴板里是 UTF-16 的路径列表
// （Electron 45 移除了同步 read(format)，只有 readBuffer 还在时才试一下）
function readClipboardFiles() {
  try {
    const buf = typeof clipboard.readBuffer === 'function' ? clipboard.readBuffer('FileNameW') : null;
    if (!buf || !buf.length) return [];
    return buf
      .toString('utf16le')
      .split('\u0000')
      .map((s) => s.trim())
      .filter(Boolean);
  } catch (_) {
    return [];
  }
}

// ---- 待办（可以带番茄钟时长：「写周报 25」= 25 分钟）
  ipcMain.handle('todos:add', (e, text) => {
    const t = String(text || '').trim();
    if (!t) return { ok: false };
    const m = t.match(/\s+(\d{1,3})\s*$/);
    let minutes = 0;
    let title = t;
    if (m) {
      const n = Number(m[1]);
      if (n >= 1 && n <= 180) {
        minutes = n;
        title = t.slice(0, m.index).trim() || t;
      }
    }
    const todo = {
      id: uid('todo'),
      text: title.slice(0, 300),
      minutes,
      done: false,
      createdAt: Date.now(),
      doneAt: 0
    };
    store.data.todos.unshift(todo);
    if (store.data.todos.length > 300) store.data.todos.length = 300;
    store.save();
    broadcast();
    return { ok: true, todo };
  });
  ipcMain.handle('todos:toggle', (e, id) => {
    const t = store.data.todos.find((x) => x.id === id);
    if (!t) return { ok: false };
    t.done = !t.done;
    t.doneAt = t.done ? Date.now() : 0;
    store.save();
    broadcast();
    return { ok: true, done: t.done };
  });
  ipcMain.handle('todos:remove', (e, id) => {
    const before = store.data.todos.length;
    store.data.todos = store.data.todos.filter((x) => x.id !== id);
    store.save();
    broadcast();
    return { ok: store.data.todos.length !== before };
  });
  ipcMain.handle('todos:clearDone', () => {
    const before = store.data.todos.length;
    store.data.todos = store.data.todos.filter((x) => !x.done);
    store.save();
    broadcast();
    return { ok: true, removed: before - store.data.todos.length };
  });

  // ===== 1.10.9 提醒事项（到点抖动 + 边缘彩虹） =====
  ipcMain.handle('reminders:add', (e, payload) => {
    const p = payload || {};
    const text = String(p.text || '').trim().slice(0, 200);
    if (!text) return { ok: false, message: '内容不能为空' };
    const at = Number(p.at) || 0; // 时间戳（毫秒）
    if (!at || at < Date.now() - 60 * 1000) return { ok: false, message: '时间必须是将来的某一时刻' };
    const item = {
      id: uid('rem'),
      text,
      at,
      done: false,
      createdAt: Date.now(),
      firedAt: 0
    };
    store.data.reminders = store.data.reminders || [];
    store.data.reminders.push(item);
    store.data.reminders.sort((a, b) => a.at - b.at);
    if (store.data.reminders.length > 200) store.data.reminders.length = 200;
    store.save();
    broadcast();
    return { ok: true, reminder: item };
  });
  ipcMain.handle('reminders:remove', (e, id) => {
    store.data.reminders = (store.data.reminders || []).filter((x) => x.id !== id);
    store.save();
    broadcast();
    return { ok: true };
  });
  ipcMain.handle('reminders:done', (e, id) => {
    const r = (store.data.reminders || []).find((x) => x.id === id);
    if (!r) return { ok: false };
    r.done = true;
    store.save();
    broadcast();
    return { ok: true };
  });
  ipcMain.handle('reminders:snooze', (e, id, minutes) => {
    const r = (store.data.reminders || []).find((x) => x.id === id);
    if (!r) return { ok: false };
    const m = Math.max(1, Math.min(1440, Number(minutes) || 5));
    r.at = Date.now() + m * 60000;
    r.firedAt = 0;
    store.save();
    broadcast();
    return { ok: true, at: r.at };
  });

  // ===== 1.10.9 倒数日（发薪日 / 节假日 / 纪念日） =====
  ipcMain.handle('countdowns:setPayday', (e, day) => {
    const d = Math.max(0, Math.min(31, Number(day) || 0));
    store.data.countdowns = store.data.countdowns || { payday: 0, anniversaries: [] };
    store.data.countdowns.payday = d;
    store.save();
    broadcast();
    return { ok: true, payday: d };
  });
  ipcMain.handle('countdowns:addAnniversary', (e, payload) => {
    const p = payload || {};
    const name = String(p.name || '').trim().slice(0, 50);
    const date = String(p.date || '').trim(); // YYYY-MM-DD
    const repeat = p.repeat === 'once' ? 'once' : 'yearly';
    if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, message: '名字 / 日期格式不对' };
    store.data.countdowns = store.data.countdowns || { payday: 0, anniversaries: [] };
    const item = { id: uid('ann'), name, date, repeat };
    store.data.countdowns.anniversaries.push(item);
    if (store.data.countdowns.anniversaries.length > 50) store.data.countdowns.anniversaries.length = 50;
    store.save();
    broadcast();
    return { ok: true, item };
  });
  ipcMain.handle('countdowns:removeAnniversary', (e, id) => {
    store.data.countdowns = store.data.countdowns || { payday: 0, anniversaries: [] };
    store.data.countdowns.anniversaries = store.data.countdowns.anniversaries.filter((x) => x.id !== id);
    store.save();
    broadcast();
    return { ok: true };
  });

  ipcMain.handle('notes:update', (e, { id, text }) => {
    const n = store.data.notes.find((x) => x.id === id);
    if (!n) return { ok: false };
    n.text = String(text || '').slice(0, 4000);
    n.updatedAt = Date.now();
    store.save();
    broadcast();
    return { ok: true };
  });
  ipcMain.handle('notes:remove', (e, id) => {
    store.data.notes = store.data.notes.filter((x) => x.id !== id);
    closeSticky(id);
    store.save();
    broadcast();
    return { ok: true };
  });
  // 固定 = 钉到桌面：开一张桌面便条窗口
  ipcMain.handle('notes:togglePin', (e, id) => {
    const n = store.data.notes.find((x) => x.id === id);
    if (!n) return { ok: false };
    n.pinned = !n.pinned;
    store.save();
    syncStickies();
    broadcast();
    return { ok: true, pinned: n.pinned };
  });
  // 全部删除：固定的便笺保留
  ipcMain.handle('notes:clear', () => {
    const keep = store.data.notes.filter((n) => n.pinned);
    const removed = store.data.notes.length - keep.length;
    store.data.notes = keep;
    store.save();
    broadcast();
    return { ok: true, removed, kept: keep.length };
  });

  // --- 剪贴板
  ipcMain.handle('clip:copy', async (e, id) => {
    const ok = await clip.copy(id);
    return { ok, message: ok ? '已复制' : '复制失败' };
  });
  ipcMain.handle('clip:remove', (e, id) => {
    clip.remove(id);
    return { ok: true };
  });
  ipcMain.handle('clip:togglePin', (e, id) => {
    clip.togglePin(id);
    return { ok: true };
  });
  ipcMain.handle('clip:clear', () => {
    const r = clip.clear();
    return { ok: true, ...(r || {}) };
  });
  // 取剪贴板图片的原始字节（渲染层 fetch 自定义协议会被 CORS 拦掉，所以走 IPC 拿 dataURL）
  ipcMain.handle('clip:data', async (e, id) => {
    try {
      const item = (store.data.clips || []).find((c) => c.id === id);
      if (!item || item.kind !== 'image') return { ok: false, message: '不是图片' };
      const file = path.join(DATA_DIR, 'clip-images', item.file || '');
      const buf = fs.readFileSync(file);
      const mime = item.mime || (/\.jpe?g$/i.test(item.file || '') ? 'image/jpeg' : 'image/png');
      return { ok: true, dataUrl: 'data:' + mime + ';base64,' + buf.toString('base64'), bytes: buf.length, mime };
    } catch (err) {
      return { ok: false, message: String(err && err.message ? err.message : err) };
    }
  });
  // 读「此刻」的系统剪贴板（备忘录右键「粘贴」用）：图片给 dataURL，其余当文本
  // 注意：Electron 45 的 clipboard 是 W3C 异步 API，没有 readImage()，要读 read() 的 ClipboardItem
  ipcMain.handle('clip:readNow', async () => {
    try {
      let items = [];
      try {
        items = (await clipboard.read()) || [];
      } catch (_) {
        items = [];
      }
      for (const it of items) {
        const types = Array.from((it && it.types) || []);
        const imgType = types.find((t) => /^image\//.test(t));
        if (imgType) {
          const blob = await it.getType(imgType);
          const buf = Buffer.from(await blob.arrayBuffer());
          if (buf.length > 24 * 1024 * 1024) return { ok: false, message: '剪贴板里的图片超过 24MB' };
          return { ok: true, kind: 'image', dataUrl: 'data:' + imgType + ';base64,' + buf.toString('base64'), bytes: buf.length };
        }
      }
      for (const it of items) {
        const types = Array.from((it && it.types) || []);
        if (types.includes('text/plain')) {
          const blob = await it.getType('text/plain');
          const text = await blob.text();
          if (text) return { ok: true, kind: 'text', text };
        }
      }
      const files = readClipboardFiles();
      if (files.length) return { ok: true, kind: 'files', text: files.join('\r\n') };
      const text = clipboard.readText();
      if (text) return { ok: true, kind: 'text', text };
      return { ok: false, message: '剪贴板里没有能粘贴的内容' };
    } catch (err) {
      return { ok: false, message: String(err && err.message ? err.message : err) };
    }
  });
  // 把任意文本写进剪贴板（复制便笺 / 邮箱地址等），写完抑制回环收录
  ipcMain.handle('clip:writeText', async (e, text, keep) => {
    try {
      await clipboard.writeText(String(text == null ? '' : text));
      // keep=true：验证码这类内容要留在剪贴板历史里（否则下一次轮询会把它跳过）
      if (!keep) await clip.suppress();
      return { ok: true };
    } catch (err) {
      return { ok: false, message: String(err) };
    }
  });

  // --- 文件暂存
  ipcMain.handle('files:add', (e, paths) => {
    const list = Array.isArray(paths) ? paths : [paths];
    let added = 0;
    for (const p of list) {
      if (!p) continue;
      const meta = fileMeta(p);
      if (!meta.exists) continue;
      if (store.data.files.some((f) => f.path === p)) continue;
      store.data.files.unshift({
        id: uid('file'),
        path: p,
        name: path.basename(p) || p,
        isDir: meta.isDir,
        size: meta.size,
        ext: meta.isDir ? '' : path.extname(p).replace('.', '').toLowerCase().slice(0, 6),
        addedAt: Date.now()
      });
      added++;
    }
    if (store.data.files.length > 30) store.data.files.length = 30;
    store.save();
    broadcast();
    return { ok: true, added };
  });

  // --- 文件搜索（Everything HTTP 优先，不可用时内置扫描）
  const everything = () => getEverything();
  const search = () => {
    if (!searchService) {
      searchService = new SearchService({
        getSettings: () => store.data.settings,
        log: (...a) => log('[search]', ...a)
      });
    }
    return searchService;
  };
  ipcMain.handle('files:probe', async () => search().probe());
  // Everything 联动：status / ensure（开服务并连上）/ install（用内置安装包装）
  ipcMain.handle('files:everything', async (e, action) => {
    const act = String(action || 'status');
    try {
      if (act === 'install') return await everything().install();
      if (act === 'ensure') return await everything().ensure({ start: true, force: true });
      return await everything().status();
    } catch (err) {
      return { ok: false, message: String((err && err.message) || err) };
    }
  });
  ipcMain.handle('files:search', async (e, query, opts) => {
    const o = opts || {};
    const q = String(query || '');
    const args = {
      limit: Math.max(1, Math.min(100, Number(o.limit) || 40)),
      mode: o.mode === 'content' ? 'content' : 'name'
    };
    const first = await search().search(q, args);
    // 内置扫描只看桌面/文档/下载这些常用目录；没有结果时再做一次「整盘浅扫」，
    // 免得用户以为搜索坏了（有 Everything 时永远走不到这里）
    const roots = store.data.settings.searchRoots;
    if (first && first.ok && !(first.results || []).length && first.engine === 'local' && !(roots && roots.length)) {
      const wide = [];
      for (let c = 67; c <= 90; c++) {
        const d = String.fromCharCode(c) + ':\\';
        try {
          if (fs.statSync(d).isDirectory()) wide.push({ dir: d, maxDepth: 3 });
        } catch (_) {}
      }
      if (wide.length) {
        const saved = roots;
        store.data.settings.searchRoots = wide;
        try {
          const second = await search().search(q, args);
          if (second && second.ok) {
            second.wide = true;
            return second;
          }
        } finally {
          store.data.settings.searchRoots = saved;
        }
      }
    }
    return first;
  });
  // 把搜索结果里的文字（内容模式带命中行）送进剪贴板 / 文件区
  ipcMain.handle('files:readText', async (e, p) => {
    try {
      const st = fs.statSync(String(p));
      if (st.size > 2 * 1024 * 1024) return { ok: false, message: '文件太大，超过 2MB' };
      const text = fs.readFileSync(String(p), 'utf8');
      return { ok: true, text, size: st.size };
    } catch (err) {
      return { ok: false, message: String(err && err.message ? err.message : err) };
    }
  });
  // 截屏：抓下光标所在那块屏，复制到剪贴板，同时落进暂存箱
  ipcMain.handle('app:screenshot', async () => {
    try {
      const d = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
      const w = Math.round(d.size.width * d.scaleFactor);
      const h = Math.round(d.size.height * d.scaleFactor);
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: w, height: h }
      });
      const src =
        sources.find((s) => String(s.display_id) === String(d.id)) ||
        sources.find((s) => s.name.toLowerCase().includes('screen')) ||
        sources[0];
      if (!src || src.thumbnail.isEmpty()) return { ok: false, message: '没抓到屏幕内容' };
      const png = src.thumbnail.toPNG();
      await clipboard.write([new ClipboardItem({ 'image/png': new Blob([png], { type: 'image/png' }) })]);
      await clip.suppress();

      const dir = path.join(app.getPath('userData'), 'captures');
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, 'shot-' + Date.now().toString(36) + '.png');
      fs.writeFileSync(file, png);

      const meta = fileMeta(file);
      if (!store.data.files.some((f) => f.path === file)) {
        store.data.files.unshift({
          id: uid('file'),
          path: file,
          name: path.basename(file),
          isDir: false,
          size: meta.size,
          ext: 'png',
          addedAt: Date.now()
        });
        if (store.data.files.length > 30) store.data.files.length = 30;
        store.save();
        broadcast();
      }
      return { ok: true, file, size: src.thumbnail.getSize() };
    } catch (err) {
      return { ok: false, message: String((err && err.message) || err) };
    }
  });

  // 划词速递：把当前选中的文字抓过来（借一次 Ctrl+C，读完立刻把剪贴板还原）
  ipcMain.handle('app:grabSelection', async () => {
    const before = await clipboard.readText().catch(() => '');
    try {
      execFile('powershell.exe', [
        '-NoProfile',
        '-WindowStyle', 'Hidden',
        '-Command',
        "(New-Object -ComObject WScript.Shell).SendKeys('^c')"
      ], { windowsHide: true });
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 320));
    const now = await clipboard.readText().catch(() => '');
    if (now && now !== before) {
      // 抓到新内容：还原用户原来的剪贴板
      if (before) await clipboard.writeText(before).catch(() => {});
      else await clipboard.clear().catch(() => {});
      return { ok: true, text: now.slice(0, 4000) };
    }
    return { ok: false, message: '没有选中文字' };
  });

  // 把文件传到又拍云（云端中转站）：文件夹先打包成 zip 再传
  ipcMain.handle('files:uploadCloud', async (e, id) => {
    const f = store.data.files.find((x) => x.id === id);
    if (!f) return { ok: false, message: '这个项目已经不在暂存箱里了' };
    if (!fs.existsSync(f.path)) return { ok: false, message: '源文件已经不存在了' };

    let tmpZip = '';
    let buf;
    let name = f.name;
    let type = 'application/octet-stream';
    try {
      if (f.isDir) {
        tmpZip = path.join(app.getPath('temp'), 'qt-' + f.id + '.zip');
        const ps = `Compress-Archive -LiteralPath ${JSON.stringify(f.path)} -DestinationPath ${JSON.stringify(tmpZip)} -Force`;
        await new Promise((resolve, reject) => {
          execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true }, (err) =>
            err ? reject(err) : resolve()
          );
        });
        buf = fs.readFileSync(tmpZip);
        name = f.name + '.zip';
        type = 'application/zip';
      } else {
        buf = fs.readFileSync(f.path);
        name = f.name;
        const ext = (f.ext || '').toLowerCase();
        type =
          { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', pdf: 'application/pdf', txt: 'text/plain', json: 'application/json', zip: 'application/zip', mp4: 'video/mp4', heic: 'image/heic' }[ext] || 'application/octet-stream';
      }
    } catch (err) {
      if (tmpZip) try { fs.unlinkSync(tmpZip); } catch (_) {}
      return { ok: false, message: '读取文件失败：' + (err.message || err) };
    }

    try {
      const res = await fetch(CLOUD_API + '/api/files', {
        method: 'POST',
        headers: {
          'Content-Type': type,
          'X-Island-Name': encodeURIComponent(name),
          'X-Island-App': CLOUD_TOKEN,
          'Content-Length': String(buf.length)
        },
        body: buf
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        return { ok: false, message: data.message || '上传失败（' + res.status + '）' };
      }
      f.cloudUrl = data.url;
      f.cloudAt = Date.now();
      store.save();
      broadcast();
      return { ok: true, url: data.url, bytes: data.bytes, name: data.name };
    } catch (err) {
      return { ok: false, message: '上传失败：' + (err.message || err) };
    } finally {
      if (tmpZip) try { fs.unlinkSync(tmpZip); } catch (_) {}
    }
  });

  ipcMain.handle('files:pick', async () => {
    const res = await dialog.showOpenDialog({
      title: '添加到 ' + APP_NAME,
      properties: ['openFile', 'multiSelections']
    });
    if (res.canceled) return { ok: false };
    let added = 0;
    for (const p of res.filePaths) {
      const meta = fileMeta(p);
      if (!meta.exists || store.data.files.some((f) => f.path === p)) continue;
      store.data.files.unshift({
        id: uid('file'),
        path: p,
        name: path.basename(p),
        isDir: meta.isDir,
        size: meta.size,
        ext: path.extname(p).replace('.', '').toLowerCase().slice(0, 6),
        addedAt: Date.now()
      });
      added++;
    }
    store.save();
    broadcast();
    return { ok: true, added };
  });
  // 暂存箱自动瘦身：失效路径一定清掉；超过 N 天的按设置清掉（0 = 不按时间清）
  ipcMain.handle('files:prune', () => pruneFilesNow());
  ipcMain.handle('files:remove', (e, id) => {
    store.data.files = store.data.files.filter((f) => f.id !== id);
    store.save();
    broadcast();
    return { ok: true };
  });
  ipcMain.handle('files:clear', () => {
    store.data.files = [];
    store.save();
    broadcast();
    return { ok: true };
  });
  ipcMain.handle('files:copy', async (e, ids) => {
    const files = store.data.files.filter((f) => (ids || []).includes(f.id));
    const res = await copyFilesToClipboard(files.map((f) => f.path));
    if (res.ok) await clip.suppress();
    return res;
  });
  ipcMain.handle('files:copyPath', async (e, id) => {
    const f = store.data.files.find((x) => x.id === id);
    if (!f) return { ok: false };
    await clipboard.writeText(f.path);
    await clip.suppress();
    return { ok: true, message: '路径已复制' };
  });
  ipcMain.handle('files:reveal', (e, id) => {
    const f = store.data.files.find((x) => x.id === id);
    if (f) shell.showItemInFolder(f.path);
    return { ok: true };
  });
  ipcMain.handle('files:open', async (e, id) => {
    const f = store.data.files.find((x) => x.id === id);
    if (!f) return { ok: false };
    const err = await shell.openPath(f.path);
    return { ok: !err, message: err };
  });
  ipcMain.handle('files:dragOut', (e, id) => {
    const f = store.data.files.find((x) => x.id === id);
    if (!f) return { ok: false };
    try {
      const iconPath = path.join(ASSETS, 'drag.png');
      let icon = nativeImage.createFromPath(iconPath);
      if (icon.isEmpty()) icon = nativeImage.createFromPath(path.join(ASSETS, 'icon.png'));
      win.webContents.startDrag({ file: f.path, icon });
      return { ok: true };
    } catch (err) {
      return { ok: false, message: String(err) };
    }
  });

  // --- 邮件（多账户）
  ipcMain.handle('mail:save', (e, cfg) => mail.save(cfg));
  ipcMain.handle('mail:test', (e, cfg) => mail.test(cfg));
  ipcMain.handle('mail:remove', (e, id) => mail.remove(id));
  ipcMain.handle('mail:refresh', (e, accId) => mail.refresh({ silent: true, accId: accId || '' }));
  ipcMain.handle('mail:markRead', (e, key) => mail.markRead(key));
  ipcMain.handle('mail:detail', (e, key, force) => mail.detail(key, { force: !!force }));
  ipcMain.handle('mail:disconnect', (e, id) => {
    if (id) mail.remove(id);
    else mail.disconnect();
    return { ok: true };
  });

  // --- 邮件：微软 OAuth2（设备代码流）
  ipcMain.handle('mail:oauthStart', async (e, clientId, accountId) => {
    const id = String(clientId || store.data.settings.msClientId || msOauth.DEFAULT_CLIENT_ID || '').trim();
    if (!id) return { ok: false, code: 'no_client_id', message: '还没有填写应用(客户端) ID，请看下面的开通指引' };
    const r = await msOauth.startDeviceCode(id);
    if (!r.ok) return { ok: false, message: String(r.error || '获取设备代码失败') };
    oauthPending = {
      clientId: id,
      accountId: String(accountId || ''),
      deviceCode: r.deviceCode,
      until: Date.now() + r.expiresIn * 1000
    };
    if (id !== store.data.settings.msClientId) {
      store.data.settings.msClientId = id;
      store.save();
    }
    return { ok: true, userCode: r.userCode, uri: r.uri, expiresIn: r.expiresIn, interval: r.interval };
  });

  ipcMain.handle('mail:oauthPoll', async () => {
    if (!oauthPending) return { ok: false, code: 'no_pending', message: '请先点「用微软账户登录」' };
    if (Date.now() > oauthPending.until) {
      oauthPending = null;
      return { ok: false, code: 'expired', message: '代码已过期，请重新获取' };
    }
    const r = await msOauth.pollToken(oauthPending.clientId, oauthPending.deviceCode);
    if (r.pending) return { ok: false, pending: true };
    if (!r.ok) {
      oauthPending = null;
      return { ok: false, code: 'denied', message: r.message || r.error || '授权失败' };
    }
    const base = {
      label: 'Outlook',
      host: 'outlook.office365.com',
      port: 993
    };
    mail.applyOAuth(r, { clientId: oauthPending.clientId, base, accountId: oauthPending.accountId });
    oauthPending = null;
    mail.restartWatch();
    mail.refresh({ silent: true });
    broadcast();
    return { ok: true, account: r.account };
  });

  ipcMain.handle('mail:oauthCancel', () => {
    oauthPending = null;
    return { ok: true };
  });

  // --- 设置
  ipcMain.handle('settings:save', (e, patch) => {
    const before = { ...store.data.settings };
    store.data.settings = { ...store.data.settings, ...(patch || {}) };
    store.save();
    if ('autoStart' in (patch || {}) && patch.autoStart !== before.autoStart) {
      const actual = applyAutoStart(patch.autoStart);
      store.data.settings.autoStart = actual;
      store.save();
    }
    if ('pollMinutes' in (patch || {})) mail.reschedule();
    if ('clipLimit' in (patch || {}) || 'clipEnabled' in (patch || {})) clip.tick();
    broadcast();
    return { ok: true, autoStart: getAutoStart() };
  });

  // --- 应用
  ipcMain.handle('app:openExternal', async (e, url) => {
    if (!/^https?:\/\//i.test(String(url))) return { ok: false };
    await shell.openExternal(url);
    return { ok: true };
  });
  // 全局搜索可以直接打开磁盘上的文件/文件夹
  ipcMain.handle('app:openPath', async (e, p) => {
    const target = String(p || '');
    if (!target || !path.isAbsolute(target)) return { ok: false, message: '路径不对' };
    try {
      await fs.promises.access(target);
    } catch (_) {
      return { ok: false, message: '这个文件已经不在了' };
    }
    const err = await shell.openPath(target);
    return err ? { ok: false, message: err } : { ok: true };
  });
  // --- 桌面便条（钉住的备忘录）
  ipcMain.handle('sticky:open', (e, id) => {
    const w = openSticky(id);
    return { ok: !!w };
  });
  ipcMain.handle('sticky:unstuck', (e, id) => {
    const n = noteById(id);
    if (!n) return { ok: false };
    n.pinned = false;
    store.save();
    syncStickies();
    broadcast();
    return { ok: true };
  });
  ipcMain.handle('sticky:update', (e, id, text) => {
    const n = noteById(id);
    if (!n) return { ok: false };
    n.text = String(text == null ? '' : text).slice(0, 4000);
    n.updatedAt = Date.now();
    store.save();
    broadcast();
    return { ok: true };
  });
  ipcMain.handle('sticky:remove', (e, id) => {
    store.data.notes = (store.data.notes || []).filter((x) => x.id !== id);
    closeSticky(id);
    store.save();
    broadcast();
    return { ok: true };
  });
  ipcMain.handle('sticky:snapshot', (e, id) => {
    const n = noteById(id);
    return n
      ? { ok: true, note: { id: n.id, text: n.text, updatedAt: n.updatedAt, fontSize: n.fontSize } }
      : { ok: false };
  });

  // 便条里的图片：点一下开「看大图」窗口
  ipcMain.handle('sticky:view', (e, file) => {
    const f = String(file || '');
    if (!f) return { ok: false };
    const win = openViewer('islandclip://note/' + encodeURIComponent(f), f);
    return { ok: !!win };
  });
  ipcMain.on('viewer:close', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win && !win.isDestroyed()) win.close();
  });

  // 便条窗口无法原生缩放（透明无边框），由渲染层的拖手自己算尺寸
  ipcMain.on('sticky:resize', (e, id, w, h) => {
    const win = stickies.get(id);
    if (!win || win.isDestroyed()) return;
    const wa = screen.getDisplayMatching(win.getBounds()).workArea;
    const b = win.getBounds();
    const width = Math.max(190, Math.min(Math.round(Number(w) || b.width), wa.width - 20));
    const height = Math.max(150, Math.min(Math.round(Number(h) || b.height), wa.height - 20));
    if (width === b.width && height === b.height) return;
    win.setSize(width, height, false);
  });

  // 便条字体大小（Ctrl + 滚轮 / A± 按钮）
  ipcMain.handle('sticky:font', (e, id, size) => {
    const n = noteById(id);
    if (!n) return { ok: false };
    n.fontSize = Math.max(11, Math.min(42, Math.round(Number(size) || 15)));
    store.save();
    const w = stickies.get(id);
    if (w && !w.isDestroyed())
      w.webContents.send('sticky:update', { id: n.id, text: n.text, fontSize: n.fontSize });
    return { ok: true, fontSize: n.fontSize };
  });

  // --- 云存储信息（又拍云域名 / 是否可用），设置页展示用
  ipcMain.handle('app:cloud', async () => {
    try {
      const res = await fetch(CLOUD_API + '/api/cloud', { signal: AbortSignal.timeout(6000) });
      const data = await res.json();
      return { ok: true, ...data, api: CLOUD_API };
    } catch (err) {
      return { ok: false, enabled: false, message: err.message || String(err), api: CLOUD_API };
    }
  });

  // --- 热更新：检查 / 下载 / 静默升级
  ipcMain.handle('app:checkUpdate', async () => {
    if (!win || win.isDestroyed()) return { ok: false, message: '窗口不可用' };
    try {
      const r = await checkUpdate();
      return r;
    } catch (err) {
      return { ok: false, message: String((err && err.message) || err) };
    }
  });

  ipcMain.handle('app:downloadUpdate', async () => {
    try {
      const p = await downloadUpdate();
      if (!p.ok) return p;
      // 交给一个独立的小脚本：等本进程退出 → 静默安装 → 自动把新版本拉起来
      applyUpdateAndRestart(p.file);
      send('cmd', { type: 'update-installing', version: p.latest || '' });
      // 多留一点时间让「正在安装新版本」这条提示被看见
      setTimeout(() => {
        quitting = true;
        app.quit();
      }, 1500);
      return { ok: true, file: p.file, installing: true };
    } catch (err) {
      return { ok: false, message: String((err && err.message) || err) };
    }
  });

  // --- 系统通知（计时器到点等）
  ipcMain.handle('app:notify', (e, o) => {
    const opt = o || {};
    try {
      if (Notification.isSupported()) {
        const n = new Notification({
          title: opt.title || APP_NAME,
          body: opt.body || '',
          silent: !!opt.silent,
          timeoutType: 'default'
        });
        n.on('click', () => send('cmd', { type: 'open', tab: opt.tab || 'tools', pin: true }));
        n.show();
        return { ok: true };
      }
    } catch (err) {
      log('notify error', String(err));
    }
    return { ok: false };
  });

  // --- 图片预览遮罩 / 复制 / 另存
  ipcMain.handle('app:mask', (e, on) => ({ ok: true, mask: setMask(!!on) }));
// 拖动工具条期间：整个窗口都接收鼠标事件；松手后立刻按岛矩形重新判定
ipcMain.on('app:dragHold', (e, on) => {
  dragHold = !!on;
  if (!win || win.isDestroyed()) return;
  if (dragHold) {
    clickThrough = false;
    try {
      win.setIgnoreMouseEvents(false);
    } catch (_) {}
  } else {
    clickThrough = true;
    try {
      win.setIgnoreMouseEvents(true, { forward: true });
    } catch (_) {}
    pointerInside = true; // 松手时鼠标就在岛上，避免状态抖动
  }
});
  ipcMain.handle('app:copyImage', async (e, url) => copyImageFromUrl(url));
  ipcMain.handle('app:fitHeight', (e, h) => fitWindowHeight(h));
  ipcMain.handle('app:metrics', () => {
    const d = screen.getPrimaryDisplay();
    return { workArea: d.workArea, bounds: d.bounds, winH, scale: d.scaleFactor };
  });
  ipcMain.handle('app:saveImage', async (e, url, name) => saveImageFromUrl(url, name));
  ipcMain.handle('sys:stat', async () => sysinfo.stat());
  ipcMain.on('app:hide', () => hideIsland());
  ipcMain.on('app:show', () => showIsland());
  ipcMain.on('app:focus', () => focusForTyping());
  // 调试用：看看穿透命中的内部状态（隐藏/显示之后排查"点不到"的问题）
  ipcMain.handle('debug:probe', () => ({
    visible: !!(win && !win.isDestroyed() && win.isVisible()),
    hiddenByUser,
    clickThrough,
    pointerInside,
    islandRel,
    islandRect,
    maskOpen,
    dragHold
  }));
  ipcMain.on('app:quit', () => {
    quitting = true;
    app.quit();
  });
  ipcMain.on('app:revealData', () => shell.openPath(app.getPath('userData')));

  // --- 调试截图
  ipcMain.handle('debug:capture', async () => {
    try {
      const img = await win.webContents.capturePage();
      const file = path.join(app.getPath('userData'), 'capture.png');
      fs.writeFileSync(file, img.toPNG());
      return { ok: true, file };
    } catch (err) {
      return { ok: false, message: String(err) };
    }
  });
}

// ---------------------------------------------------------------- 托盘 / 快捷键
function trayIcon() {
  const one = nativeImage.createFromPath(path.join(ASSETS, 'tray.png'));
  const two = nativeImage.createFromPath(path.join(ASSETS, 'tray@2x.png'));
  if (!one.isEmpty()) {
    // 高 DPI 下用 2x 位图，任务栏才不糊
    if (!two.isEmpty()) one.addRepresentation({ scaleFactor: 2, buffer: two.toPNG() });
    return one;
  }
  if (!two.isEmpty()) return two.resize({ width: 16, height: 16 });
  return nativeImage.createEmpty();
}

function buildTray() {
  tray = new Tray(trayIcon());
  tray.setToolTip(APP_NAME);
  const refreshMenu = () => {
    const menu = Menu.buildFromTemplate([
      { label: '打开面板', click: () => { showIsland(); send('cmd', { type: 'open', tab: 'mail' }); } },
      { label: '隐藏 / 显示岛上元素', click: toggleIsland },
      { type: 'separator' },
      {
        label: '开机自动启动',
        type: 'checkbox',
        checked: getAutoStart(),
        click: (item) => {
          store.data.settings.autoStart = applyAutoStart(item.checked);
          store.save();
          broadcast();
        }
      },
      { label: '剪贴板记录', type: 'checkbox', checked: !!store.data.settings.clipEnabled, click: (item) => {
        store.data.settings.clipEnabled = item.checked;
        store.save();
        broadcast();
      } },
      { type: 'separator' },
      { label: '打开数据目录', click: () => shell.openPath(app.getPath('userData')) },
      { label: '重新载入界面', click: () => win && win.reload() },
      { label: '退出', click: () => { quitting = true; app.quit(); } }
    ]);
    tray.setContextMenu(menu);
  };
  refreshMenu();
  tray.on('click', () => {
    showIsland();
    send('cmd', { type: 'toggle' });
  });
  tray.on('right-click', refreshMenu);
  tray.on('menu-show', refreshMenu);
  store._trayRefresh = refreshMenu;
}

// 暂存箱瘦身：路径已经失效的一定清掉；超期的按 filesKeepDays 清（0 = 不按时间清）
function pruneFilesNow() {
  const days = Number((store.data.settings && store.data.settings.filesKeepDays) || 0);
  const cutoff = days > 0 ? Date.now() - days * 86400000 : 0;
  const before = store.data.files.length;
  let gone = 0;
  let aged = 0;
  store.data.files = store.data.files.filter((f) => {
    const ok = fileMeta(f.path);
    if (!ok.exists) {
      gone++;
      return false;
    }
    if (cutoff && (f.addedAt || 0) < cutoff) {
      aged++;
      return false;
    }
    return true;
  });
  if (before !== store.data.files.length) {
    store.save();
    broadcast();
  }
  return { ok: true, removed: before - store.data.files.length, gone, aged };
}

// 截屏一次：抓光标所在屏幕 → 剪贴板 + 暂存箱
async function captureScreenOnce() {
  try {
    const d = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const w = Math.round(d.size.width * d.scaleFactor);
    const h = Math.round(d.size.height * d.scaleFactor);
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: w, height: h }
    });
    const src =
      sources.find((s) => String(s.display_id) === String(d.id)) ||
      sources.find((s) => s.name.toLowerCase().includes('screen')) ||
      sources[0];
    if (!src || src.thumbnail.isEmpty()) return { ok: false, message: '没抓到屏幕内容' };
    const png = src.thumbnail.toPNG();
    await clipboard.write([new ClipboardItem({ 'image/png': new Blob([png], { type: 'image/png' }) })]);
    await clip.suppress();

    const dir = path.join(app.getPath('userData'), 'captures');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'shot-' + Date.now().toString(36) + '.png');
    fs.writeFileSync(file, png);

    const meta = fileMeta(file);
    if (!store.data.files.some((f) => f.path === file)) {
      store.data.files.unshift({
        id: uid('file'),
        path: file,
        name: path.basename(file),
        isDir: false,
        size: meta.size,
        ext: 'png',
        addedAt: Date.now()
      });
      if (store.data.files.length > 30) store.data.files.length = 30;
      store.save();
      broadcast();
    }
    return { ok: true, file, size: src.thumbnail.getSize() };
  } catch (err) {
    return { ok: false, message: String((err && err.message) || err) };
  }
}

// 抓当前选中文字：借一次 Ctrl+C，读完立刻把剪贴板还原
async function grabSelectionText() {
  const before = await clipboard.readText().catch(() => '');
  try {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', "(New-Object -ComObject WScript.Shell).SendKeys('^c')"],
      { windowsHide: true }
    );
  } catch (_) {}
  await new Promise((r) => setTimeout(r, 320));
  const now = await clipboard.readText().catch(() => '');
  if (now && now !== before) {
    if (before) await clipboard.writeText(before).catch(() => {});
    else await clipboard.clear().catch(() => {});
    return { ok: true, text: now.slice(0, 4000) };
  }
  return { ok: false, message: '没有选中文字' };
}

async function grabSelectionAndShow() {
  const r = await grabSelectionText();
  if (r.ok) {
    showIsland();
    send('cmd', { type: 'selection', text: r.text });
  }
  return r;
}

async function captureScreenAndNotify() {
  return captureScreenOnce();
}

function registerShortcuts() {
  // 有些机器上 Ctrl+Alt+X / Ctrl+Alt+A 已经被别的软件（QQ、微信…）占用，注册会失败，
  // 所以每个功能给一串候选键位，注册成功哪个就用哪个，并把实际键位告诉界面。
  const bind = (cands, fn) => {
    for (const acc of cands) {
      try {
        if (globalShortcut.register(acc, fn)) return acc;
      } catch (_) {
        /* 无效键位，换下一个 */
      }
    }
    return '';
  };
  const ok1 = globalShortcut.register('Control+Alt+Space', () => {
    showIsland();
    send('cmd', { type: 'toggle' });
  });
  const ok2 = globalShortcut.register('Control+Alt+D', () => {
    showIsland();
    send('cmd', { type: 'open', tab: 'files', pin: true });
  });
  const ok3 = globalShortcut.register('Control+Alt+H', () => toggleIsland());
  // 命令面板：默认 Ctrl+K（和网页/编辑器里的习惯一致），被占用时退到 Ctrl+Alt+K
  const palKey = bind(['Control+K', 'Control+Alt+K', 'Control+Shift+K'], () => {
    showIsland();
    // 全局快捷键是系统级触发，窗口不会自动拿焦点；
    // 不激活的话命令面板的输入框虽然聚焦了，打字还是发给原来的窗口
    focusForTyping();
    send('cmd', { type: 'palette' });
  });
  const ok4 = !!palKey;
  const selKey = bind(['Control+Shift+X', 'Control+Alt+X', 'Alt+Shift+X', 'Control+Alt+Q'], async () => {
    const r = await grabSelectionAndShow();
    if (!r.ok) {
      showIsland();
      send('cmd', { type: 'toast', text: r.message || '没有选中文字' });
    }
  });
  const shotKey = bind(['Control+Shift+A', 'Control+Alt+A', 'Alt+Shift+A', 'Control+Alt+S'], async () => {
    const r = await captureScreenAndNotify();
    showIsland();
    send('cmd', { type: 'toast', text: r.ok ? '已截图并复制到剪贴板' : r.message || '截图失败' });
    if (r.ok) send('cmd', { type: 'open', tab: 'files', pin: false });
  });
  shortcuts.select = selKey;
  shortcuts.shot = shotKey;
  shortcuts.palette = palKey;
  log('shortcuts', { toggle: ok1, drop: ok2, hide: ok3, palette: palKey || false, select: selKey || false, shot: shotKey || false });
}

// ---------------------------------------------------------------- 生命周期
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showIsland();
    send('cmd', { type: 'open', tab: 'mail' });
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);

    // 图片协议：islandclip://img/<file> → 剪贴板图片；islandclip://note/<file> → 备忘录图片
    protocol.handle('islandclip', async (req) => {
      try {
        const u = new URL(req.url);
        const file = decodeURIComponent(u.pathname.replace(/^\/+/, ''));
        if (!/^[A-Za-z0-9._-]+$/.test(file)) return new Response('bad request', { status: 400 });
        const dir = u.host === 'note' ? 'note-images' : 'clip-images';
        const p = path.join(app.getPath('userData'), dir, file);
        return await net.fetch(pathToFileURL(p).toString());
      } catch (err) {
        return new Response('not found', { status: 404 });
      }
    });

    store = Store.at(path.join(app.getPath('userData'), 'state.json'));
    if (store.data.settings.autoStart) applyAutoStart(true);

    clip = new ClipWatcher(store, broadcast);
    clip.start();

    // 暂存箱自动瘦身：启动后一次，之后每 30 分钟一次，失效的路径不会一直挂着
    setTimeout(() => {
      try {
        pruneFilesNow();
      } catch (_) {}
    }, 4000);
    setInterval(() => {
      try {
        pruneFilesNow();
      } catch (_) {}
    }, 30 * 60 * 1000);

    // 1.10.9 提醒到点 tick：每 2 秒扫一次，到了就通知渲染层「抖 + 彩虹边」
    setInterval(() => {
      try {
        const now = Date.now();
        const list = store.data.reminders || [];
        for (const r of list) {
          if (r.done || r.firedAt) continue;
          if (r.at <= now) {
            r.firedAt = now;
            store.save();
            send('reminder:fire', { id: r.id, text: r.text, at: r.at });
          }
        }
        // 纪念日：首次启动或跨天时如果今天正好是某个纪念日，弹一次
        const cd = store.data.countdowns;
        if (cd && Array.isArray(cd.anniversaries)) {
          const todayKey = new Date().toISOString().slice(0, 10);
          if (store.data._lastAnnCheck !== todayKey) {
            store.data._lastAnnCheck = todayKey;
            for (const a of cd.anniversaries) {
              if (!a || !a.date) continue;
              const mmdd = a.date.slice(5);
              const todayMMdd = todayKey.slice(5);
              if (mmdd === todayMMdd) {
                send('reminder:fire', { id: 'ann-' + a.id, text: '今天是「' + a.name + '」', at: now, anniversary: true });
              }
            }
            store.save();
          }
        }
      } catch (_) {}
    }, 2000);

    mail = new MailService(store, {
      onChange: broadcast,
      log: (...args) => log('[mail]', ...args),
      onNewMail: (item, info) => {
        send('cmd', { type: 'mail:new', item, info });
        if (!store.data.settings.notifyMail) return;
        try {
          const lines = [`${item.fromName || item.fromAddr}`, item.subject];
          if (item.code) lines.push(`验证码 ${item.code}（点一下复制）`);
          else if (item.preview) lines.push(item.preview.slice(0, 60));
          const n = new Notification({
            title: info.count > 1 ? `${info.count} 封未读邮件` : '新邮件',
            body: lines.join('\n'),
            silent: false
          });
          n.on('click', async () => {
            showIsland();
            if (item.code) {
              await clipboard.writeText(item.code);
              send('cmd', { type: 'toast', text: `验证码 ${item.code} 已复制` });
            } else {
              send('cmd', { type: 'open', tab: 'mail' });
            }
          });
          n.show();
        } catch (err) {
          log('notify failed', String(err));
        }
      }
    });

    registerIpc();
    createWindow();
    buildTray();
    registerShortcuts();
    startPointerLoop();
    mail.start();
    // 把上次钉在桌面上的便条重新贴出来
    setTimeout(() => {
      try {
        syncStickies();
      } catch (err) {
        log('syncStickies failed', String(err));
      }
    }, 900);

    // Everything 联动：装了就把搜索服务开起来并连上（没装就跳过，设置页里有「安装」按钮）
    if (store.data.settings.everythingAuto !== false) {
      setTimeout(async () => {
        try {
          const r = await getEverything().ensure({ start: true });
          log('everything ->', { ok: r.ok, state: r.state, port: r.port, version: r.version, exe: r.exe });
        } catch (err) {
          log('everything failed', String(err));
        }
      }, 2000);
    }

    screen.on('display-metrics-changed', placeWindow);
    screen.on('display-added', placeWindow);
    screen.on('display-removed', placeWindow);

    log('ready', { version: app.getVersion(), autostart: isAutostart, dev: isDev });
  });

  app.on('before-quit', () => {
    quitting = true;
  });
  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    try {
      mail && mail.stop();
    } catch (_) {}
    try {
      store && store.flush();
    } catch (_) {}
    try {
      clip && clip.stop();
    } catch (_) {}
  });
  app.on('window-all-closed', () => {
    /* 常驻后台，不退出 */
  });
}
