'use strict';
/* ============================================================
   Qing Tools · 渲染进程
   ============================================================ */

const api = window.island || {};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const HEIGHTS = { idle: 34, compact: 58, panel: 448, peek: 66, drop: 86, sel: 104, palette: 344, warn: 168 };
const ACCENTS = {
  violet: ['#8f7bff', 'rgba(143,123,255,.16)'],
  teal: ['#35d7b0', 'rgba(53,215,176,.16)'],
  amber: ['#ffb547', 'rgba(255,181,71,.16)'],
  rose: ['#ff6f91', 'rgba(255,111,145,.16)']
};

/** #rrggbb -> rgba(r,g,b,alpha) */
function hexA(hex, a) {
  const h = String(hex || '').replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const v = parseInt(n, 16);
  if (!Number.isFinite(v) || n.length !== 6) return `rgba(143,123,255,${a})`;
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
}
const AVATARS = [
  ['#5b6ef5', '#2f3bb0'],
  ['#e0605f', '#8e2f34'],
  ['#2fa88a', '#166b58'],
  ['#b56ad4', '#6a2f8c'],
  ['#e0954a', '#8a4f1c'],
  ['#4a9ee0', '#1c548a'],
  ['#7d7fe0', '#3f3f8f'],
  ['#d4639b', '#8a2b5f']
];

const SEEN_KEY = 'island.seen.v1';
const SEEN_BASE = { mail: 0, notes: 0, clipboard: 0, files: 0, chat: 0 };

function readSeen() {
  try {
    return Object.assign({}, SEEN_BASE, JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'));
  } catch {
    return Object.assign({}, SEEN_BASE);
  }
}

function writeSeen() {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(S.seen));
  } catch {
    /* 忽略 */
  }
}

const S = {
  data: null,
  mode: 'idle',
  tab: 'mail',
  screenH: 0, // 屏幕工作区高度（DIP），拖高小纸条时算上限用
  cloudBase: '', // M7：云存储域名（cloud: 图片的地址前缀）
  pinned: false,
  pointerIn: false,
  collapseT: 0,
  peekT: 0,
  peekReturn: 'idle',
  grace: 0,
  clipQuery: '',
  provider: 'qq',
  dragDepth: 0,
  dragKind: '', // '' | 'files' | 'images'
  dropTarget: '', // 'files' | 'chat'
  noteOpen: null, // 展开中的备忘录 id
  noteEdit: null, // 正在编辑的备忘录 id
  noteType: 'note', // M4：Qing事项的输入类型 note | todo
  noteSaveT: 0, // 编辑中自动保存的定时器
  noteMenu: null, // 右键菜单展开的备忘录 id
  editTarget: '', // 编辑框右键菜单的来源：'rich' | 'input'
  notePaste: null, // 右键菜单里的粘贴实现（bindUi 里挂上来）
  msgMenu: null, // 右键的聊天图片消息
  mailOpen: null, // 正在阅读的邮件 key（<accId>:<uid>）
  mailRead: null, // { key, loading, data, err }
  mailFilter: '', // 邮件页的账户筛选：'' = 全部
  mailEdit: '', // 设置页正在编辑的账户 id：'' = 新增
  warnRoom: '', // 正在提醒「即将解散」的频道 id
  warnTimer: null,
  fs: { q: '', mode: 'name', items: [], sel: new Set(), engine: '', wide: false, busy: false }, // 本地文件搜索
  emojiTab: 'emoji', // 表情面板当前分页
  rectRAF: 0,
  rectUntil: 0,
  lastRect: '',
  formKey: '',
  islandX: 0,
  drag: null,
  suppressClick: false,
  // 打开系统文件对话框期间窗口会失焦，这段时间不要自动收起（否则选完图片岛已经缩回药丸了）
  pickUntil: 0,
  badges: '',
  seen: readSeen(),
  confirmKey: '',
  confirmT: 0,
  palSel: 0,
  palItems: [],
  palQ: 0, // 全局搜索的请求序号（丢弃迟到的结果）
  palFiles: [], // 全局搜索里命中的文件
  palBusy: false,
  palFileEngine: '',
  palGroup: '', // 当前选中项所属分组名
  toolsOpen: {}, // 小工具页展开状态（默认全收起，一屏看完五张卡）
  dvTab: 'ts',
  dvOut: '',
  dvImgUrl: '',
  dvImgBlob: null,
  dvImgName: '',
  dvSrc: '',
  dvSrcNote: '',
  wx: null, // 天气缓存 { t, city, temp, max, min, text, code }
  selText: '',
  chat: { rooms: [], active: 0, adding: false, busy: false, err: '', mentions: new Map(), pending: [], reply: null, height: 0 },
  timers: [], // [{ id, label, end, dur }]
  account: { signedIn: false, user: null, sessions: [], busy: false, msg: '', roomsClaimed: false, friends: [], requests: [], outgoing: [], userToken: '' }, // 账号（1.11.0 / M6）
};

const el = {
  stage: $('#stage'),
  island: $('#island'),
  glider: $('#glider'),
  tabs: $('#tabs'),
  clock: $('#clock'),
  mark: $('#idleMark'),
  idleDate: $('#idleDate'),
  idleSub: $('#idleSub'),
  idleNow: $('#idleNow'),
  headExtra: $('#headExtra'),
  // 账号（1.11.0）
  accOut: $('#accOut'),
  accIn: $('#accIn'),
  accUser: $('#accUser'),
  accPass: $('#accPass'),
  accLogin: $('#accLogin'),
  accRegister: $('#accRegister'),
  accForgot: $('#accForgot'),
  accOutMsg: $('#accOutMsg'),
  accName: $('#accName'),
  accSub: $('#accSub'),
  accDevList: $('#accDevList'),
  accClaim: $('#accClaim'),
  accClaimText: $('#accClaimText'),
  accClaimMsg: $('#accClaimMsg'),
  accClaimGo: $('#accClaimGo'),
  accClaimBackup: $('#accClaimBackup'),
  accBackup: $('#accBackup'),
  // M6：亲密好友 + 分享
  accFriends: $('#accFriends'),
  accFriendName: $('#accFriendName'),
  accFriendAdd: $('#accFriendAdd'),
  accFriendMsg: $('#accFriendMsg'),
  sharePop: $('#sharePop'),
  shareList: $('#shareList'),
  shareEmpty: $('#shareEmpty'),
  hearts: $('#hearts'),
  chatPeople: $('#chatPeople'),
  cpList: $('#cpList'),
  cpMore: $('#cpMore'),
  shareHist: $('#shareHist'),
  shTitle: $('#shTitle'),
  shList: $('#shList'),
  shEmpty: $('#shEmpty'),
  accRefresh: $('#accRefresh'),
  accSwitch: $('#accSwitch'),
  accLogout: $('#accLogout'),
  accLogoutRow: $('#accLogoutRow'),
  accLogoutBottom: $('#accLogoutBottom'),
  syncSub: $('#syncSub'),
  syncNow: $('#syncNow'),
  accLogoutAll: $('#accLogoutAll'),
  accDelete: $('#accDelete'),
  accCode: $('#accCode'),
  accCodeVal: $('#accCodeVal'),
  accCodeCopy: $('#accCodeCopy'),
  accCodeDone: $('#accCodeDone'),
  accCodeOk: $('#accCodeOk'),
  accRecover: $('#accRecover'),
  accRUser: $('#accRUser'),
  accRCode: $('#accRCode'),
  accRPass: $('#accRPass'),
  accRGo: $('#accRGo'),
  accRCancel: $('#accRCancel'),
  accRMsg: $('#accRMsg'),
  accDel: $('#accDel'),
  accDUser: $('#accDUser'),
  accDPass: $('#accDPass'),
  accDCode: $('#accDCode'),
  accDGo: $('#accDGo'),
  accDCancel: $('#accDCancel'),
  accDMsg: $('#accDMsg'),
  idleBadges: $('#idleBadges'),
  lightbox: $('#lightbox'),
  palette: $('#palette'),
  palInput: $('#palInput'),
  palList: $('#palList'),
  viewSel: $('#viewSel'),
  selQuote: $('#selQuote'),
  lbImg: $('#lbImg'),
  lbStage: $('#lbStage'),
  lbZoom: $('#lbZoom'),
  lbName: $('#lbName'),
  lbMenu: $('#lbMenu'),
  lbStage: $('#lbStage'),
  qMail: $('#qMailBadge'),
  qNote: $('#qNoteBadge'),
  qClip: $('#qClipBadge'),
  qFile: $('#qFileBadge'),
  qChat: $('#qChatBadge'),
  tabDotMail: $('#tabDotMail'),
  tabDotNotes: $('#tabDotNotes'),
  tabDotClip: $('#tabDotClip'),
  tabDotFiles: $('#tabDotFiles'),
  mailStat: $('#mailStat'),
  mailSub: $('#mailSub'),
  mailAlert: $('#mailAlert'),
  mailList: $('#mailList'),
  mailEmpty: $('#mailEmpty'),
  mailRefresh: $('#mailRefresh'),
  noteInput: $('#noteInput'),
  noteList: $('#noteList'),
  noteEmpty: $('#noteEmpty'),
  clipSearch: $('#clipSearch'),
  clipList: $('#clipList'),
  clipEmpty: $('#clipEmpty'),
  fileStat: $('#fileStat'),
  fileList: $('#fileList'),
  fileZone: $('#dropzone'),
  mailAccountLabel: $('#mailAccountLabel'),
  accList: $('#accList'),
  mailFilters: $('#mailFilters'),
  mailHint: $('#mailHint'),
  mailTestMsg: $('#mailTestMsg'),
  msOauthBox: $('#msOauthBox'),
  msGuide: $('#msGuide'),
  msClientId: $('#msClientId'),
  msCode: $('#msCode'),
  msCodeVal: $('#msCodeVal'),
  msCodeState: $('#msCodeState'),
  mUser: $('#mUser'),
  mPass: $('#mPass'),
  mHost: $('#mHost'),
  mPort: $('#mPort'),
  setAutoStart: $('#setAutoStart'),
  setNotify: $('#setNotify'),
  setClip: $('#setClip'),
  setPoll: $('#setPoll'),
  toast: $('#toast'),
  dropOverlay: $('#dropOverlay'),
  peekIc: $('#peekIc'),
  peekTitle: $('#peekTitle'),
  peekSub: $('#peekSub'),
  peekTime: $('#peekTime'),
  peekBar: $('#peekBar'),
  peekHint: $('#peekHint'),
  peekThumb: $('#peekThumb'),
  viewPeek: $('#viewPeek'),
  viewDrop: $('#viewDrop'),
  dropFiles: $('#dropFiles'),
  dropChat: $('#dropChat'),
  dropChatSub: $('#dropChatSub'),
  appVersion: $('#appVersion'),
  tabChat: $('.tab[data-tab="chat"]'),
  tabDotChat: $('#tabDotChat'),
  noteStat: $('#noteStat'),
  noteClear: $('#noteClear'),
  clipClear: $('#clipClear'),
  chatRooms: $('#chatRooms'),
  chatCancelNew: $('#chatCancelNew'),
  chatGate: $('#chatGate'),
  chatName: $('#chatName'),
  chatCode: $('#chatCode'),
  chatJoin: $('#chatJoin'),
  chatCreate: $('#chatCreate'),
  chatReplace: $('#chatReplace'),
  chatErr: $('#chatErr'),
  chatRoom: $('#chatRoom'),
chatState: $('#chatState'),
  chatMembers: $('#chatMembers'),
  chatVotes: $('#chatVotes'),
  chatMsgs: $('#chatMsgs'),
  warnTitle: $('#warnTitle'),
  warnCount: $('#warnCount'),
  warnSub: $('#warnSub'),
  warnTip: $('#warnTip'),
  chatInput: $('#chatInput'),
  chatFile: $('#chatFile'),
  emojiPop: $('#emojiPop'),
  pickPop: $('#pickPop'),
  mentionTags: $('#mentionTags'),
  pendingBar: $('#pendingBar'),
  replyBar: $('#replyBar'),
  chatResize: $('#chatResize'),
  msgMenu: $('#msgMenu'),
  noteMenu: $('#noteMenu'),
  editMenu: $('#editMenu'),
  timerOrb: $('#timerOrb'),
  timerVal: $('#timerVal'),
  timerRing: $('#timerRing'),
  satSys: $('#satSys'),
  satSysVal: $('#sysVal'),
  satSysRing: $('#sysRing'),
  satMail: $('#satMail'),
  satMailNum: $('#satMailNum'),
  satChat: $('#satChat'),
  satChatNum: $('#satChatNum'),
  timerList: $('#timerList'),
  timerEmpty: $('#timerEmpty'),
  todoList: $('#todoList'),
  todoInput: $('#todoInput'),
  todoAdd: $('#todoAdd'),
  remList: $('#remList'),
  remText: $('#remText'),
  remQuick: $('#remQuick'),
  remAt: $('#remAt'),
  remAdd: $('#remAdd'),
  remSub: $('#remSub'),
  remEmpty: $('#remEmpty'),
  cdList: $('#cdList'),
  cdName: $('#cdName'),
  cdDate: $('#cdDate'),
  cdRepeat: $('#cdRepeat'),
  cdAdd: $('#cdAdd'),
  cdPayday: $('#cdPayday'),
  cdPaydayNext: $('#cdPaydayNext'),
  cdSub: $('#cdSub'),
  todoSub: $('#todoSub'),
  todoEmpty: $('#todoEmpty'),
  timerSub: $('#timerSub'),
  timerH: $('#timerH'),
  timerM: $('#timerM'),
  timerS: $('#timerS'),
  timerStart: $('#timerStart'),
  setDnd: $('#setDnd'),
  dndChips: $('#dndChips'),
  dndState: $('#dndState'),
  dndHint: $('#dndHint'),
  qDnd: $('#qDndBadge'),
  sysRows: $('#sysRows'),
  sysSub: $('#sysSub'),
  devSub: $('#devSub'),
  mailCardSub: $('#mailCardSub'),
  smsSub: $('#smsSub'),
  smsCardSub: $('#smsCardSub'),
  dvTabs: $('#dvTabs'),
  dvIn: $('#dvIn'),
  dvSrcBar: $('#dvSrcBar'),
  dvSrcText: $('#dvSrcText'),
  dvActs: $('#dvActs'),
  dvOut: $('#dvOut'),
  dvOutWrap: $('#dvOutWrap'),
  dvImgWrap: $('#dvImgWrap'),
  dvImg: $('#dvImg'),
  dvImgMeta: $('#dvImgMeta'),
  dvFile: $('#dvFile'),
  dvSave: $('#dvSave'),
  wxCity: $('#wxCity'),
  wxSave: $('#wxSave'),
  wxSub: $('#wxSub'),
  tabDotTools: $('#tabDotTools')
};

let morphT = 0;
let toastT = 0;
let alarmT = 0;

/* ---------------------------------------------------------------- 工具 */

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

const pad = (n) => (n < 10 ? '0' + n : String(n));

/** 邮件阅读页用的完整时间：8月21日 14:03 / 2024年8月21日 14:03 */
function fmtDate(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  const now = new Date();
  const hm = pad(d.getHours()) + ':' + pad(d.getMinutes());
  if (d.toDateString() === now.toDateString()) return '今天 ' + hm;
  if (d.getFullYear() === now.getFullYear()) return d.getMonth() + 1 + '月' + d.getDate() + '日 ' + hm;
  return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + hm;
}

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = Date.now() - ts;
  if (diff < 0) return '刚刚';
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
  if (d.toDateString() === now.toDateString()) return pad(d.getHours()) + ':' + pad(d.getMinutes());
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return '昨天';
  if (d.getFullYear() === now.getFullYear()) return d.getMonth() + 1 + '月' + d.getDate() + '日';
  return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate();
}

function timeShort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function fmtSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB';
  if (n < 1024 * 1024 * 1024) return (n / 1048576).toFixed(1) + ' MB';
  return (n / 1073741824).toFixed(2) + ' GB';
}

/** 粘贴进来的图片文件 → data URL（备忘录存图用） */
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ''));
    fr.onerror = () => reject(fr.error || new Error('read failed'));
    fr.readAsDataURL(file);
  });
}

function colorOf(seed) {
  const s = String(seed || '?');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATARS[h % AVATARS.length];
}

function initialOf(name, addr) {
  const n = String(name || addr || '?').trim();
  const ch = n[0] || '?';
  return /[a-z]/.test(ch) ? ch.toUpperCase() : ch;
}

function paint(node, html) {
  if (!node) return;
  const st = node.scrollTop;
  node.innerHTML = html;
  node.scrollTop = st;
}

function hasFiles(dt) {
  if (!dt) return false;
  const t = dt.types;
  if (!t) return false;
  return Array.prototype.indexOf.call(t, 'Files') >= 0;
}

/* ---------------------------------------------------------------- 状态机 */

function nudgeRect(ms = 1400) {
  S.rectUntil = performance.now() + ms;
  if (!S.rectRAF) S.rectRAF = requestAnimationFrame(rectTick);
}

function rectTick(t) {
  S.rectRAF = 0;
  const r = unionRect();
  const key = [r.x, r.y, r.width, r.height].map((v) => Math.round(v)).join(',');
  if (key !== S.lastRect) {
    S.lastRect = key;
    try {
      api.reportRect({ x: r.x, y: r.y, width: r.width, height: r.height });
    } catch (_) {}
  }
  if (t < S.rectUntil) S.rectRAF = requestAnimationFrame(rectTick);
}

// 卫星按顺序贴紧本体：中间不留空洞（计时没有时，系统圆自动挪到最里侧）
function layoutSats() {
  ['left', 'right'].forEach((side) => {
    let n = 0;
    document.querySelectorAll('.sat[data-side="' + side + '"]').forEach((s) => {
      if (s.classList.contains('hidden')) return;
      s.style.setProperty('--sati', String(n));
      n++;
    });
  });
}

// 岛本体 + 左右卫星合成一个可点击矩形（卫星在岛外面，单独上报会被穿透到桌面）
function unionRect() {
  const r = el.island.getBoundingClientRect();
  let x1 = r.left,
    y1 = r.top,
    x2 = r.right,
    y2 = r.bottom;
  const showSat = S.mode !== 'panel' && S.mode !== 'drop' && !isNotchIdle();
  if (showSat) {
    document.querySelectorAll('.sat').forEach((s) => {
      if (s.classList.contains('hidden')) return;
      const b = s.getBoundingClientRect();
      if (!b.width) return;
      x1 = Math.min(x1, b.left);
      y1 = Math.min(y1, b.top);
      x2 = Math.max(x2, b.right);
      y2 = Math.max(y2, b.bottom);
    });
  }
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

function setMode(m, force) {
  if (!force && S.mode === m) return;
  const prev = S.mode;
  S.mode = m;
  el.stage.dataset.state = m;
  el.stage.style.setProperty('--isl-h', (m === 'panel' ? panelHeight() : HEIGHTS[m]) + 'px');

  el.stage.classList.remove('morph');
  void el.stage.offsetWidth;
  el.stage.classList.add('morph');
  clearTimeout(morphT);
  morphT = setTimeout(() => el.stage.classList.remove('morph'), 1000);

  nudgeRect(m === 'idle' ? 800 : 1600);

  if (m === 'panel') {
    requestAnimationFrame(positionGlider);
    setTimeout(positionGlider, 280);
    setTimeout(positionGlider, 560);
  }
  if (prev === 'panel' && m !== 'panel') {
    const a = document.activeElement;
    if (a && a !== document.body && a.blur) a.blur();
  }
  // 换了形态后宽度变了，重新把位置夹回视口内
  if (typeof S.islandX === 'number') {
    setTimeout(() => applyShift(S.islandX), 520);
  }
}

function positionGlider() {
  if (!el.glider) return;
  const tab = $('.tab[aria-selected="true"]');
  if (!tab) return;
  el.glider.style.width = tab.offsetWidth + 'px';
  el.glider.style.transform = 'translateX(' + tab.offsetLeft + 'px)';
}

function isEditing() {
  const a = document.activeElement;
  if (!a || a === document.body) return false;
  if (a.tagName === 'TEXTAREA') return true;
  if (a.tagName === 'INPUT') {
    // 数字框 / 取色器 / 滑块只是挑个值，不该把面板钉在这里不动
    if (['checkbox', 'number', 'color', 'range'].includes(a.type)) return false;
    return true;
  }
  return false;
}

// 鼠标离开岛时，把「挑数值」这类软焦点收掉，免得键盘还在往看不见的框里输入
function dropSpinFocus() {
  const a = document.activeElement;
  if (!a || a === document.body) return;
  if (a.tagName === 'INPUT' && ['number', 'color', 'range'].includes(a.type)) a.blur();
}

/* ---- 工具条水平位置（拖到顶部任意位置，记住偏移） ---- */
function maxShift(width) {
  const w = width || (el.island ? el.island.getBoundingClientRect().width : 178) || 178;
  // 卫星圆挂在两侧，按最外那颗算：9px 间隙 + 间隔 46px + 直径 38px
  let side = 0;
  if (S.mode !== 'panel' && S.mode !== 'drop' && !isNotchIdle()) {
    let l = 0;
    let r = 0;
    document.querySelectorAll('.sat').forEach((s) => {
      if (s.classList.contains('hidden')) return;
      if (s.dataset.side === 'left') l++;
      else r++;
    });
    const span = (n) => (n ? 9 + (n - 1) * 46 + 38 : 0);
    side = Math.max(span(l), span(r));
  }
  return Math.max(0, (window.innerWidth - w - side * 2) / 2 - 8);
}

function applyShift(v, save) {
  // 刘海样式贴着屏幕正中，不参与左右拖动
  if (isNotch()) {
    S.islandX = 0;
    el.stage.style.setProperty('--isl-shift', '0px');
    nudgeRect(900);
    if (save) {
      try {
        api.settings.save({ islandX: 0 });
      } catch (_) {}
    }
    return 0;
  }
  const m = maxShift();
  const x = Math.max(-m, Math.min(m, Math.round(Number(v) || 0)));
  S.islandX = x;
  el.stage.style.setProperty('--isl-shift', x + 'px');
  nudgeRect(900);
  if (save) {
    try {
      api.settings.save({ islandX: x });
    } catch (_) {}
  }
  return x;
}

function startIslandDrag(e) {
  if (e.button !== 0) return;
  if (isNotch()) return; // 刘海是贴边居中的，不能左右拖
  const t = e.target;
  if (t.closest('input, textarea, select, a, .row, .tab, .msgs, [contenteditable]')) return;
  // 面板里内容多，只有顶部标题栏（Qing Tools + 时间那一行）当拖动把手；
  // idle / compact / peek / 选择态整块都能拖
  if (S.mode === 'panel' && !t.closest('.head, .brand')) return;
  if (S.mode === 'drop') return;
  S.drag = { on: true, x: e.clientX, base: S.islandX || 0, moved: 0, raf: 0, px: null, nudged: 0 };
  try {
    api.app.dragHold(true);
  } catch (_) {}
  document.body.classList.add('island-drag');
  window.addEventListener('mousemove', onIslandDrag);
  window.addEventListener('mouseup', endIslandDrag, { once: true });
  e.preventDefault();
}

function onIslandDrag(e) {
  if (!S.drag || !S.drag.on) return;
  S.drag.px = S.drag.base + (e.clientX - S.drag.x);
  S.drag.moved = Math.max(S.drag.moved, Math.abs(e.clientX - S.drag.x));
  if (S.drag.raf) return;
  S.drag.raf = requestAnimationFrame(() => {
    S.drag.raf = 0;
    if (!S.drag || !S.drag.on) return;
    dragShift(S.drag.px);
  });
}

// 拖动时只写变量、不做 IPC（applyShift 里的 nudgeRect 每帧一次会让整条链路变卡）
function dragShift(v) {
  if (isNotch()) return 0;
  const m = maxShift();
  const x = Math.max(-m, Math.min(m, Math.round(Number(v) || 0)));
  S.islandX = x;
  el.stage.style.setProperty('--isl-shift', x + 'px');
  const now = performance.now();
  if (now - (S.drag.nudged || 0) > 120) {
    S.drag.nudged = now;
    nudgeRect(0);
  }
  return x;
}

function endIslandDrag() {
  window.removeEventListener('mousemove', onIslandDrag);
  document.body.classList.remove('island-drag');
  if (!S.drag) return;
  if (S.drag.raf) cancelAnimationFrame(S.drag.raf);
  const moved = S.drag.moved > 2;
  S.drag.on = false;
  if (moved && S.drag.px != null) {
    S.islandX = Math.max(-maxShift(), Math.min(maxShift(), Math.round(S.drag.px)));
    el.stage.style.setProperty('--isl-shift', S.islandX + 'px');
  }
  nudgeRect(200);
  try {
    api.app.dragHold(false);
  } catch (_) {}
  if (moved) {
    applyShift(S.islandX, true);
    // 拖完不要顺手把面板打开
    S.suppressClick = true;
    setTimeout(() => {
      S.suppressClick = false;
    }, 320);
  }
}

function scheduleCollapse(delay, to) {
  clearTimeout(S.collapseT);
  S.collapseT = setTimeout(function tick() {
    if (S.pointerIn || S.pinned) return;
    if (Date.now() < S.grace) {
      S.collapseT = setTimeout(tick, 500);
      return;
    }
    if (isEditing()) {
      S.collapseT = setTimeout(tick, 1500);
      return;
    }
    setMode(to || 'idle');
  }, delay);
}

function openPanel(tab, pin) {
  if (pin) setPinned(true);
  if (tab) setTab(tab);
  clearTimeout(S.collapseT);
  clearTimeout(S.peekT);
  S.grace = Date.now() + 2200;
  setMode('panel');
}

function setPinned(on) {
  S.pinned = !!on;
  const b = $('#btnPin');
  if (b) b.classList.toggle('on', S.pinned);
}

function setTab(name) {
  if (!name) return;
  const prevTab = S.tab;
  S.tab = name;
  el.stage.dataset.tab = name;
  // 离开小纸条就把高度恢复默认，别的页签不该被拉长
  if (prevTab === 'chat' && name !== 'chat') {
    S.chat.height = 0;
    if (S.mode === 'panel') el.stage.style.setProperty('--isl-h', HEIGHTS.panel + 'px');
    // 窗口也缩回常规高度，别一直挂着一整屏的透明层
    if (S.mode === 'panel') fitWindow(HEIGHTS.panel, true);
  }
  if (name === 'chat' && S.mode === 'panel') {
    el.stage.style.setProperty('--isl-h', panelHeight() + 'px');
    fitWindow(panelHeight(), true);
  }
  // 切页签时把浮层菜单都收掉，免得留在旧坐标上跑到窗口外面
  if (typeof closeNoteMenu === 'function') closeNoteMenu();
  if (typeof closeEditMenu === 'function') closeEditMenu();
  if (typeof closeMsgMenu === 'function') closeMsgMenu();
  if (typeof clearReply === 'function') clearReply();
  $$('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
  requestAnimationFrame(positionGlider);
  renderTab(name);
  if (name === 'chat') {
    const r = curRoom();
    if (r) r.unread = 0;
    chatRender();
    if (typeof chatScrollToEnd === 'function') chatScrollToEnd(true);
  }
  if (name === 'settings') {
    el.stage.style.setProperty('--x', '0');
  }
  if (name === 'tools') {
    renderTools();
    if (el.timerM) setTimeout(() => el.timerM.select(), 260);
  }
  markSeen(name);
}

/* ---------------------------------------------------------------- 提示 */

function toast(msg, isErr) {
  if (!msg) return;
  el.toast.textContent = msg;
  el.toast.classList.toggle('err', !!isErr);
  el.toast.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.toast.classList.remove('show'), 1900);
}

function showPeek(o) {
  // 免打扰：只让数字涨，不展开提示条
  if (isDnd() && !o.force) {
    renderBadges();
    return;
  }
  S.peekCode = o.code || '';
  S.peekRoom = o.room === undefined ? null : o.room;
  S.peekTab = o.room === undefined ? 'mail' : 'chat';
  el.stage.classList.toggle('peek-copy', !!o.code);
  // 被 @ 的时候整条岛和通知条都滚彩虹色
  el.stage.classList.toggle('rainbow-peek', !!o.rainbow);
  if (o.rainbow) glowRainbow(Math.max(o.dur || 5200, RAINBOW_MS));
  if (S.mode === 'panel') {
    // 面板打开时不打断，只轻提示
    toast(o.title + ' · ' + o.sub);
    return;
  }
  el.peekTitle.textContent = o.title || '';
  el.peekSub.textContent = o.sub || '有新消息';
  el.peekTime.textContent = o.time || '';
  if (el.peekHint) el.peekHint.classList.toggle('show', !!o.code);
  if (o.icon) el.peekIc.innerHTML = '<svg class="ic"><use href="' + o.icon + '"/></svg>';

  // 消息类型决定通知条形态：文字 / 图片缩略图 / 表情包
  const kind = o.kind || 'text';
  el.stage.dataset.peek = kind;
  if (el.peekThumb) {
    let inner = '';
    if (kind === 'image' && o.thumb) inner = '<img src="' + esc(o.thumb) + '" alt="">';
    else if (kind === 'sticker') {
      inner = o.thumb
        ? '<img src="' + esc(o.thumb) + '" alt="">'
        : '<span class="emoji-big">' + esc(o.emoji || '💬') + '</span>';
    }
    el.peekThumb.innerHTML = inner;
    el.peekThumb.classList.toggle('hidden', !inner);
  }

  const dur = o.dur || 4200;
  clearTimeout(S.rainbowT);
  S.rainbowT = setTimeout(() => el.stage.classList.remove('rainbow-peek'), dur + 200);
  el.stage.style.setProperty('--peek-dur', dur + 'ms');
  el.peekBar.classList.remove('run');
  void el.peekBar.offsetWidth;
  el.peekBar.classList.add('run');

  setMode('peek');
  clearTimeout(S.peekT);
  S.peekT = setTimeout(() => {
    if (S.mode === 'peek') setMode('idle');
  }, dur);
}

function newMailPing(item) {
  if (!item) return;
  el.mark.classList.add('alarm');
  clearTimeout(alarmT);
  alarmT = setTimeout(() => el.mark.classList.remove('alarm'), 9000);
}

/* ---------------------------------------------------------------- 渲染 */

function applyAccent(name, hexOverride) {
  const st = (S.data && S.data.settings) || {};
  let hex = hexOverride || '';
  let a = ACCENTS[name];
  if (!a || hex) {
    // 自定义颜色（或未知名字时退回已保存的自定义色）
    hex = hex || st.accentColor || '#8f7bff';
    a = [hex, hexA(hex, 0.16)];
  }
  document.documentElement.style.setProperty('--accent', a[0]);
  document.documentElement.style.setProperty('--accent-soft', a[1]);
  $$('.swatch').forEach((s) => s.classList.toggle('active', s.dataset.accent === name));
  const cc = $('#accentCustom');
  if (cc && hex) cc.value = hex;
  else if (cc && st.accentColor) cc.value = st.accentColor;
}

/** 基调：dark / light */
function applyTheme(name) {
  const mode = name === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = mode;
  $$('#themeSeg .seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.theme === mode));
}

/** 外观样式：island（悬浮灵动岛）/ notch（贴顶刘海，平时缩成一条） */
function isNotch() {
  return el.stage.dataset.style === 'notch';
}

// 刘海样式收起时只有一条 10px 的边，卫星圆没地方放，先不显示
function isNotchIdle() {
  return isNotch() && S.mode === 'idle';
}

function applyStyle(name) {
  const mode = name === 'notch' ? 'notch' : 'island';
  el.stage.dataset.style = mode;
  $$('#styleSeg .seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.style === mode));
  // 刘海是贴着屏幕上边居中的，不参与左右拖动
  if (mode === 'notch') applyShift(0, false);
  nudgeRect(1200);
}

function setBadge(node, n) {
  if (!node) return;
  const v = Number(n) || 0;
  node.textContent = v > 0 ? (v > 99 ? '99+' : String(v)) : '';
  node.classList.toggle('zero', v === 0);
}

function chatUnreadTotal() {
  return (S.chat.rooms || []).reduce((n, r) => n + (r.unread || 0), 0);
}

function countsOf() {
  const d = S.data || { mail: {}, notes: [], clips: [], files: [] };
  return {
    mail: (d.mail && d.mail.unseen) || 0,
    notes: (d.notes || []).length,
    clipboard: (d.clips || []).length,
    files: (d.files || []).length,
    chat: chatUnreadTotal()
  };
}

function markSeen(tab) {
  if (!tab || tab === 'settings') return;
  const n = countsOf()[tab];
  if (n === undefined) return;
  S.seen[tab] = n;
  writeSeen();
  renderBadges();
}

function renderBadges() {
  const d = S.data;
  if (!d) return;
  const c = countsOf();

  setBadge(el.qMail, c.mail);
  setBadge(el.qNote, c.notes);
  setBadge(el.qClip, c.clipboard);
  setBadge(el.qFile, c.files);
  setBadge(el.qChat, c.chat);

  const dots = {
    mail: el.tabDotMail,
    notes: el.tabDotNotes,
    clipboard: el.tabDotClip,
    files: el.tabDotFiles,
    chat: el.tabDotChat
  };
  for (const key of Object.keys(dots)) {
    if (!dots[key]) continue;
    dots[key].classList.toggle('on', c[key] > (S.seen[key] || 0) && S.tab !== key);
  }

  // 右侧两颗卫星：红色 = 未读邮件，紫色 = 小纸条未读
  setSat(el.satMail, el.satMailNum, c.mail);
  setSat(el.satChat, el.satChatNum, c.chat);
}

let satLast = { mail: 0, chat: 0 };

function setSat(node, num, value) {
  if (!node) return;
  const on = value > 0;
  const was = node.classList.contains('hidden');
  node.classList.toggle('hidden', !on);
  if (num) num.textContent = value > 99 ? '99+' : String(value || 0);
  node.title = (node.id === 'satMail' ? '未读邮件 ' : '小纸条未读 ') + value;
  if (was && on) {
    node.classList.remove('bump');
    void node.offsetWidth;
    node.classList.add('bump');
  }
  if (was !== !on) nudgeRect(1200);
  layoutSats();
}

function mailStatusText(m) {
  const n = (m.accounts || []).length;
  if (!m.configured) return '未连接邮箱';
  const at = m.lastSync ? ' · 更新于 ' + fmtTime(m.lastSync) : '';
  const multi = n > 1 ? n + ' 个邮箱 · ' : '';
  if (m.mode === 'idle') return multi + '实时推送中' + at;
  if (m.mode === 'connecting') return multi + '正在连接推送…';
  if (m.watchError) return multi + '定时检查' + at;
  return m.lastSync ? multi + '定时检查' + at : '等待同步';
}

/** 邮件账户筛选条：全部 + 每个邮箱 */
function renderMailFilters(m) {
  const box = el.mailFilters;
  if (!box) return;
  const list = m.accounts || [];
  if (list.length < 2) {
    box.innerHTML = '';
    box.classList.add('hidden');
    return;
  }
  box.classList.remove('hidden');
  const cur = S.mailFilter || '';
  const total = list.reduce((n, a) => n + (Number(a.unseen) || 0), 0);
  const one = (id, label, n) =>
    '<button class="mf-chip' + (cur === id ? ' active' : '') + '" data-act="mail-filter" data-acc="' + esc(id) + '">' +
    esc(label) +
    (n > 0 ? '<b class="mf-n">' + (n > 99 ? '99+' : n) + '</b>' : '') +
    '</button>';
  box.innerHTML =
    one('', '全部', total) + list.map((a) => one(a.id, a.label || a.user, Number(a.unseen) || 0)).join('');
}

function renderMail() {
  const m = S.data.mail;
  renderMailFilters(m);
  el.mailStat.textContent = m.configured ? '未读 ' + (m.unseen || 0) : '未连接';
  el.mailSub.textContent = mailStatusText(m);
  el.mailSub.classList.toggle('live', m.configured && m.mode === 'idle');

  // 某个账户单独的报错（多账户时逐条列出）
  const errAcc = (m.accounts || []).filter((a) => a.error);
  if (m.error) {
    el.mailAlert.textContent = m.error;
    el.mailAlert.classList.remove('hidden');
  } else if (errAcc.length) {
    el.mailAlert.textContent = errAcc.map((a) => (a.label || a.user) + '：' + a.error).join('；');
    el.mailAlert.classList.remove('hidden');
  } else {
    el.mailAlert.classList.add('hidden');
  }

  if (!m.configured) {
    paint(el.mailList, '');
    $('#mailToolbar').classList.add('hidden');
    el.mailEmpty.classList.remove('hidden');
    el.mailList.classList.add('hidden');
    return;
  }
  $('#mailToolbar').classList.remove('hidden');
  el.mailEmpty.classList.add('hidden');
  el.mailList.classList.remove('hidden');

  const all = m.items || [];
  const accFilter = S.mailFilter || '';
  const items = accFilter ? all.filter((it) => it.accId === accFilter) : all;
  if (!items.length) {
    paint(
      el.mailList,
      '<div class="empty" style="min-height:200px"><div class="empty-ic"><svg class="ic"><use href="#i-mail"/></svg></div>' +
        '<p class="empty-title">' + (accFilter ? '这个邮箱没有邮件' : '收件箱很干净') + '</p>' +
        '<p class="empty-sub">' + (accFilter ? '换个邮箱看看，或点「全部」。' : '没有未读邮件，或刚同步过。') + '</p></div>'
    );
    return;
  }

  // 打开某封邮件 → 显示详情（原样正文）
  if (S.mailOpen) {
    const one = items.find((x) => x.key === S.mailOpen);
    const meta = (S.mailRead && S.mailRead.meta) || one;
    if (meta) {
      renderMailRead(meta);
      return;
    }
    S.mailOpen = null;
  }

  paint(
    el.mailList,
    items
      .map((it, i) => {
        const c = colorOf(it.fromAddr || it.fromName || 'x');
        const unread = !it.seen ? ' unread' : '';
        const who = it.fromName || it.fromAddr || '未知发件人';
        const chips = [];
        if (it.code) {
          chips.push(
            '<button class="chip code" data-act="mail-code" title="点击复制验证码">' +
              '<svg class="ic"><use href="#i-bolt"/></svg>验证码 ' + esc(it.code) + '</button>'
          );
        }
        if (it.links && it.links.length) {
          chips.push(
            '<button class="chip link" data-act="mail-link" data-url="' + esc(it.links[0]) + '" title="' + esc(it.links[0]) + '">' +
              '<svg class="ic"><use href="#i-external"/></svg>' + (it.links.length > 1 ? '打开链接 +' + (it.links.length - 1) : '打开链接') + '</button>'
          );
        }
        return (
          '<div class="row mail' + unread + '" data-id="' + esc(it.key) + '" role="button" style="animation-delay:' +
          Math.min(i * 18, 220) + 'ms">' +
          '<div class="avatar" style="background:linear-gradient(160deg,' + c[0] + ',' + c[1] + ')">' +
          esc(initialOf(it.fromName, it.fromAddr)) + '</div>' +
          '<div class="row-main"><div class="row-title">' + esc(who) + '</div>' +
          '<div class="row-sub">' + esc(it.subject || '(无主题)') + '</div>' +
          (chips.length ? '<div class="row-chips">' + chips.join('') + '</div>' : '') +
          '</div>' +
          '<div class="row-side"><span class="time">' + esc(timeShort(it.date)) + '</span>' +
          '<div class="row-tools"><button class="icon-btn tool" data-act="mail-copy" title="复制发件人地址">' +
          '<svg class="ic"><use href="#i-copy"/></svg></button></div></div></div>'
        );
      })
      .join('')
  );
}

/* ---------------------------------------------------------------- 邮件阅读 */

/** 极简 HTML 净化：只留排版标签，去掉脚本/外链样式/远程图片/事件属性 */
function sanitizeMailHtml(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  // 真正危险的东西删干净，其余排版尽量保留（用户要的是"原样"）
  doc.querySelectorAll('script, iframe, object, embed, link, meta, form, input, button, svg, video, audio')
    .forEach((n) => n.remove());
  doc.body.querySelectorAll('*').forEach((n) => {
    // 邮件里的 class/style 是为了排版，保留；事件属性和 javascript: 一律去掉
    const keep = new Set(['class', 'style', 'colspan', 'rowspan', 'alt', 'title', 'width', 'height',
      'align', 'valign', 'bgcolor', 'src', 'href', 'border', 'cellpadding', 'cellspacing', 'dir', 'lang']);
    [...n.attributes].forEach((a) => {
      const name = a.name.toLowerCase();
      if (name.startsWith('on')) return n.removeAttribute(a.name);
      if (!keep.has(name)) return n.removeAttribute(a.name);
      const val = String(a.value || '');
      if ((name === 'href' || name === 'src') && /^\s*javascript:/i.test(val)) n.removeAttribute(a.name);
      if ((name === 'href' || name === 'src') && /^\s*data:text\/html/i.test(val)) n.removeAttribute(a.name);
      if (name === 'style' && /expression\s*\(|url\s*\(\s*['"]?\s*javascript:/i.test(val)) n.removeAttribute(a.name);
    });
    if (n.tagName === 'IMG') {
      const src = n.getAttribute('src') || '';
      if (!/^https?:/i.test(src)) n.remove(); // 只放行网络图，data:/file: 一律不要
      else {
        n.setAttribute('loading', 'lazy');
        n.setAttribute('referrerpolicy', 'no-referrer');
      }
      return;
    }
    if (n.tagName === 'A' && n.getAttribute('href')) {
      const href = n.getAttribute('href');
      n.removeAttribute('href');
      n.setAttribute('data-act', 'mail-link');
      n.setAttribute('data-url', href);
      n.classList.add('mr-link');
    }
    if (n.tagName === 'A' && !n.getAttribute('data-act')) n.removeAttribute('href');
  });
  return doc.body.innerHTML;
}

function viewSwitch(active) {
  return (
    '<div class="mr-switch">' +
    '<button class="mr-sw' + (active === 'html' ? ' on' : '') + '" data-act="mail-view" data-view="html">原文</button>' +
    '<button class="mr-sw' + (active === 'text' ? ' on' : '') + '" data-act="mail-view" data-view="text">纯文本</button>' +
    '</div>'
  );
}

function renderMailRead(it) {
  const d = S.mailRead && S.mailRead.key === it.key ? S.mailRead : { key: it.key, loading: true };
  S.mailRead = d;
  const who = it.fromName || it.fromAddr || '未知发件人';
  const when = it.date ? fmtDate(it.date) : '';
  const chips = [];
  if (d.data && d.data.code) {
    chips.push(
      '<button class="chip code" data-act="mail-code" data-code="' + esc(d.data.code) + '" title="点击复制验证码">' +
        '<svg class="ic"><use href="#i-bolt"/></svg>验证码 ' + esc(d.data.code) + '</button>'
    );
  }
  const links = (d.data && d.data.links) || [];
  links.slice(0, 3).forEach((u, i) => {
    chips.push(
      '<button class="chip link" data-act="mail-link" data-url="' + esc(u) + '" title="' + esc(u) + '">' +
        '<svg class="ic"><use href="#i-external"/></svg>' + (links.length > 1 ? '链接 ' + (i + 1) : '打开链接') + '</button>'
    );
  });

  const canSwitch = !!(d.data && d.data.html && d.data.text);
  const view = S.mailView === 'text' ? 'text' : 'html';

  let body;
  if (d.loading) {
    body = '<div class="mr-loading"><i class="spin"></i>正在读取邮件正文…</div>';
  } else if (d.err) {
    body = '<div class="mr-err">' + esc(d.err) + '</div>';
  } else if (d.data && d.data.html && view === 'html') {
    body =
      (canSwitch ? viewSwitch('html') : '') +
      '<div class="mr-body html">' + sanitizeMailHtml(d.data.html) + '</div>';
  } else if (d.data && (d.data.text || d.data.preview)) {
    body =
      (canSwitch ? viewSwitch('text') : '') +
      '<div class="mr-body plain">' + esc(d.data.text || d.data.preview) + '</div>';
  } else if (d.data && d.data.html) {
    body = '<div class="mr-body html">' + sanitizeMailHtml(d.data.html) + '</div>';
  } else {
    body = '<div class="mr-err">这封邮件没有可显示的正文（可能只有附件）。</div>';
  }

  paint(
    el.mailList,
    '<div class="mr">' +
      '<div class="mr-bar"><button class="icon-btn" data-act="mail-back" title="返回列表">' +
      '<svg class="ic"><use href="#i-back"/></svg></button>' +
      '<span class="mr-addr">' + esc(it.fromAddr || who) + '</span>' +
      '<button class="icon-btn" data-act="mail-copy-from" data-addr="' + esc(it.fromAddr || '') + '" title="复制发件人">' +
      '<svg class="ic"><use href="#i-copy"/></svg></button></div>' +
      '<h3 class="mr-subject">' + esc(it.subject || '(无主题)') + '</h3>' +
      '<div class="mr-meta"><span class="mr-who">' + esc(who) + '</span>' +
      (when ? '<span class="mr-when">' + esc(when) + '</span>' : '') + '</div>' +
      (chips.length ? '<div class="row-chips mr-chips">' + chips.join('') + '</div>' : '') +
      body +
      '</div>'
  );
}

function mailScrollTop() {
  const sc = el.mailList && el.mailList.closest('.pane-scroll');
  if (sc) sc.scrollTop = 0;
}

async function openMail(key) {
  const item = (S.data.mail.items || []).find((m) => m.key === key) || {};
  S.mailOpen = key;
  S.mailRead = {
    key,
    loading: true,
    meta: {
      key: item.key || key,
      subject: item.subject || '',
      fromName: item.fromName || '',
      fromAddr: item.fromAddr || '',
      date: item.date || null,
      account: item.accLabel || ''
    }
  };
  renderMail();
  mailScrollTop();
  nudgeRect(1400);
  try {
    const r = await api.mail.detail(key);
    if (S.mailOpen !== key) return;
    const meta = S.mailRead.meta;
    S.mailRead =
      r && r.ok === false
        ? { key, loading: false, meta, err: r.message || '读取失败' }
        : {
            key,
            loading: false,
            meta: {
              key: meta.key,
              subject: meta.subject || (r && r.subject) || '',
              fromName: meta.fromName || (r && r.fromName) || '',
              fromAddr: meta.fromAddr || (r && r.fromAddr) || '',
              date: meta.date || (r && r.date) || null,
              account: meta.account || (r && r.account) || ''
            },
            data: r
          };
    renderMail();
    mailScrollTop();
    nudgeRect(1200);
  } catch (err) {
    if (S.mailOpen !== key) return;
    const meta = S.mailRead.meta;
    S.mailRead = { key, loading: false, meta, err: '读取失败：' + (err && err.message ? err.message : err) };
    renderMail();
    mailScrollTop();
    nudgeRect(1200);
  }
}

function closeMail() {
  S.mailOpen = null;
  S.mailRead = null;
  renderMail();
  mailScrollTop();
  nudgeRect(1000);
}

/* 备忘录正文里的图片标记：[[img:<file>]]，可以放在文字中间任意位置 */
function noteToken(file) {
  return '[[img:' + file + ']]';
}

/* 图片地址：本机的走 islandclip，云端同步过来的走 CDN（cloud:<key>） */
function imgSrcOf(file) {
  const f = String(file || '');
  if (!f || f === 'undefined' || f === 'null') return '';
  if (f.startsWith('cloud:')) {
    const base = S.cloudBase || '';
    return base ? base + '/' + f.slice(6) : '';
  }
  return 'islandclip://note/' + f;
}

async function loadCloudBase() {
  if (S.cloudBase) return S.cloudBase;
  try {
    const r = await fetch(CHAT_API + '/api/cloud');
    const d = await r.json();
    if (d && d.domain) S.cloudBase = String(d.domain).replace(/\/+$/, '');
  } catch (_) {}
  return S.cloudBase || '';
}

function noteImgTag(file) {
  const url = imgSrcOf(file);
  if (!url) return '';
  return '<img class="note-img" src="' + esc(url) + '" data-img="' + esc(url) + '" alt="图片" draggable="false">';
}

function notePlain(text) {
  return String(text || '').replace(/\[\[img:[^\]\s]+\]\]/g, '[图片]');
}

function noteBodyHtml(n) {
  const text = String(n.text || '');
  let head = '';
  // 老数据：图片存在 note.image 字段、正文里没有标记
  if (n.image && text.indexOf(noteToken(n.image)) < 0) head = noteImgTag(n.image);
  const segs = noteSegs(text);
  const html = segs
    .map((s) => {
      if (s.img) return noteImgTag(s.img);
      if (!s.text) return '';
      return '<div class="row-text">' + esc(s.text) + '</div>';
    })
    .join('');
  return head + html;
}

/** 把正文拆成「文字段 / 图片段」，顺手去掉图片两边多余的空行（图片本来就独占一行） */
function noteSegs(text) {
  const raw = String(text || '').split(/(\[\[img:[^\]\s]+\]\])/g);
  const out = [];
  for (const seg of raw) {
    const m = /^\[\[img:([^\]\s]+)\]\]$/.exec(seg);
    if (m) out.push({ img: m[1] });
    else if (seg) out.push({ text: seg });
  }
  for (let i = 0; i < out.length; i++) {
    const s = out[i];
    if (!s.text) continue;
    if (i > 0 && out[i - 1].img) s.text = s.text.replace(/^\n/, '');
    if (i < out.length - 1 && out[i + 1].img) s.text = s.text.replace(/\n$/, '');
  }
  return out;
}

/** 编辑态没法在 textarea 里画图，就在输入框上面排一行小缩略图 */
function noteThumbItems(text) {
  const files = [];
  String(text || '').replace(/\[\[img:([^\]\s]+)\]\]/g, (m, f) => {
    files.push(f);
    return m;
  });
  return files
    .map((f) => {
      const url = imgSrcOf(f);
      if (!url) return '';
      return '<img class="note-thumb" src="' + esc(url) + '" data-img="' + esc(url) + '" alt="图片" draggable="false">';
    })
    .join('');
}

/* ---- 编辑态：contenteditable 富文本（图片就在文字中间，像 iPhone 备忘录） ---- */
function noteRichImg(f, cls) {
  const url = imgSrcOf(f);
  return (
    '<img class="' + (cls || 'note-pic') + '" src="' + esc(url) + '" data-file="' + esc(f) +
    '" data-img="' + esc(url) + '" alt="图片" contenteditable="false" draggable="false">'
  );
}

function noteRichHtml(text) {
  let out = '';
  for (const seg of noteSegs(text)) {
    if (seg.img) {
      out += noteRichImg(seg.img);
      continue;
    }
    // 文本：换行 → <br>；图片是块级元素，自己会换行，不用再补
    out += esc(seg.text).replace(/\n/g, '<br>');
  }
  return out;
}

/** 把 contenteditable 里的结构读回 [[img:…]] 文本：文本原样、<br> 换行、图片独占一行 */
function noteRichRead(root) {
  let out = '';
  const nl = () => {
    if (out && !/\n$/.test(out)) out += '\n';
  };
  const walk = (node) => {
    node.childNodes.forEach((n) => {
      if (n.nodeType === 3) {
        out += n.nodeValue.replace(/\u00a0/g, ' ');
        return;
      }
      if (n.nodeType !== 1) return;
      const tag = n.tagName;
      if (tag === 'BR') {
        nl();
        return;
      }
      if (tag === 'IMG') {
        const f = n.dataset && n.dataset.file;
        if (f) {
          nl();
          out += '[[img:' + f + ']]';
          nl();
        }
        return;
      }
      if (tag === 'DIV' || tag === 'P') {
        nl();
        walk(n);
        nl();
        return;
      }
      walk(n);
    });
  };
  walk(root);
  return out.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').replace(/\n+$/, '');
}

/** 在 contenteditable 的光标处插入节点，并把光标放到它后面 */
function noteRichInsert(node, after) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return false;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  range.insertNode(node);
  const next = after || document.createTextNode('\n');
  node.parentNode.insertBefore(next, node.nextSibling);
  const r2 = document.createRange();
  if (next.nodeType === 3) r2.setStart(next, next.length);
  else r2.setStartAfter(next);
  r2.collapse(true);
  sel.removeAllRanges();
  sel.addRange(r2);
  return true;
}

function liveNoteBox() {
  return el.noteList.querySelector('.note-rich[contenteditable="true"]');
}

/** 把正在编辑的富文本立刻写回（重绘前必须调用，否则刚打的字会被旧数据覆盖） */
function flushLiveNote() {
  const box = liveNoteBox();
  if (!box || !box.dataset.id) return;
  const id = box.dataset.id;
  const text = noteRichRead(box);
  const cur = (S.data.notes || []).find((n) => n.id === id);
  clearTimeout(S.noteSaveT);
  if (!cur) return;
  if (cur.text === text) return;
  cur.text = text;
  cur.updatedAt = Date.now();
  api.notes.update(id, text).catch(() => null);
}

/** 排序：置顶优先 + 最近改动靠前；正在编辑的那条固定在原来的位置，别在手指底下跳走 */
function noteSort(list) {
  const sorted = list.slice().sort((a, b) => {
    if (!!b.pinned !== !!a.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
    return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
  });
  if (S.noteEdit && S.noteOrder && S.noteOrder.length) {
    const want = S.noteOrder.indexOf(S.noteEdit);
    const cur = sorted.findIndex((n) => n.id === S.noteEdit);
    if (want >= 0 && cur >= 0 && want !== cur) {
      const [one] = sorted.splice(cur, 1);
      sorted.splice(Math.min(want, sorted.length), 0, one);
    }
  }
  S.noteOrder = sorted.map((n) => n.id);
  return sorted;
}

function renderNotes() {
  const notes = noteSort(S.data.notes || []);
  const openTodo = notes.filter((n) => n.kind === 'todo' && !n.done).length;
  if (el.noteStat) {
    el.noteStat.textContent = notes.length
      ? notes.length + ' 条事项' + (openTodo ? ' · ' + openTodo + ' 个待办没完成' : '')
      : '还没有事项';
  }
  if (!notes.length) {
    paint(el.noteList, '');
    el.noteEmpty.classList.remove('hidden');
    return;
  }
  el.noteEmpty.classList.add('hidden');
  const live = el.noteList.querySelector('.note-rich[contenteditable="true"]');
  // 正在编辑的富文本框不要重建：contenteditable 一重建，光标和选区就没了
  if (live) {
    if (document.activeElement === live && S.noteEdit === live.dataset.id) return;
    // 要重绘了：先把输入框里还没自动保存的字写回去，否则会被旧数据盖掉
    flushLiveNote();
  }
  paint(
    el.noteList,
    notes
      .map((n, i) => {
        const open = S.noteOpen === n.id;
        const editing = open && S.noteEdit === n.id;
        const todo = n.kind === 'todo';
        return (
          '<div class="row note' + (n.pinned ? ' pinned' : '') + (open ? ' open' : '') +
          (editing ? ' editing' : '') + (todo ? ' todo' : '') + (todo && n.done ? ' done' : '') +
          '" data-id="' + n.id + '" role="button" style="animation-delay:' +
          Math.min(i * 18, 220) + 'ms">' +
          (todo
            ? '<button class="check-btn' + (n.done ? ' on' : '') + '" data-act="note-done" title="' +
              (n.done ? '标记未完成' : '完成') + '"><svg class="ic"><use href="#i-' +
              (n.done ? 'check' : 'circle') + '"/></svg></button>'
            : '') +
          '<div class="row-main">' +
          (n.pinned ? '<div class="row-sub"><span class="tag stuck">已钉在桌面</span></div>' : '') +
          (n.origin && n.origin.conflict
            ? '<div class="row-sub"><span class="tag conflict">另一台设备改过的版本</span></div>'
            : '') +
          (editing
            ? '<div class="note-rich" contenteditable="true" data-id="' + n.id +
              '" spellcheck="false" role="textbox" aria-multiline="true">' + noteRichHtml(n.text) + '</div>' +
              '<div class="note-actions">' +
              '<button class="mini primary" data-act="note-save">保存</button>' +
              '<button class="mini" data-act="note-cancel">取消</button>' +
              '<span class="note-tip">回车换行 · Ctrl+V 插图 · Ctrl+Enter 保存</span>' +
              '</div>'
            : noteBodyHtml(n) +
              (open ? '<div class="note-hint">点一下收起 · 可以拖选文字 · 右键有更多</div>' : '')) +
          '</div>' +
          '<div class="row-side"><span class="time">' + esc(fmtTime(n.updatedAt || n.createdAt)) + '</span>' +
          '<div class="row-tools">' +
          '<button class="icon-btn tool" data-act="note-edit" title="编辑"><svg class="ic"><use href="#i-text"/></svg></button>' +
          '<button class="icon-btn tool' + (S.account.signedIn ? '' : ' hidden') + '" data-act="note-share" data-id="' + esc(n.id) + '" title="咻给好友"><svg class="ic"><use href="#i-send"/></svg></button>' +
          '<button class="icon-btn tool" data-act="note-to-chat" title="发送到小纸条"><svg class="ic"><use href="#i-chat"/></svg></button>' +
          '<button class="icon-btn tool' + (n.pinned ? ' on' : '') + '" data-act="note-pin" title="' + (n.pinned ? '取消钉在桌面' : '钉到桌面') + '"><svg class="ic"><use href="#i-sticky"/></svg></button>' +
          '<button class="icon-btn tool danger' + (n.pinned ? ' locked' : '') + '" data-act="note-del" title="' +
          (n.pinned ? '先取消钉在桌面才能删除' : '删除') + '"' + (n.pinned ? ' disabled' : '') +
          '><svg class="ic"><use href="#i-trash"/></svg></button>' +
          '</div></div></div>'
        );
      })
      .join('')
  );
}

/** 编辑态：把光标放到那行富文本末尾 */
function focusNoteEditor(id) {
  const box = el.noteList.querySelector('.note-rich[data-id="' + id + '"]');
  if (!box) return;
  box.focus({ preventScroll: true });
  try {
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(box);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  } catch (e) {
    /* ignore */
  }
  box.scrollTop = box.scrollHeight;
}

/** 当前选中的文字（只在岛内、非输入框里才算） */
function noteSelection() {  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return '';
  const text = String(sel).trim();
  if (!text) return '';
  const node = sel.anchorNode;
  if (!node || !document.getElementById('island')?.contains(node)) return '';
  return text;
}

function renderClips() {  const q = S.clipQuery.trim().toLowerCase();
  let clips = S.data.clips || [];
  if (q) {
    clips = clips.filter((c) => (c.kind === 'text' ? String(c.text || '').toLowerCase().includes(q) : false));
  }
  if (!clips.length) {
    paint(el.clipList, '');
    el.clipEmpty.classList.remove('hidden');
    if (q) {
      el.clipEmpty.querySelector('.empty-title').textContent = '没有匹配的记录';
      el.clipEmpty.querySelector('.empty-sub').textContent = '换个关键词试试。';
    } else {
      el.clipEmpty.querySelector('.empty-title').textContent = '剪贴板是空的';
      el.clipEmpty.querySelector('.empty-sub').textContent =
        '复制文字或图片后会自动出现在这里，点一下就能再次复制。';
    }
    return;
  }
  el.clipEmpty.classList.add('hidden');

  paint(
    el.clipList,
    clips
      .map((c, i) => {
        const thumb =
          c.kind === 'image'
            ? '<img class="clip-thumb" src="' + (c.thumb || c.dataUrl || '') + '" alt="" draggable="false">'
            : '<div class="clip-ic"><svg class="ic"><use href="#i-text"/></svg></div>';
        const body =
          c.kind === 'image'
            ? '<div class="row-sub">图片' + (c.bytes ? ' · ' + fmtSize(c.bytes) : '') + '</div>'
            : '<div class="row-text">' + esc(c.text) + '</div>';
        return (
          '<div class="row clip' + (c.pinned ? ' pinned' : '') + '" data-id="' + c.id + '" role="button" style="animation-delay:' +
          Math.min(i * 16, 200) + 'ms">' +
          thumb +
          '<div class="row-main">' +
          (c.pinned ? '<div class="row-sub"><span class="tag">固定</span></div>' : '') +
          body +
          '</div>' +
          '<div class="row-side"><span class="time">' + esc(fmtTime(c.createdAt)) + '</span>' +
          '<div class="row-tools">' +
          '<button class="icon-btn tool" data-act="clip-to-chat" title="发送到小纸条"><svg class="ic"><use href="#i-send"/></svg></button>' +
          '<button class="icon-btn tool' + (c.pinned ? ' on' : '') + '" data-act="clip-pin" title="' + (c.pinned ? '取消固定' : '固定') + '"><svg class="ic"><use href="#i-pin"/></svg></button>' +
          '<button class="icon-btn tool danger' + (c.pinned ? ' locked' : '') + '" data-act="clip-del" title="' +
            (c.pinned ? '先取消固定才能删除' : '删除') + '"' + (c.pinned ? ' disabled' : '') +
            '><svg class="ic"><use href="#i-trash"/></svg></button>' +
          '</div></div></div>'
        );
      })
      .join('')
  );
}

function extClass(ext, isDir) {
  if (isDir) return 'dir';
  const e = String(ext || '').toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(e)) return 'img';
  if (['doc', 'docx', 'txt', 'md', 'rtf'].includes(e)) return 'doc';
  if (e === 'pdf') return 'pdf';
  if (['zip', 'rar', '7z', 'gz', 'tar'].includes(e)) return 'zip';
  return '';
}

function renderFiles() {
  const files = S.data.files || [];
  el.fileStat.textContent = files.length ? files.length + ' 个项目' : '暂无文件';
  $('#fileCopyAll').toggleAttribute('disabled', !files.length);
  if (!files.length) {
    paint(
      el.fileList,
      '<div class="empty" style="min-height:120px"><div class="empty-ic"><svg class="ic"><use href="#i-folder"/></svg></div>' +
        '<p class="empty-title">这里还没有文件</p><p class="empty-sub">把文件拖进来，或点右上角的 + 添加。<br/>随时可以整组复制到剪贴板。</p></div>'
    );
    return;
  }
  paint(
    el.fileList,
    files
      .map((f, i) => {
        const cls = extClass(f.ext, f.isDir);
        const label = f.isDir ? 'DIR' : String(f.ext || 'FILE').slice(0, 4);
        return (
          '<div class="row file" data-id="' + f.id + '" role="button" draggable="true" title="' + esc(f.path) +
          '" style="animation-delay:' + Math.min(i * 18, 220) + 'ms">' +
          '<div class="file-ic ' + cls + '">' + esc(label) + '</div>' +
          '<div class="row-main"><div class="row-title">' + esc(f.name) + '</div>' +
          '<div class="row-sub">' + (f.isDir ? '文件夹' : fmtSize(f.size)) + ' · ' + esc(fmtTime(f.addedAt)) + '</div></div>' +
          '<div class="row-side"><div class="row-tools">' +
          '<button class="icon-btn tool" data-act="file-copy" title="复制文件"><svg class="ic"><use href="#i-copy"/></svg></button>' +
          '<button class="icon-btn tool" data-act="file-path" title="复制路径"><svg class="ic"><use href="#i-text"/></svg></button>' +
          '<button class="icon-btn tool" data-act="file-reveal" title="在文件夹中显示"><svg class="ic"><use href="#i-folder"/></svg></button>' +
          '<button class="icon-btn tool danger" data-act="file-del" title="移除"><svg class="ic"><use href="#i-x"/></svg></button>' +
          '</div></div></div>'
        );
      })
      .join('')
  );
}

/* ===================== 账号（1.11.0） ===================== */
function accStamp(ts) {
  if (!ts) return '';
  const d = new Date(Number(ts));
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  if (sameDay) return '今天 ' + hm;
  const yest = new Date(now.getTime() - 86400000);
  if (d.toDateString() === yest.toDateString()) return '昨天 ' + hm;
  return d.getMonth() + 1 + '/' + d.getDate() + ' ' + hm;
}

function accMsg(node, text, kind) {
  if (!node) return;
  node.textContent = text || '';
  node.classList.toggle('err', kind === 'err');
  node.classList.toggle('ok', kind === 'ok');
}

function accRenderDevices(list) {
  if (!el.accDevList) return;
  if (!list || !list.length) {
    el.accDevList.innerHTML = '<div class="dev-row"><span class="dev-name">还没有设备信息</span></div>';
    return;
  }
  el.accDevList.innerHTML = list
    .map(
      (s) =>
        '<div class="dev-row">' +
        '<span class="dev-name">' +
        esc(s.deviceName || '未命名设备') +
        '</span>' +
        (s.current ? '<span class="dev-tag">这台</span>' : '') +
        '<span class="dev-time">' +
        esc(accStamp(s.lastSeen)) +
        '</span>' +
        (s.current ? '' : '<button class="mini" data-dev-kick="' + esc(s.id) + '">移除</button>') +
        '</div>'
    )
    .join('');
}

function accPaint() {
  const a = S.account;
  if (el.accOut) el.accOut.classList.toggle('hidden', a.signedIn);
  if (el.accIn) el.accIn.classList.toggle('hidden', !a.signedIn);
  // M3：账号区之外，设置页最下面还有一条「退出登录」（用户要求）
  if (el.accLogoutRow) el.accLogoutRow.classList.toggle('hidden', !a.signedIn);
  if (a.signedIn && a.user) {
    el.accName.textContent = a.user.nick || a.user.username;
    el.accSub.textContent = '@' + a.user.username;
    accRenderDevices(a.sessions || []);
  }
  syncPaint();
}

/** M7：设置页那条「事项同步」状态 */
async function syncPaint() {
  if (!el.syncSub) return;
  if (!S.account.signedIn) {
    el.syncSub.textContent = '还没登录';
    return;
  }
  try {
    const st = await api.sync.status();
    const ago = st.lastPullAt ? Math.max(0, Math.round((Date.now() - st.lastPullAt) / 1000)) : -1;
    const when = !st.lastPullAt ? '还没同步过' : ago < 60 ? ago + ' 秒前' : Math.round(ago / 60) + ' 分钟前';
    const n = (S.data.notes || []).length;
    el.syncSub.textContent =
      n + ' 条事项 · ' + when + (st.dirty ? ' · ' + st.dirty + ' 条待上传' : '') + (st.lastError ? ' · ' + st.lastError : '');
  } catch (_) {
    el.syncSub.textContent = '同步状态未知';
  }
}

async function loadAccountToken() {
  try {
    S.account.userToken = (api.account && api.account.token ? await api.account.token() : '') || '';
  } catch {
    S.account.userToken = '';
  }
}

async function accLoadStatus() {
  try {
    const st = await api.account.status();
    S.account.signedIn = !!(st && st.signedIn);
    S.account.user = (st && st.user) || null;
    await loadAccountToken();
    if (S.account.signedIn) await accFetchSessions();
  } catch (_) {
    S.account.signedIn = false;
  }
  accPaint();
  await accLoadClaim();
  await accLoadFriends();
  await claimLocalRooms();
  await bindRoomsToAccount();
  await syncAccountRooms();
  if (S.account.signedIn) pollShares();
}

// M3：本机旧数据归属——登录后如果本机还有没归属过的数据，就把卡片亮出来
async function accLoadClaim() {
  const box = el.accClaim;
  if (!box) return;
  let info = null;
  try {
    info = await api.account.claimInfo();
  } catch (_) {
    info = null;
  }
  const show = !!(info && info.ok && info.signedIn && info.total > 0 && !info.claimed);
  box.classList.toggle('hidden', !show);
  if (!show) return;
  const c = info.counts || {};
  const parts = [];
  if (c.notes) parts.push(c.notes + ' 条备忘录');
  if (c.todos) parts.push(c.todos + ' 个待办');
  if (c.reminders) parts.push(c.reminders + ' 条提醒');
  if (c.anniversaries) parts.push(c.anniversaries + ' 个纪念日');
  if (el.accClaimText) {
    el.accClaimText.innerHTML = '这台电脑上还有 <b>' + parts.join(' · ') + '</b>，要把它们归到当前账号吗？归属只做一次，之后切账号不会再提示。';
  }
}

async function accDoClaim() {
  if (S.account.busy) return;
  try {
    window.confirm('确认把本机数据归到这个账号？属于别的账号的频道会按「先到先得」处理。');
  } catch (_) {}
  S.account.busy = true;
  try {
    const r = await api.account.claim();
    if (r && r.ok) {
      accMsg(el.accClaimMsg, '已归属：' + JSON.stringify(r.copied || {}), 'ok');
      if (el.accClaim) el.accClaim.classList.add('hidden');
      toast('本机数据已归到这个账号');
      setTimeout(() => location.reload(), 900);
    } else {
      accMsg(el.accClaimMsg, (r && r.message) || '归属失败', 'err');
    }
  } finally {
    S.account.busy = false;
  }
}

async function accExportBackup() {
  try {
    const r = await api.app.exportBackup();
    if (r && r.ok) {
      toast('备份已导出');
      accMsg(el.accClaimMsg, '备份：' + r.file, 'ok');
    } else {
      toast((r && r.message) || '导出失败');
    }
  } catch (err) {
    toast('导出失败');
  }
}

// M3：频道归属——登录后把本机已有的频道逐个试着认领（先到先得，被别人抢走就跳过）
async function claimLocalRooms() {
  if (!S.account.signedIn || S.account.roomsClaimed) return;
  const rooms = (S.chat && Array.isArray(S.chat.rooms) && S.chat.rooms) || [];
  const codes = rooms.map((r) => (r && r.code ? String(r.code).replace(/\s+/g, '') : '')).filter(Boolean);
  if (!codes.length) return;
  S.account.roomsClaimed = true;
  let claimed = 0;
  for (const code of codes) {
    try {
      const r = await api.account.claimRoom(code);
      if (r && r.ok && r.claimed) claimed += 1;
    } catch (_) {}
  }
  if (claimed) {
    toast(claimed + ' 个频道已归到这个账号');
    chatRenderRooms();
  }
}

// M5 补丁：登录前就加入过的频道，把这台设备挂到账号上，成员/投票/已读才按「人」算
async function bindRoomsToAccount() {
  if (!S.account.signedIn) return;
  const rooms = (S.chat && Array.isArray(S.chat.rooms) && S.chat.rooms) || [];
  let attached = 0;
  for (const r of rooms) {
    if (!r || !r.roomId || !r.deviceId || !r.token) continue;
    if (r._accountBound) continue;
    try {
      const res = await api.account.attachDevice(r.roomId, r.deviceId, r.token);
      if (res && res.ok) {
        r._accountBound = true;
        if (res.attached) attached += 1;
      }
    } catch (_) {}
  }
  if (attached) {
    for (const r of rooms) {
      if (!r || !r.roomId || !r._accountBound) continue;
      try {
        const info = await chatFetch('/api/rooms/' + encodeURIComponent(r.roomId) + '/info');
        if (info && info.ok) {
          r.members = info.members || r.members;
          r.info = info.room || r.info;
          if (typeof renderChatMembers === 'function') renderChatMembers();
        }
      } catch (_) {}
    }
    toast(attached + ' 个频道已认到账号上');
  }
}

// M5 第一刀：同一个账号在别的设备上建/认领过的频道，登录后自动加回来
let roomSyncing = false;
async function syncAccountRooms() {
  if (!S.account.signedIn || roomSyncing) return;
  if (!S.chat || !Array.isArray(S.chat.rooms)) return;
  let mine = null;
  try {
    mine = await api.account.myRooms();
  } catch (_) {
    return;
  }
  if (!mine || !mine.ok || !Array.isArray(mine.rooms)) return;
  const have = new Set(S.chat.rooms.map((r) => (r && r.code ? r.code : '')).filter(Boolean));
  const todo = mine.rooms.filter((r) => r.code && !have.has(r.code)).slice(0, 10);
  if (!todo.length) return;
  roomSyncing = true;
  let joined = 0;
  for (const r of todo) {
    try {
      const name = chatDefaultName();
      const res = await chatFetch('/api/rooms/join', {
        method: 'POST',
        body: { code: r.code, deviceName: name, replace: true }
      });
      if (res && res.ok) {
        chatAddRoom(res.data, name);
        joined += 1;
      }
    } catch (_) {}
  }
  roomSyncing = false;
  if (joined) toast(joined + ' 个频道跟着账号回来了');
}

async function accFetchSessions() {
  try {
    const me = await api.account.me();
    if (me && me.ok) {
      S.account.user = me.user || S.account.user;
      S.account.sessions = me.sessions || [];
    } else if (me && me.code === 'unauthorized') {
      S.account.signedIn = false;
      S.account.user = null;
      S.account.sessions = [];
    }
  } catch (_) {
    /* ignore */
  }
  accPaint();
}

function accBusy(on) {
  S.account.busy = !!on;
  [el.accLogin, el.accRegister, el.accRGo, el.accDGo, el.accLogout, el.accLogoutAll, el.accRefresh].forEach((b) => {
    if (b) b.disabled = !!on;
  });
}

function accShowCode(code) {
  S.account.pendingCode = code;
  el.accCode.classList.remove('hidden');
  el.accCodeVal.textContent = code;
  el.accCodeOk.checked = false;
  el.accCodeDone.disabled = true;
}

function accHideCode() {
  S.account.pendingCode = '';
  el.accCode.classList.add('hidden');
  el.accCodeVal.textContent = '';
}

async function accDoLogin() {
  const username = el.accUser.value.trim();
  const password = el.accPass.value;
  if (!username || !password) return accMsg(el.accOutMsg, '用户名和密码都要填', 'err');
  accBusy(true);
  accMsg(el.accOutMsg, '正在登录…');
  const r = await api.account.login({ username, password });
  accBusy(false);
  if (!r || !r.ok) return accMsg(el.accOutMsg, (r && r.message) || '登录失败', 'err');
  accMsg(el.accOutMsg, '');
  el.accPass.value = '';
  S.account.signedIn = true;
  S.account.user = r.user || null;
  await loadAccountToken();
  await accFetchSessions();
  accPaint();
  await accLoadClaim();
  await accLoadFriends();
  await claimLocalRooms();
  await bindRoomsToAccount();
  await syncAccountRooms();
  toast('已登录：' + ((r.user && (r.user.nick || r.user.username)) || username));
}

async function accDoRegister() {
  const username = el.accUser.value.trim();
  const password = el.accPass.value;
  if (!username || !password) return accMsg(el.accOutMsg, '用户名和密码都要填', 'err');
  accBusy(true);
  accMsg(el.accOutMsg, '正在注册…');
  const r = await api.account.register({ username, password });
  accBusy(false);
  if (!r || !r.ok) return accMsg(el.accOutMsg, (r && r.message) || '注册失败', 'err');
  accMsg(el.accOutMsg, '');
  el.accPass.value = '';
  S.account.signedIn = true;
  S.account.user = r.user || null;
  accShowCode(r.recoveryCode || '');
  await accFetchSessions();
  accPaint();
  await accLoadClaim();
  await accLoadFriends();
  await claimLocalRooms();
  await bindRoomsToAccount();
  await syncAccountRooms();
}

async function accDoRecover() {
  const username = el.accRUser.value.trim();
  const code = el.accRCode.value.trim();
  const newPassword = el.accRPass.value;
  if (!username || !code || !newPassword) return accMsg(el.accRMsg, '三项都要填', 'err');
  accBusy(true);
  accMsg(el.accRMsg, '正在换密码…');
  const r = await api.account.recover({ username, code, newPassword });
  accBusy(false);
  if (!r || !r.ok) return accMsg(el.accRMsg, (r && r.message) || '找回失败', 'err');
  accMsg(el.accRMsg, '');
  el.accRPass.value = '';
  el.accRCode.value = '';
  S.account.signedIn = true;
  S.account.user = r.user || null;
  el.accRecover.classList.add('hidden');
  accShowCode(r.recoveryCode || '');
  await accFetchSessions();
  accPaint();
  toast('密码已更新，恢复码也换了一把');
}

async function accDoLogout(all) {
  accBusy(true);
  const r = all ? await api.account.logoutAll() : await api.account.logout();
  accBusy(false);
  if (r && r.ok === false) {
    toast((r.message || '退出失败') + '（本地登录态已清除）');
  } else {
    toast(all ? '已退出所有设备' : '已退出这台电脑');
  }
  S.account.signedIn = false;
  S.account.user = null;
  S.account.sessions = [];
  accHideCode();
  accPaint();
  if (el.accClaim) el.accClaim.classList.add('hidden');
  // 退出后主进程已经切回本机分区，直接重载一次界面，避免残留上一个账号的数据
  setTimeout(() => location.reload(), 500);
}

async function accDoDelete() {
  const username = el.accDUser.value.trim();
  const password = el.accDPass.value;
  const code = el.accDCode.value.trim();
  if (!username || !password || !code) return accMsg(el.accDMsg, '三项都要填', 'err');
  accBusy(true);
  accMsg(el.accDMsg, '正在注销…');
  const r = await api.account.remove({ username, password, code });
  accBusy(false);
  if (!r || !r.ok) return accMsg(el.accDMsg, (r && r.message) || '注销失败', 'err');
  el.accDPass.value = '';
  el.accDCode.value = '';
  el.accDUser.value = '';
  el.accDel.classList.add('hidden');
  accMsg(el.accDMsg, '');
  S.account.signedIn = false;
  S.account.user = null;
  S.account.sessions = [];
  accPaint();
  toast('账号已注销');
}

/* ── M6：亲密好友 + 「咻」分享 + 心动散射 ───────────────────────────── */

async function accLoadFriends() {
  if (!S.account.signedIn) {
    S.account.friends = [];
    S.account.requests = [];
    S.account.outgoing = [];
    renderAccFriends();
    return;
  }
  const r = await api.account.bindings();
  if (r && r.ok) {
    S.account.friends = r.friends || [];
    S.account.requests = r.incoming || [];
    S.account.outgoing = r.outgoing || [];
  }
  renderAccFriends();
  renderChatPeople();
}

function renderAccFriends() {
  const list = S.account.friends || [];
  const reqs = S.account.requests || [];
  const out = S.account.outgoing || [];
  let html = '';
  reqs.forEach((q) => {
    html +=
      '<div class="friend-row req"><span class="fr-main"><b>' +
      esc(q.from.nick || q.from.username) +
      '</b><i>@' +
      esc(q.from.username) +
      ' 想和你绑定</i></span><span class="fr-acts">' +
      '<button class="mini primary" data-act="friend-accept" data-id="' +
      esc(q.id) +
      '">同意</button>' +
      '<button class="mini" data-act="friend-reject" data-id="' +
      esc(q.id) +
      '">拒绝</button></span></div>';
  });
  list.forEach((f) => {
    html +=
      '<div class="friend-row"><span class="fr-main"><b>' +
      esc(f.nick || f.username) +
      '</b><i>@' +
      esc(f.username) +
      '</i></span>' +
      '<button class="mini danger" data-act="friend-remove" data-id="' +
      esc(f.bindId || '') +
      '">解除</button></div>';
  });
  out.forEach((q) => {
    html +=
      '<div class="friend-row wait"><span class="fr-main"><b>' +
      esc(q.to.nick || q.to.username) +
      '</b><i>已申请，等对方同意</i></span></div>';
  });
  if (!html) html = '<div class="friend-none">还没有好友。绑一个，写好的事项就能一键咻过去。</div>';
  if (el.accFriends) el.accFriends.innerHTML = html;
  renderShareList();
}

async function accAddFriend() {
  const name = el.accFriendName ? el.accFriendName.value.trim() : '';
  if (!name) return accMsg(el.accFriendMsg, '先填对方用户名', 'err');
  const r = await api.account.bind(name);
  if (r && r.ok) {
    if (el.accFriendName) el.accFriendName.value = '';
    accMsg(el.accFriendMsg, r.accepted ? '已和 ' + name + ' 结成好友' : '申请已发出去，等对方同意', 'ok');
    await accLoadFriends();
  } else {
    accMsg(el.accFriendMsg, (r && r.message) || '没加上', 'err');
  }
}

async function accFriendAct(id, act) {
  if (!id) return;
  if (act === 'remove' && !window.confirm('解除和这位好友的绑定？')) return;
  const r = await api.account.bindingAct(id, act);
  if (r && r.ok) {
    accMsg(el.accFriendMsg, act === 'remove' ? '已解除绑定' : act === 'accept' ? '已经绑定好了' : '已拒绝', 'ok');
    await accLoadFriends();
  } else {
    accMsg(el.accFriendMsg, (r && r.message) || '操作没成功', 'err');
  }
}

function renderShareList() {
  if (!el.shareList) return;
  const fs = S.account.friends || [];
  el.shareList.innerHTML = fs
    .map(
      (f) =>
        '<button class="mini share-friend" data-act="share-to" data-id="' +
        esc(f.id) +
        '">' +
        esc(f.nick || f.username) +
        '</button>'
    )
    .join('');
  if (el.shareEmpty) el.shareEmpty.classList.toggle('hidden', fs.length > 0);
}

function openSharePop(x, y, noteId) {
  S.shareNoteId = noteId;
  renderShareList();
  const m = el.sharePop;
  if (!m) return;
  m.classList.remove('hidden');
  const r = m.getBoundingClientRect();
  const left = Math.max(8, Math.min(x, window.innerWidth - r.width - 8));
  const top = Math.max(8, Math.min(y, window.innerHeight - r.height - 8));
  m.style.left = left + 'px';
  m.style.top = top + 'px';
  nudgeRect(900);
}

/* 小纸条顶部的好友条：绑过的人一排，点开看和 TA 的咻记录 */
function renderChatPeople() {
  if (!el.chatPeople) return;
  const on = !!S.account.signedIn;
  el.chatPeople.classList.toggle('hidden', !on);
  if (!on) return;
  const friends = S.account.friends || [];
  let html = friends
    .map((f) => {
      const name = f.nick || f.username;
      return (
        '<button class="cp-chip" data-act="cp-friend" data-id="' + esc(f.id) + '" data-name="' + esc(name) + '" title="' + esc('看看和 ' + name + ' 的咻记录') + '">' +
        '<i class="cp-av">' + esc(String(name).slice(0, 1).toUpperCase()) + '</i>' +
        '<span class="cp-name">' + esc(name) + '</span>' +
        '</button>'
      );
    })
    .join('');
  if (!friends.length) {
    html =
      '<button class="cp-chip cp-add" data-act="cp-bind" title="去设置里绑定一个好友">' +
      '<i class="cp-av">+</i><span class="cp-name">绑定好友</span></button>';
  }
  el.cpList.innerHTML = html;
}

function shStamp(ts) {
  const d = new Date(Number(ts) || Date.now());
  const now = new Date();
  const same = d.toDateString() === now.toDateString();
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return same ? pad(d.getHours()) + ':' + pad(d.getMinutes()) : d.getMonth() + 1 + '/' + d.getDate() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function renderShareHist(items, title) {
  el.shTitle.textContent = title;
  if (!items.length) {
    el.shList.innerHTML = '';
    el.shEmpty.classList.remove('hidden');
    return;
  }
  el.shEmpty.classList.add('hidden');
  el.shList.innerHTML = items
    .map((it) => {
      const out = it.dir === 'out';
      const who = it.peer ? it.peer.nick || it.peer.username : '?';
      const kind = it.item && it.item.kind === 'todo' ? '待办' : '备忘录';
      return (
        '<div class="sh-row">' +
        '<i class="sh-dir' + (out ? ' out' : ' inn') + '">' + (out ? '↗' : '↙') + '</i>' +
        '<span class="sh-main"><b>' + esc(who) + '</b><em>' + (out ? '你咻给 TA' : 'TA 咻给你') + ' · ' + kind + '</em>' +
        '<span class="sh-text">' + esc((it.item && it.item.text) || '（空）') + '</span></span>' +
        '<span class="sh-time">' + shStamp(it.createdAt) + '</span>' +
        '</div>'
      );
    })
    .join('');
}

async function openShareHist(peerId, peerName) {
  if (!S.account.signedIn) {
    toast('先在设置里登录，才能看到咻记录');
    return;
  }
  const r = await api.account.shareHistory();
  if (!r || !r.ok) {
    toast('拉咻记录失败：' + ((r && r.message) || '未知原因'), true);
    return;
  }
  const all = Array.isArray(r.items) ? r.items : [];
  const list = peerId ? all.filter((x) => x.peer && x.peer.id === peerId) : all;
  renderShareHist(list, peerId ? '和 ' + (peerName || '好友') + ' 的咻记录' : '全部咻记录');
  const rect = (peerId ? el.cpList : el.cpMore).getBoundingClientRect();
  el.shareHist.classList.remove('hidden');
  const w = el.shareHist.offsetWidth;
  const h = el.shareHist.offsetHeight;
  // 夹在岛的矩形里 —— 外面 .island 是 overflow:hidden，超出会被直接裁掉
  const isl = el.island.getBoundingClientRect();
  const pad = 10;
  const minLeft = isl.left + pad;
  const maxLeft = isl.right - w - pad;
  let left = Math.min(Math.max(minLeft, rect.left), Math.max(minLeft, maxLeft));
  let top = rect.bottom + 6;
  if (top + h > isl.bottom - pad) top = Math.max(isl.top + pad, rect.top - h - 6);
  if (top + h > isl.bottom - pad) top = Math.max(isl.top + pad, isl.bottom - pad - h);
  el.shareHist.style.left = Math.round(left) + 'px';
  el.shareHist.style.top = Math.round(top) + 'px';
  nudgeRect(900);
}

function closeShareHist() {
  if (el.shareHist) el.shareHist.classList.add('hidden');
}

function closeSharePop() {
  if (el.sharePop) el.sharePop.classList.add('hidden');
}

function planeFly(fromEl) {
  try {
    const r = (fromEl || el.noteList).getBoundingClientRect();
    const p = document.createElement('div');
    p.className = 'plane-fly';
    p.innerHTML = '<svg class="ic"><use href="#i-send"/></svg>';
    p.style.left = r.left + r.width / 2 + 'px';
    p.style.top = r.top + r.height / 2 + 'px';
    document.body.appendChild(p);
    requestAnimationFrame(() => {
      p.style.transform =
        'translate(' + Math.round(window.innerWidth * 0.3) + 'px,' + Math.round(-window.innerHeight * 0.34) + 'px) scale(.55) rotate(-16deg)';
      p.style.opacity = '0';
    });
    setTimeout(() => p.remove(), 820);
  } catch (_) {
    /* ignore */
  }
}

async function shareNoteTo(friend, noteId, fromEl) {
  const n = (S.data.notes || []).find((x) => x.id === noteId);
  if (!n) return toast('这条事项已经不在了');
  planeFly(fromEl);
  const text = notePlain(n.text || '').trim();
  const r = await api.account.share({
    toUserId: friend.id,
    kind: n.kind === 'todo' ? 'todo' : 'note',
    text,
    sourceItem: n.id
  });
  if (r && r.ok) toast('咻——已经发给 ' + (friend.nick || friend.username));
  if (r && r.ok) renderChatPeople();
  else toast((r && r.message) || '没发出去');
}

function heartBurst() {
  const cv = el.hearts;
  if (!cv) return;
  const dpr = window.devicePixelRatio || 1;
  const W = window.innerWidth;
  const H = window.innerHeight;
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  cv.style.width = W + 'px';
  cv.style.height = H + 'px';
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cx = W / 2;
  const cy = 34;
  const parts = [];
  for (let i = 0; i < 40; i++) {
    const a = (Math.PI * 2 * i) / 40 + Math.random() * 0.28;
    const sp = 2.1 + Math.random() * 3.4;
    parts.push({
      x: cx,
      y: cy,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp + 0.8,
      size: 1.5 + Math.random() * 2.3,
      hue: 336 + Math.random() * 44
    });
  }
  const t0 = performance.now();
  cv.classList.add('on');
  const frame = (t) => {
    const k = (t - t0) / 900;
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      const life = Math.max(0, 1 - k);
      ctx.globalAlpha = life * 0.92;
      ctx.fillStyle = 'hsl(' + Math.round(p.hue) + ' 92% 64%)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.55 + life * 0.7), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (k < 1) requestAnimationFrame(frame);
    else {
      ctx.clearRect(0, 0, W, H);
      cv.classList.remove('on');
    }
  };
  requestAnimationFrame(frame);
}

async function pollShares() {
  if (!S.account.signedIn || !api.account.shareInbox) return;
  const r = await api.account.shareInbox();
  if (!r || !r.ok) return;
  const items = r.items || [];
  if (!items.length) return;
  for (const it of items) {
    const text = String((it.item && it.item.text) || '');
    const kind = it.item && it.item.kind === 'todo' ? 'todo' : 'note';
    await api.notes.add(text, kind);
    await api.account.shareRead(it.id);
  }
  const first = items[0];
  const who = (first.from && (first.from.nick || first.from.username)) || '好友';
  heartBurst();
  toast(who + ' 咻来 ' + (items.length > 1 ? items.length + ' 条事项' : '一条事项'));
  showPeek({
    icon: '#i-heart',
    title: who + ' 咻来 ' + (items.length > 1 ? items.length + ' 条事项' : '一条事项'),
    sub: String((first.item && first.item.text) || '（空）').slice(0, 42),
    time: '刚刚',
    dur: 7200,
    force: true
  });
  renderNotes();
  nudgeRect(900);
}

function bindAccountUi() {
  if (!el.accLogin) return;
  el.accLogin.addEventListener('click', accDoLogin);
  if (el.accFriendAdd) el.accFriendAdd.addEventListener('click', accAddFriend);
  if (el.accFriendName)
    el.accFriendName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') accAddFriend();
    });
  if (el.accClaimGo) el.accClaimGo.addEventListener('click', accDoClaim);
  if (el.accClaimBackup) el.accClaimBackup.addEventListener('click', accExportBackup);
  if (el.accBackup) el.accBackup.addEventListener('click', accExportBackup);
  el.accRegister.addEventListener('click', accDoRegister);
  el.accPass.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') accDoLogin();
  });
  el.accForgot.addEventListener('click', () => {
    el.accRecover.classList.toggle('hidden');
    el.accRUser.value = el.accUser.value.trim();
    if (!el.accRecover.classList.contains('hidden')) el.accRUser.focus();
  });
  el.accRGo.addEventListener('click', accDoRecover);
  el.accRCancel.addEventListener('click', () => {
    el.accRecover.classList.add('hidden');
    accMsg(el.accRMsg, '');
  });
  el.accCodeOk.addEventListener('change', () => {
    el.accCodeDone.disabled = !el.accCodeOk.checked;
  });
  el.accCodeCopy.addEventListener('click', async () => {
    await api.clips.writeText(S.account.pendingCode || '');
    toast('恢复码已复制，建议存到密码管理器里');
  });
  el.accCodeDone.addEventListener('click', () => {
    if (!el.accCodeOk.checked) return;
    accHideCode();
    toast('好了，恢复码请收好');
  });
  el.accRefresh.addEventListener('click', async () => {
    accBusy(true);
    await accFetchSessions();
    accBusy(false);
    toast('设备列表已刷新');
  });
  el.accSwitch.addEventListener('click', () => {
    S.account.signedIn = false;
    S.account.user = null;
    S.account.sessions = [];
    accPaint();
    el.accUser.focus();
  });
  el.accLogout.addEventListener('click', () => accDoLogout(false));
  if (el.accLogoutBottom) el.accLogoutBottom.addEventListener('click', () => accDoLogout(false));
  if (el.syncNow)
    el.syncNow.addEventListener('click', async () => {
      el.syncNow.disabled = true;
      const r = await api.sync.pull();
      el.syncNow.disabled = false;
      toast(r && r.ok ? '已同步' + (r.changed ? '，更新 ' + r.changed + ' 条' : '') : '同步失败');
      syncPaint();
    });
  el.accLogoutAll.addEventListener('click', () => {
    if (!window.confirm('退出所有设备？其它电脑上的登录会立刻失效。')) return;
    accDoLogout(true);
  });
  el.accDelete.addEventListener('click', () => {
    el.accDel.classList.toggle('hidden');
    if (!el.accDel.classList.contains('hidden')) el.accDUser.value = (S.account.user && S.account.user.username) || '';
  });
  el.accDCancel.addEventListener('click', () => {
    el.accDel.classList.add('hidden');
    accMsg(el.accDMsg, '');
  });
  el.accDGo.addEventListener('click', accDoDelete);
  el.accDevList.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-dev-kick]');
    if (!b) return;
    const id = b.dataset.devKick;
    b.disabled = true;
    const r = await api.account.revokeSession(id);
    b.disabled = false;
    if (r && r.ok) {
      toast('已移除那台设备');
      await accFetchSessions();
    } else {
      toast((r && r.message) || '移除失败');
    }
  });
}

function renderSettings() {
  const st = S.data.settings || {};
  const m = S.data.mail;
  const meta = S.data.meta || {};

  if (!el.setAutoStart.matches(':focus')) el.setAutoStart.checked = !!(st.autoStart || meta.autoStart);
  el.setNotify.checked = !!st.notifyMail;
  el.setClip.checked = !!st.clipEnabled;
  el.setPoll.value = String(st.pollMinutes || 3);

  applyTheme(st.theme);
  applyAccent(st.accent || 'violet');
  accPaint();
  if (el.wxCity && !el.wxCity.matches(':focus')) el.wxCity.value = st.weatherCity || '';
  wxPaint();
  mailAccountLabel.textContent = m.configured ? (m.accounts.length > 1 ? m.accounts.length + ' 个邮箱' : m.label || m.user) : '未连接';
  renderAccounts(m);
  $('#mailDisconnect').classList.toggle('hidden', !S.mailEdit);
  el.appVersion.textContent = meta.version || '1.0.0';

  // 表单只在「正在编辑的账户」变化时回填，避免打断输入
  const editing = S.mailEdit ? (m.accounts || []).find((a) => a.id === S.mailEdit) : null;
  const key = (S.mailEdit || 'new') + '|' + (editing ? editing.user + '|' + editing.host + '|' + editing.port : '');
  if (key !== S.formKey) {
    S.formKey = key;
    if (editing) {
      el.mUser.value = editing.user || '';
      el.mHost.value = editing.host || '';
      el.mPort.value = String(editing.port || 993);
      el.mPass.value = '';
      el.mPass.placeholder = editing.auth === 'oauth' ? '这个邮箱用微软授权，不需要密码' : '已保存，留空则不修改';
      applyProvider(providerOfAccount(editing), false);
      el.msOauthBox.classList.toggle('hidden', editing.auth !== 'oauth');
      if (editing.clientId) el.msClientId.value = editing.clientId;
    } else {
      el.mUser.value = '';
      el.mHost.value = '';
      el.mPort.value = '993';
      el.mPass.value = '';
      el.mPass.placeholder = 'QQ/163 请用授权码';
      applyProvider(S.provider, false);
    }
  }
}

/** 已添加的邮箱列表（多账户） */
function providerOfAccount(a) {
  const meta = (S.data && S.data.meta) || {};
  const list = meta.providers || {};
  const host = String((a && a.host) || '').toLowerCase();
  const hit = Object.keys(list).find((k) => String(list[k].host || '').toLowerCase() === host);
  if (hit) return hit;
  if (/office365|outlook|hotmail/i.test(host)) return 'outlook';
  return 'custom';
}

function renderAccounts(m) {
  const box = el.accList;
  if (!box) return;
  const list = (m && m.accounts) || [];
  if (!list.length) {
    box.innerHTML = '<p class="acc-empty">还没有添加邮箱，先选下面的服务商，填好地址和授权码保存即可。</p>';
    return;
  }
  box.innerHTML = list
    .map((a) => {
      const on = S.mailEdit === a.id ? ' editing' : '';
      const bad = a.error ? ' bad' : '';
      const n = Number(a.unseen) || 0;
      return (
        '<div class="acc-row' + on + bad + '" data-acc="' + esc(a.id) + '">' +
        '<span class="acc-dot ' + (a.mode === 'idle' ? 'on' : a.error ? 'err' : '') + '"></span>' +
        '<span class="acc-main"><b class="acc-name">' + esc(a.label || a.user) + '</b>' +
        '<span class="acc-sub">' + esc(a.user || '') + (a.auth === 'oauth' ? ' · 微软授权' : '') + '</span></span>' +
        (n > 0 ? '<i class="acc-n">' + (n > 99 ? '99+' : n) + '</i>' : '') +
        '<button class="icon-btn acc-edit" data-act="mail-acc-edit" data-acc="' + esc(a.id) + '" title="编辑这个邮箱">' +
        '<svg class="ic"><use href="#i-gear"/></svg></button>' +
        '<button class="icon-btn acc-del" data-act="mail-acc-del" data-acc="' + esc(a.id) + '" title="删除这个邮箱">' +
        '<svg class="ic"><use href="#i-trash"/></svg></button>' +
        '</div>'
      );
    })
    .join('');
}

// 只渲染当前页签，切到别的页再渲染（省内存、也省每次状态广播的重绘）
const RENDERERS = {
  mail: () => renderMail(),
  notes: () => renderNotes(),
  clipboard: () => renderClips(),
  files: () => renderFiles(),
  chat: () => chatRender(),
  tools: () => renderTools(),
  settings: () => renderSettings()
};

function renderTab(name) {
  const fn = RENDERERS[name];
  if (fn) {
    try {
      fn();
    } catch (err) {
      console.warn('[render]', name, err && err.message);
    }
  }
}

function renderAll() {
  if (!S.data) return;
  renderBadges();
  renderTab(S.tab);
}

function applyState(s) {
  if (!s) return;
  const first = !S.data;
  S.data = s;
  // 基调 / 主题色必须在这里就应用：设置页是懒渲染的，只在那里调用的话
  // 不点开设置就一直是深色默认值（浅色主题下 toast 会变成「深底深字」看不见）
  const st = s.settings || {};
  applyTheme(st.theme || 'dark');
  applyAccent(st.accent || 'violet');
  // 小工具卡片的展开状态跟着设置走（换电脑/重装也记得上次展开的是哪一张）
  if (st.toolsOpen && typeof st.toolsOpen === 'object') S.toolsOpen = st.toolsOpen;
  applyToolOpen();
  renderAll();
  if (!first) smsClipCheck(s.clips);
  if (first) {
    positionGlider();
    setTimeout(positionGlider, 200);
    // 恢复上次拖到的位置
    applyShift(Number(st.islandX || 0));
  }
  applyStyle(st.style || 'island');
}

/* ---------------------------------------------------------------- 邮箱表单 */

function applyProvider(id, fill) {
  const meta = (S.data && S.data.meta) || {};
  const p = (meta.providers || {})[id];
  S.provider = id;
  $$('#providers .chip').forEach((c) => c.classList.toggle('active', c.dataset.provider === id));
  if (!p) return;
  if (fill !== false) {
    el.mHost.value = p.host || '';
    el.mPort.value = String(p.port || 993);
  }
  el.mailHint.textContent = p.hint || '';
  // 微软邮箱：切到 Outlook 时露出 OAuth 引导，并隐藏「授权码」输入（改为账户授权）
  const oauthMode = id === 'outlook';
  el.msOauthBox.classList.toggle('hidden', !oauthMode);
  const passField = el.mPass.closest('.field');
  if (passField) passField.classList.toggle('hidden', oauthMode);
  if (oauthMode) {
    const m = (S.data && S.data.mail) || {};
    if (m.clientId && !el.msClientId.value) el.msClientId.value = m.clientId;
  }
}

// ------------------------------------------------------------ 微软 OAuth2 授权
let msPollT = null;
let msUri = 'https://microsoft.com/devicelogin';

function msMsg(text, bad) {
  el.mailTestMsg.textContent = text;
  el.mailTestMsg.classList.remove('hidden', 'ok');
  if (!bad) el.mailTestMsg.classList.add('ok');
}

function msStopPolling(hide) {
  if (msPollT) {
    clearTimeout(msPollT);
    msPollT = null;
  }
  if (hide) el.msCode.classList.add('hidden');
}

async function msStartOauth() {
  const r = await api.mail.oauthStart(el.msClientId.value.trim(), S.mailEdit || '');
  if (!r || !r.ok) {
    let msg = (r && r.message) || '无法开始授权';
    if (/AADSTS700016|AADSTS700038|invalid_client|not a valid application/i.test(msg)) {
      msg = '客户端 ID 不对：请复制 Azure 概览页的「应用程序(客户端) ID」再试';
    }
    toast(msg, true);
    if ((r && r.code === 'no_client_id') || /AADSTS/.test(msg)) el.msGuide.classList.remove('hidden');
    return;
  }
  msUri = r.uri || msUri;
  el.msCode.classList.remove('hidden');
  el.msCodeVal.textContent = r.userCode;
  el.msCodeState.textContent = '等待你在网页里输入…';
  // 面板是滚动区，代码卡片可能在视野外，滚进来
  requestAnimationFrame(() => el.msCode.scrollIntoView({ block: 'nearest' }));
  try {
    await api.clips.writeText(r.userCode);
    toast('代码 ' + r.userCode + ' 已复制，粘贴到打开的网页里');
  } catch (_) {}
  api.app.openExternal(msUri);
  msPoll(r.interval || 5);
}

function msPoll(sec) {
  if (msPollT) clearTimeout(msPollT);
  const wait = Math.max(3, Number(sec) || 5);
  msPollT = setTimeout(async () => {
    const r = await api.mail.oauthPoll();
    if (r && r.ok) {
      msStopPolling(true);
      toast('微软账户已连接：' + (r.account || ''));
      msMsg('已用微软账户登录，正在同步…', false);
      return;
    }
    if (r && r.pending) {
      el.msCodeState.textContent = '还没确认，继续等待…';
      msPoll(wait);
      return;
    }
    msStopPolling(true);
    toast((r && r.message) || '授权失败', true);
    msMsg((r && r.message) || '授权失败', true);
  }, wait * 1000);
}

function mailCfg() {
  const meta = (S.data && S.data.meta) || {};
  const p = (meta.providers || {})[S.provider] || {};
  return {
    id: S.mailEdit || undefined,
    label: p.label || 'IMAP 邮箱',
    user: el.mUser.value.trim(),
    pass: el.mPass.value,
    host: el.mHost.value.trim(),
    port: Number(el.mPort.value) || 993,
    secure: true,
    ...(S.provider === 'outlook'
      ? {
          auth: 'oauth',
          clientId: el.msClientId.value.trim() || (S.data && S.data.mail && S.data.mail.clientId) || ''
        }
      : {})
  };
}

/* ---------------------------------------------------------------- 小工具：计时器 / 免打扰 */
const TIMER_KEY = 'island.timers.v1';
const RING_LEN = 2 * Math.PI * 18.5;

function isDnd() {
  const v = Number((S.data && S.data.settings && S.data.settings.dndUntil) || 0);
  return v === -1 || v > Date.now();
}

function dndRemain() {
  const v = Number((S.data && S.data.settings && S.data.settings.dndUntil) || 0);
  if (v === -1) return -1;
  return Math.max(0, v - Date.now());
}

function fmtShort(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return h + ':' + pad(m);
  return m + ':' + pad(sec);
}

function fmtSpan(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h && m) return h + ' 小时 ' + m + ' 分';
  if (h) return h + ' 小时';
  if (m) return m + ' 分钟';
  return s + ' 秒';
}

function loadTimers() {
  try {
    const raw = JSON.parse(localStorage.getItem(TIMER_KEY) || '[]');
    S.timers = (Array.isArray(raw) ? raw : []).filter((t) => t && t.end > Date.now());
  } catch {
    S.timers = [];
  }
}

function saveTimers() {
  try {
    localStorage.setItem(TIMER_KEY, JSON.stringify(S.timers));
  } catch {
    /* 忽略 */
  }
}

function timerLabel(sec) {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const parts = [];
  if (h) parts.push(h + ' 小时');
  if (m) parts.push(m + ' 分钟');
  if (r || !parts.length) parts.push(r + ' 秒');
  return parts.join(' ');
}

function startTimer(sec) {
  const total = Math.max(1, Math.min(24 * 3600, Math.round(Number(sec) || 0)));
  if (!total) {
    toast('请先填一个时长', true);
    return;
  }
  const t = {
    id: 'tm' + Date.now().toString(36),
    label: timerLabel(total),
    end: Date.now() + total * 1000,
    dur: total * 1000
  };
  S.timers.push(t);
  saveTimers();
  renderTools();
  updateOrb();
  toast('计时开始 · ' + t.label);
}

/** 从时/分/秒三个输入框里取总秒数 */
function timerFromInputs() {
  const h = Math.max(0, Math.min(23, Number(el.timerH && el.timerH.value) || 0));
  const m = Math.max(0, Math.min(59, Number(el.timerM && el.timerM.value) || 0));
  const s = Math.max(0, Math.min(59, Number(el.timerS && el.timerS.value) || 0));
  return h * 3600 + m * 60 + s;
}

function setTimerInputs(sec) {
  const v = Math.max(0, Math.round(Number(sec) || 0));
  if (el.timerH) el.timerH.value = String(Math.floor(v / 3600));
  if (el.timerM) el.timerM.value = String(Math.floor((v % 3600) / 60));
  if (el.timerS) el.timerS.value = String(v % 60);
}

function cancelTimer(id) {
  const t = S.timers.find((x) => x.id === id);
  S.timers = S.timers.filter((x) => x.id !== id);
  saveTimers();
  renderTools();
  updateOrb();
  if (t) toast('已取消「' + t.label + '」');
}

function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [0, 0.24, 0.48].forEach((off, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = i === 2 ? 1046 : 880;
      g.gain.setValueAtTime(0.0001, now + off);
      g.gain.exponentialRampToValueAtTime(0.16, now + off + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + off + 0.18);
      o.connect(g).connect(ctx.destination);
      o.start(now + off);
      o.stop(now + off + 0.2);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {
    /* 静默失败 */
  }
}

function fireTimer(t) {
  api.app.notify({ title: '计时结束', body: t.label + ' 到了', tab: 'tools' });
  beep();
  showPeek({ icon: '#i-timer', title: '计时结束', sub: t.label + ' 到了', dur: 7000, force: true });
  if (el.timerOrb) {
    el.timerOrb.classList.add('ring');
    setTimeout(() => el.timerOrb.classList.remove('ring'), 2600);
  }
}

let timerTickT = 0;

function tickTimers() {
  if (!S.timers.length) return;
  const now = Date.now();
  const done = S.timers.filter((t) => t.end <= now);
  if (done.length) {
    S.timers = S.timers.filter((t) => t.end > now);
    saveTimers();
    done.forEach(fireTimer);
    renderTools();
  }
  updateOrb();
  // 计时面板打开时就地刷新剩余时间（不要整块重绘，否则每 500ms 闪一次）
  if (S.mode === 'panel' && S.tab === 'tools') tickToolsLive();
}

/** 秒级就地更新：只改文本节点，不重建 DOM */
function tickToolsLive() {
  if (el.timerList) {
    const now = Date.now();
    el.timerList.querySelectorAll('.timer-row').forEach((row) => {
      const t = S.timers.find((x) => x.id === row.dataset.id);
      const sub = row.querySelector('.row-sub');
      if (t && sub) sub.textContent = '还剩 ' + fmtShort(t.end - now);
    });
  }
  if (el.dndState && el.setDnd) {
    const on = isDnd();
    el.setDnd.checked = on;
    const r = dndRemain();
    el.dndState.textContent = !on ? '未开启' : r === -1 ? '一直开着' : '还剩 ' + fmtShort(r);
  }
}

function startTimerLoop() {
  if (timerTickT) return;
  timerTickT = setInterval(tickTimers, 500);
}

function updateOrb() {
  const orb = el.timerOrb;
  if (!orb) return;
  const list = S.timers.slice().sort((a, b) => a.end - b.end);
  const t = list[0];
  const vis = !!t;
  if (vis !== S.orbVis) {
    // 卫星圆出现/消失时夹一次位置，别让它顶出屏幕右边
    S.orbVis = vis;
    if (typeof S.islandX === 'number') applyShift(S.islandX);
  }
  if (!t) {
    orb.classList.add('hidden');
    return;
  }
  orb.classList.remove('hidden');
  const left = Math.max(0, t.end - Date.now());
  if (el.timerVal) el.timerVal.textContent = fmtShort(left);
  if (el.timerRing) {
    const frac = t.dur ? Math.min(1, Math.max(0, left / t.dur)) : 0;
    el.timerRing.style.strokeDasharray = String(RING_LEN);
    el.timerRing.style.strokeDashoffset = String(RING_LEN * (1 - frac));
  }
  orb.classList.toggle('urgent', left <= 10000);
  orb.title = t.label + ' · 还剩 ' + fmtShort(left) + (list.length > 1 ? '（另有 ' + (list.length - 1) + ' 个）' : '');
  layoutSats();
}

/* ---------------- 系统状态卫星（左二） ---------------- */

let sysT = 0;

function fmtRate(n) {
  if (!n) return '0 B/s';
  const u = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return (v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)) + ' ' + u[i];
}

function paintSys(s) {
  if (!s || !el.satSys) return;
  S.sys = s;
  el.satSys.classList.remove('hidden');
  if (el.satSysVal) el.satSysVal.textContent = String(s.cpu);
  if (el.satSysRing) {
    const frac = Math.min(1, Math.max(0, (s.mem && s.mem.pct ? s.mem.pct : 0) / 100));
    el.satSysRing.style.strokeDasharray = String(RING_LEN);
    el.satSysRing.style.strokeDashoffset = String(RING_LEN * (1 - frac));
  }
  el.satSys.classList.toggle('warn', s.cpu >= 65 && s.cpu < 88);
  el.satSys.classList.toggle('hot', s.cpu >= 88);
  const bat = s.battery ? ' · 电量 ' + s.battery.pct + '%' + (s.battery.charging ? '⚡' : '') : '';
  el.satSys.title =
    'CPU ' +
    s.cpu +
    '%  ·  内存 ' +
    (s.mem ? s.mem.pct + '%（' + s.text.mem + '）' : '—') +
    '  ·  ↓' +
    fmtRate(s.net.rx) +
    ' ↑' +
    fmtRate(s.net.tx) +
    bat;
  // 小工具页里的系统信息（三条细进度条 + 一行补充）
  if (el.sysRows) {
    const cpuPct = Math.max(0, Math.min(100, Math.round(s.cpu || 0)));
    const memPct = s.mem ? Math.max(0, Math.min(100, Math.round(s.mem.pct))) : 0;
    const cls = (v) => (v >= 88 ? ' hot' : v >= 65 ? ' warn' : '');
    const upH = Math.floor(s.up / 3600);
    const upM = Math.floor((s.up % 3600) / 60);
    el.sysRows.innerHTML =
      sbRow('CPU', cpuPct, cpuPct + '%', cls(cpuPct)) +
      sbRow('内存', memPct, s.mem ? s.mem.pct + '%' : '—', cls(memPct)) +
      (s.battery ? sbRow('电量', Math.round(s.battery.pct), s.battery.pct + '%' + (s.battery.charging ? ' 充' : ''), '') : '') +
      '<div class="sys-meta">' +
      '<span>↓ ' + fmtRate(s.net.rx) + ' · ↑ ' + fmtRate(s.net.tx) + '</span>' +
      '<span>' + (s.mem && s.text ? s.text.mem : '') + '</span>' +
      '<span>已运行 ' + (upH ? upH + ' 小时 ' : '') + upM + ' 分</span>' +
      '</div>';
  }
  if (el.sysSub) {
    el.sysSub.textContent = 'CPU ' + Math.round(s.cpu || 0) + '% · 内存 ' + (s.mem ? Math.round(s.mem.pct) + '%' : '—');
  }
  if (S.sysSatOn !== true) {
    S.sysSatOn = true;
    applyShift(S.islandX || 0);
  }
  layoutSats();
}

function sbRow(k, pct, v, cls) {
  return (
    '<div class="sb-item"><span class="sb-k">' + k + '</span>' +
    '<div class="sb-track"><div class="sb-fill' + (cls || '') + '" style="width:' + pct + '%"></div></div>' +
    '<span class="sb-v">' + v + '</span></div>'
  );
}

async function sysTick() {
  if (S.mode === 'drop') return;
  try {
    const s = await api.app.sysStat();
    paintSys(s);
  } catch (_) {}
}

function startSysLoop() {
  if (sysT) return;
  sysTick();
  sysT = setInterval(sysTick, 3000);
}

function renderTimerRows() {
  if (!el.timerList) return;
  const list = S.timers.slice().sort((a, b) => a.end - b.end);
  if (!list.length) {
    paint(el.timerList, '');
    if (el.timerEmpty) el.timerEmpty.classList.remove('hidden');
    if (el.timerSub) el.timerSub.textContent = '没有在计时';
    return;
  }
  if (el.timerEmpty) el.timerEmpty.classList.add('hidden');
  if (el.timerSub) el.timerSub.textContent = list.length + ' 个计时中';
  paint(
    el.timerList,
    list
      .map((t) => {
        return (
          '<div class="row timer-row" data-id="' + t.id + '">' +
          '<div class="row-main"><div class="row-text">' + esc(t.label) + '</div>' +
          '<div class="row-sub">还剩 ' + esc(fmtShort(t.end - Date.now())) + '</div></div>' +
          '<div class="row-side"><button class="btn ghost small" data-act="timer-cancel" data-id="' + t.id + '">取消</button></div>' +
          '</div>'
        );
      })
      .join('')
  );
}

// M4：待办并进了 Qing事项（renderNotes 里按 kind 渲染），小工具页不再有独立的待办卡
function renderTodos() {
  /* no-op：保留函数名，老的调用点不用改 */
}

function renderTools() {
  renderTimerRows();
  renderTodos();
  renderReminders();
  renderCountdowns();
  updateOrb();
  const on = isDnd();
  if (el.setDnd) el.setDnd.checked = on;
  if (el.dndState) {
    const r = dndRemain();
    el.dndState.textContent = !on ? '未开启' : r === -1 ? '一直开着' : '还剩 ' + fmtShort(r);
  }
  if (el.qDnd) el.qDnd.classList.toggle('hidden', !on);
  if (el.dndHint) {
    el.dndHint.textContent = on
      ? '免打扰进行中：新消息只累加未读数，岛的提示条不会展开。'
      : '免打扰期间：新邮件、新小纸条只累加未读数，岛的提示条不会展开。';
  }
  if (el.dndChips) {
    $$('#dndChips .chip').forEach((c) => c.classList.remove('active'));
  }
  if (el.tabDotTools) el.tabDotTools.classList.toggle('on', S.timers.length > 0 && S.tab !== 'tools');
  renderToolsSummaries();
}

/** 小工具卡片收起时右侧那行小字：邮件 / 短信各自的状态摘要 */
function renderToolsSummaries() {
  const mail = S.data.mail || {};
  const accs = (mail.accounts || []).filter((a) => a && a.user);
  if (el.mailCardSub) {
    el.mailCardSub.textContent = !accs.length
      ? '未配置'
      : (mail.unseen > 0 ? mail.unseen + ' 封未读 · ' : '') + accs.length + ' 个账户';
  }
  if (el.smsCardSub) {
    const devs = (S.smsDev && S.smsDev.items) || [];
    const live = devs.filter((d) => !d.revoked).length;
    const s = S.sms || {};
    el.smsCardSub.textContent = !s.token
      ? '未配置'
      : s.ok
        ? (live ? live + ' 台手机' : '已连接') 
        : '连接中…';
  }
}

function setDnd(minutes) {
  const v = Number(minutes);
  const until = v === 0 ? 0 : v < 0 ? -1 : Date.now() + v * 60000;
  api.settings.save({ dndUntil: until }).then(() => {
    if (!until) toast('已关闭免打扰');
    else if (until === -1) toast('免打扰已开启，直到手动关闭');
    else toast('免打扰 ' + v + ' 分钟');
    renderTools();
  });
}

/* ---------------- 1.10.9 提醒事项 ---------------- */

function renderReminders() {
  if (!el.remList) return;
  const list = (S.data.reminders || []).filter((r) => !r.done);
  if (el.remSub) {
    el.remSub.textContent = list.length + ' 条';
  }
  const html = list.map((r) => {
    const dt = new Date(r.at);
    const past = r.at < Date.now();
    const timeStr = (dt.getMonth() + 1) + '/' + dt.getDate() + ' ' + String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0');
    return '<div class="row rem' + (past ? ' past' : '') + '" data-id="' + r.id + '">' +
      '<div class="row-main"><div class="row-text">' + esc(r.text) + '</div><div class="row-sub">' + timeStr + (past ? ' · 已到点' : '') + '</div></div>' +
      '<div class="row-side"><button class="icon-btn tool" data-act="rem-snooze" data-id="' + r.id + '" title="5 分钟后再提醒"><svg class="ic"><use href="#i-timer"/></svg></button>' +
      '<button class="icon-btn tool" data-act="rem-done" data-id="' + r.id + '" title="完成"><svg class="ic"><use href="#i-check"/></svg></button></div>' +
      '</div>';
  }).join('');
  el.remList.innerHTML = html;
  if (el.remEmpty) el.remEmpty.classList.toggle('hidden', list.length > 0);
}

function addReminderFromInput() {
  const text = (el.remText.value || '').trim();
  if (!text) { toast('先写一句要提醒你的事'); return; }
  const quick = el.remQuick.value;
  let at = 0;
  if (quick && quick !== 'custom') {
    at = Date.now() + Number(quick) * 60000;
  } else {
    const v = el.remAt.value;
    if (!v) { toast('选个时间，或点上面的快捷选项'); return; }
    at = new Date(v).getTime();
  }
  api.reminders.add({ text, at }).then((r) => {
    if (r.ok) {
      el.remText.value = '';
      el.remQuick.value = '';
      el.remAt.value = '';
      toast('已记下，到点会抖');
      renderTools();
    } else {
      toast(r.message || '添加失败');
    }
  });
}

/* ---------------- 1.10.9 倒数日 ---------------- */

function nextPayday(day) {
  if (!day) return null;
  const now = new Date();
  let y = now.getFullYear(), m = now.getMonth();
  let d = new Date(y, m, day);
  if (d < now) d = new Date(y, m + 1, day);
  return d;
}

function nextAnniversary(a) {
  const [Y, M, D] = a.date.split('-').map(Number);
  const now = new Date();
  if (a.repeat === 'once') {
    const d = new Date(Y, M - 1, D);
    return d >= new Date(now.getFullYear(), now.getMonth(), now.getDate()) ? d : null;
  }
  let y = now.getFullYear();
  let d = new Date(y, M - 1, D);
  if (d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) d = new Date(y + 1, M - 1, D);
  return d;
}

function daysTo(d) {
  if (!d) return null;
  const now = new Date();
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((b - a) / 86400000);
}

function renderCountdowns() {
  if (!el.cdList) return;
  const cd = S.data.countdowns || { payday: 0, anniversaries: [] };

  // 发薪日下拉框（只填一次）
  if (el.cdPayday && el.cdPayday.options.length <= 1) {
    for (let d = 1; d <= 31; d++) {
      const o = document.createElement('option');
      o.value = String(d);
      o.textContent = '每月 ' + d + ' 号';
      el.cdPayday.appendChild(o);
    }
  }
  if (el.cdPayday) el.cdPayday.value = String(cd.payday || 0);

  const pd = cd.payday ? nextPayday(cd.payday) : null;
  const pdDays = pd ? daysTo(pd) : null;
  if (el.cdPaydayNext) {
    el.cdPaydayNext.textContent = !cd.payday ? '' :
      pdDays === 0 ? '今天发！' : '还有 ' + pdDays + ' 天';
  }

  // 节假日（下一个最近的中国法定假日）
  const nextHoliday = nextChineseHoliday();
  // 纪念日列表
  const items = (cd.anniversaries || []).map((a) => {
    const d = nextAnniversary(a);
    const days = daysTo(d);
    const when = d ? (d.getMonth() + 1) + '/' + d.getDate() : '';
    const badge = days === 0 ? '今天！' : days === null ? '已过' : '还有 ' + days + ' 天';
    return '<div class="row cd-item" data-id="' + a.id + '">' +
      '<div class="row-main"><div class="row-text">' + esc(a.name) + '</div><div class="row-sub">' + when + (a.repeat === 'once' ? ' · 一次性' : ' · 每年') + '</div></div>' +
      '<div class="row-side"><span class="cd-badge' + (days === 0 ? ' hot' : '') + '">' + badge + '</span>' +
      '<button class="icon-btn tool" data-act="cd-del" data-id="' + a.id + '" title="删掉"><svg class="ic"><use href="#i-x"/></svg></button></div>' +
      '</div>';
  });

  let html = '';
  if (cd.payday && pdDays !== null) {
    html += '<div class="row cd-item cd-static"><div class="row-main"><div class="row-text">发薪日</div><div class="row-sub">每月 ' + cd.payday + ' 号</div></div><div class="row-side"><span class="cd-badge' + (pdDays === 0 ? ' hot' : '') + '">' + (pdDays === 0 ? '今天发！' : '还有 ' + pdDays + ' 天') + '</span></div></div>';
  }
  if (nextHoliday) {
    html += '<div class="row cd-item cd-static"><div class="row-main"><div class="row-text">' + nextHoliday.name + '</div><div class="row-sub">法定假日</div></div><div class="row-side"><span class="cd-badge' + (nextHoliday.days === 0 ? ' hot' : '') + '">' + (nextHoliday.days === 0 ? '今天！' : '还有 ' + nextHoliday.days + ' 天') + '</span></div></div>';
  }
  html += items.join('');
  el.cdList.innerHTML = html;

  const n = (cd.payday ? 1 : 0) + (nextHoliday ? 1 : 0) + (cd.anniversaries || []).length;
  if (el.cdSub) el.cdSub.textContent = n + ' 个日子';
}

/** 下一个中国法定节假日（阳历 + 农历都用，跟 idle 行的 festivalOf 同一套表） */
function nextChineseHoliday() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const HOLIDAYS = ['春节', '劳动节', '国庆节', '元旦', '清明节', '端午节', '中秋节'];
  let best = null;
  for (let off = 0; off <= 400; off++) {
    const d = new Date(today.getTime() + off * 86400000);
    const f = (typeof festivalOf === 'function') ? festivalOf(d) : '';
    if (f && HOLIDAYS.includes(f)) {
      best = { name: f, date: d, days: off };
      break;
    }
  }
  return best;
}

function addCountdownFromInput() {
  const name = (el.cdName.value || '').trim();
  const date = el.cdDate.value;
  const repeat = el.cdRepeat.value || 'yearly';
  if (!name) { toast('写个名字，如「老婆生日」'); return; }
  if (!date) { toast('选个日期'); return; }
  api.countdowns.addAnniversary({ name, date, repeat }).then((r) => {
    if (r.ok) {
      el.cdName.value = '';
      el.cdDate.value = '';
      toast('加好了');
      renderTools();
    } else {
      toast(r.message || '添加失败');
    }
  });
}

/* ---------------- 小工具卡片：一次只展开一个 ---------------- */

function applyToolOpen() {
  const map = S.toolsOpen || {};
  $$('.tool-card').forEach((c) => c.classList.toggle('open', !!map[c.dataset.tool]));
}

function toggleTool(name) {
  const wasOpen = !!(S.toolsOpen || {})[name];
  S.toolsOpen = wasOpen ? {} : { [name]: true };
  applyToolOpen();
  nudgeRect(900);
  api.settings.save({ toolsOpen: S.toolsOpen }).catch(() => {});
  if (!wasOpen) {
    if (name === 'dev') devToolsRedraw();
    if (name === 'sys') sysTick();
  }
}

// 大段内容不要留在 textarea 里：浏览器每帧都要为它重排，几千行就够把动画拖成 PPT
function dvPayload() {
  const typed = el.dvIn ? el.dvIn.value : '';
  return typed.trim() ? typed : S.dvSrc;
}

function dvPaintSrc() {
  if (!el.dvSrcBar) return;
  const on = !!S.dvSrc;
  el.dvSrcBar.classList.toggle('hidden', !on);
  if (on && el.dvSrcText) el.dvSrcText.textContent = S.dvSrcNote || ('已读入 ' + humanSize(S.dvSrc.length));
}

function dvSetSrc(text, note) {
  S.dvSrc = text || '';
  S.dvSrcNote = note || '';
  if (el.dvIn) el.dvIn.value = '';
  dvPaintSrc();
}

function dvClearSrc() {
  S.dvSrc = '';
  S.dvSrcNote = '';
  if (el.dvIn) el.dvIn.value = '';
  dvPaintSrc();
}

/* ---------------- 开发小工具 ---------------- */

const DV_ACTS = {
  ts: [
    { k: 'ts2date', t: '时间戳 → 日期' },
    { k: 'date2ts', t: '日期 → 时间戳' }
  ],
  b64: [
    { k: 'b64enc', t: '文字 → Base64' },
    { k: 'b64dec', t: 'Base64 → 文字/图片' },
    { k: 'b64img', t: '选图片…' }
  ],
  json: [
    { k: 'jsonfmt', t: '格式化' },
    { k: 'jsonmin', t: '压缩' }
  ],
  uuid: [
    { k: 'uuid1', t: '生成 1 个' },
    { k: 'uuid5', t: '生成 5 个' }
  ],
  hash: [
    { k: 'sha1', t: 'SHA-1' },
    { k: 'sha256', t: 'SHA-256' },
    { k: 'sha512', t: 'SHA-512' }
  ],
  rand: [
    { k: 'coin', t: '🪙 抛硬币' },
    { k: 'dice', t: '🎲 掷骰子' },
    { k: 'range', t: '1–100' },
    { k: 'pick', t: '抽签（每行一个选项）' }
  ]
};

const DV_TIPS = {
  ts: '粘 10 位（秒）或 13 位（毫秒）时间戳，也可以粘日期',
  b64: '粘要编码或解码的文字（UTF-8）',
  json: '粘一段 JSON，回车前先粘贴',
  uuid: '不用输入，直接点生成',
  hash: '粘要算哈希的文字',
  rand: '抽签：在输入框里每行写一个选项，点「抽签」随机挑一个'
};

function dvPaint() {
  if (!el.dvOutWrap) return;
  const full = S.dvOut || '';
  el.dvOutWrap.classList.toggle('hidden', !full);
  const shown = full.length > B64_VIEW_MAX
    ? full.slice(0, B64_VIEW_MAX) + '\n…（共 ' + full.length + ' 字符，这里只显示前 ' + B64_VIEW_MAX + ' 个避免卡顿；点「复制」拿到的是完整内容）'
    : full;
  if (el.dvOut) el.dvOut.value = shown;
  if (el.dvSave) el.dvSave.classList.toggle('hidden', !S.dvImgBlob);
  if (el.dvSrcBar) {
    el.dvSrcBar.classList.toggle('hidden', !S.dvSrc);
    if (S.dvSrc && el.dvSrcText) el.dvSrcText.textContent = S.dvSrcNote || ('已读入 ' + humanSize(S.dvSrc.length));
  }
  if (el.devSub) {
    const t = ((el.dvIn && el.dvIn.value.trim().length) || 0) + (S.dvSrc ? S.dvSrc.length : 0);
    el.devSub.textContent = t ? t + ' 字符 · ' + (S.dvTab === 'ts' ? '时间戳' : S.dvTab === 'b64' ? 'Base64' : S.dvTab === 'json' ? 'JSON' : S.dvTab === 'uuid' ? 'UUID' : '哈希') : '时间戳 · Base64 · JSON · UUID · 哈希';
  }
}

function devToolsRedraw() {
  if (!el.dvActs) return;
  $$('#dvTabs .dv-tab').forEach((b) => b.classList.toggle('active', b.dataset.dv === S.dvTab));
  el.dvActs.innerHTML = (DV_ACTS[S.dvTab] || [])
    .map((a) => '<button class="chip" data-dv-act="' + a.k + '">' + a.t + '</button>')
    .join('');
  if (el.dvIn) el.dvIn.placeholder = DV_TIPS[S.dvTab] || '';
  dvPaint();
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function fmtDateTime(d) {
  return (
    d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' +
    pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds())
  );
}

/* ── Base64：图片 ⇄ 文本（带尺寸与内存保护） ───────────────────── */
const B64_VIEW_MAX = 20000;
const B64_INLINE_MAX = 200000; // 超过这个长度就不放进 textarea（留在内存里），否则每帧重排会卡死 // 输出框最多渲染这么多字符，再长只显示摘要（完整内容仍在 S.dvOut 里，可复制）
const B64_IN_MAX = 8 * 1024 * 1024; // 单次解码上限 8 MB 字符，超过直接提示

function b64Clean(src) {
  let t = String(src || '').replace(/\s+/g, '');
  let mime = '';
  const m = t.match(/^data:([a-z0-9.+-]+\/[a-z0-9.+-]+)?;base64,(.*)$/i);
  if (m) {
    mime = (m[1] || '').toLowerCase();
    t = m[2];
  }
  t = t.replace(/-/g, '+').replace(/_/g, '/');
  const bad = t.search(/[^A-Za-z0-9+/=]/);
  if (bad >= 0) {
    const e = new Error('第 ' + (bad + 1) + ' 个字符「' + t[bad] + '」不是 Base64 字符（换行和空格会被自动忽略）');
    e.code = 'badchar';
    throw e;
  }
  t = t.replace(/=+$/, '');
  const rest = t.length % 4;
  if (rest === 1) throw new Error('长度不对：去掉换行后剩 ' + t.length + ' 个字符，Base64 的有效长度不能是 4n+1');
  if (rest) t += '='.repeat(4 - rest);
  return { b64: t, mime };
}

function b64Bytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function sniffImage(b) {
  if (b.length < 4) return '';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  if (b[0] === 0x42 && b[1] === 0x4d) return 'image/bmp';
  const head = new TextDecoder('utf-8', { fatal: false }).decode(b.slice(0, 400)).trim();
  if (/^<svg[\s>]/i.test(head) || (/^<\?xml/i.test(head) && /<svg[\s>]/i.test(head))) return 'image/svg+xml';
  return '';
}

function humanSize(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
}

function dvClearImage() {
  if (S.dvImgUrl) {
    try { URL.revokeObjectURL(S.dvImgUrl); } catch (_) {}
  }
  S.dvImgUrl = '';
  S.dvImgBlob = null;
  S.dvImgName = '';
  if (el.dvImgWrap) el.dvImgWrap.classList.add('hidden');
  if (el.dvImg) el.dvImg.removeAttribute('src');
  if (el.dvSave) el.dvSave.classList.add('hidden');
}

function dvShowImage(blob, name) {
  dvClearImage();
  S.dvImgBlob = blob;
  S.dvImgName = name || 'image';
  S.dvImgUrl = URL.createObjectURL(blob);
  el.dvImg.src = S.dvImgUrl;
  el.dvImgWrap.classList.remove('hidden');
  el.dvSave.classList.remove('hidden');
  el.dvImgMeta.textContent = (name || '图片') + ' · ' + humanSize(blob.size);
  el.dvImg.onload = () => {
    el.dvImgMeta.textContent = (name || '图片') + ' · ' + el.dvImg.naturalWidth + '×' + el.dvImg.naturalHeight + ' · ' + humanSize(blob.size);
    el.dvImg.dataset.ok = '1';
  };
  el.dvImg.onerror = () => {
    el.dvImgMeta.textContent = (name || '图片') + ' · ' + humanSize(blob.size) + ' · 数据不完整，显示不出来';
    el.dvImg.dataset.ok = '0';
  };
}

function dvImageToB64(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('这张图读不出来'));
    fr.onload = () => resolve(String(fr.result || ''));
    fr.readAsDataURL(file);
  });
}

async function dvRunImage(file) {
  if (!file) return;
  if (file.size > 6 * 1024 * 1024) {
    S.dvOut = '这张图 ' + humanSize(file.size) + '，太大了。超过 6 MB 的图转成 Base64 会明显卡顿，先压缩一下再试。';
    dvPaint();
    return;
  }
  S.dvOut = '正在读这张图…';
  dvPaint();
  await new Promise((r) => setTimeout(r, 30));
  try {
    const dataUrl = await dvImageToB64(file);
    dvShowImage(file, file.name);
    S.dvOut = dataUrl;
    dvPaint();
    toast('已转成 Base64（' + humanSize(dataUrl.length) + ' 字符）');
  } catch (e) {
    S.dvOut = '出错了：' + ((e && e.message) || e);
    dvPaint();
  }
}

async function dvRun(kind) {
  let raw = (dvPayload() || '').trim();
  // 一大段内容留在 textarea 里，输入和滚动都会整段重排 —— 超过 20 万字符就搬进内存
  if (el.dvIn && el.dvIn.value && el.dvIn.value.length > B64_INLINE_MAX) {
    dvSetSrc(
      raw,
      '已读入 ' + humanSize(raw.length) + '（' + (kind.startsWith('b64') ? 'Base64' : '文本') + '，不放进输入框，避免卡顿）'
    );
    raw = (S.dvSrc || '').trim();
  }
  const out = (s) => {
    S.dvOut = s;
    dvPaint();
  };
  try {
    switch (kind) {
      case 'ts2date': {
        if (!raw) return out('');
        let ms;
        if (/^\d{13}$/.test(raw)) ms = Number(raw);
        else if (/^\d{10}$/.test(raw)) ms = Number(raw) * 1000;
        else {
          const d = new Date(raw);
          if (isNaN(d.getTime())) return out('认不出这个时间戳');
          ms = d.getTime();
        }
        return out(fmtDateTime(new Date(ms)));
      }
      case 'date2ts': {
        if (/^\d{10,13}$/.test(raw)) return out('这串已经是时间戳了，先换成日期再往回点');
        const d = new Date(raw || Date.now());
        if (isNaN(d.getTime())) return out('认不出这个日期');
        return out(Math.floor(d.getTime() / 1000) + '\n' + d.getTime());
      }
      case 'b64img': {
        if (el.dvFile) el.dvFile.click();
        return;
      }
      case 'b64enc': {
        if (!raw) return out('');
        if (raw.length > 2 * 1024 * 1024) {
          return out('这段内容 ' + humanSize(raw.length) + '，太长了：编码会占好几倍内存。要转图片请点「图片转 Base64」。');
        }
        const bytes = new TextEncoder().encode(raw);
        let bin = '';
        const CH = 0x8000;
        for (let i = 0; i < bytes.length; i += CH) {
          bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
        }
        return out(btoa(bin));
      }
      case 'b64dec': {
        dvClearImage();
        if (!raw) return out('');
        if (raw.length > B64_IN_MAX) {
          return out('这串有 ' + humanSize(raw.length) + '，超过单次解码上限 8 MB。\n大图建议直接点「选图片」读文件，不要把它粘进输入框。');
        }
        out('正在解码…');
        await new Promise((r) => setTimeout(r, 20));
        const { b64, mime } = b64Clean(raw);
        const bytes = b64Bytes(b64);
        if (!bytes.length) return out('解出来是空的');
        const sniff = sniffImage(bytes) || (mime.startsWith('image/') ? mime : '');
        if (sniff) {
          const blob = new Blob([bytes], { type: sniff });
          const ext = sniff.split('/')[1].replace('svg+xml', 'svg').replace('jpeg', 'jpg');
          dvShowImage(blob, 'decoded.' + ext);
          await new Promise((r) => setTimeout(r, 120));
          if (el.dvImg && el.dvImg.dataset.ok === '0') {
            dvClearImage();
            return out('这串 Base64 开头像 ' + sniff + '，但数据不完整（' + humanSize(bytes.length) + '），图片显示不出来。\n多半是从中间截断了：让发的人重新复制完整的一串，或者直接发图片文件。');
          }
          return out('识别成图片（' + sniff + '，' + humanSize(bytes.length) + '）\n上面就是预览；要存文件点「另存为」，要贴到别处点「复制」拿原始 Base64。');
        }
        const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
        const bad = (text.match(/\uFFFD/g) || []).length;
        if (bad > text.length * 0.2) {
          const head = Array.from(bytes.slice(0, 24)).map((x) => x.toString(16).padStart(2, '0')).join(' ');
          return out('解出来不是文字（' + humanSize(bytes.length) + ' 个字节，前 24 字节：' + head + '）。\n可能是图片、压缩包或加密数据。');
        }
        S.dvOut = text;
        dvPaint();
        return;
      }
      case 'jsonfmt':
        return out(JSON.stringify(JSON.parse(raw), null, 2));
      case 'jsonmin':
        return out(JSON.stringify(JSON.parse(raw)));
      case 'uuid1':
        return out(crypto.randomUUID());
      case 'uuid5':
        return out(Array.from({ length: 5 }, () => crypto.randomUUID()).join('\n'));
      case 'sha1':
      case 'sha256':
      case 'sha512': {
        if (!raw) return out('');
        const alg = kind === 'sha1' ? 'SHA-1' : kind === 'sha256' ? 'SHA-256' : 'SHA-512';
        const buf = await crypto.subtle.digest(alg, new TextEncoder().encode(raw));
        return out(
          Array.from(new Uint8Array(buf))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('')
        );
      }
      case 'coin':
        return out(Math.random() < 0.5 ? '🪙 正面' : '🪙 反面');
      case 'dice':
        return out('🎲 ' + (1 + Math.floor(Math.random() * 6)));
      case 'range':
        return out(String(1 + Math.floor(Math.random() * 100)));
      case 'pick': {
        const opts = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
        if (!opts.length) return out('先在输入框里写几个选项（每行一个）');
        return out('👉 ' + opts[Math.floor(Math.random() * opts.length)]);
      }
      default:
        return out('');
    }
  } catch (e) {
    out('出错了：' + ((e && e.message) || e));
  }
}

/* ---------------- 天气（IP 定位，可手动填城市） ---------------- */

const WX_KEY = 'island.weather.v1';
const WX_TTL = 30 * 60000;
const WX_CODES = {
  0: '晴', 1: '晴间多云', 2: '多云', 3: '阴', 45: '雾', 48: '雾凇',
  51: '小毛毛雨', 53: '毛毛雨', 55: '密毛毛雨', 56: '冻毛毛雨', 57: '冻毛毛雨',
  61: '小雨', 63: '中雨', 65: '大雨', 66: '冻雨', 67: '冻雨',
  71: '小雪', 73: '中雪', 75: '大雪', 77: '米雪',
  80: '阵雨', 81: '强阵雨', 82: '暴雨', 85: '阵雪', 86: '强阵雪',
  95: '雷阵雨', 96: '雷阵雨伴冰雹', 99: '强雷暴伴冰雹'
};

function wxCached() {
  try {
    return JSON.parse(localStorage.getItem(WX_KEY) || 'null');
  } catch (_) {
    return null;
  }
}

function wxText(w) {
  if (!w) return '';
  const t = WX_CODES[w.code] || '';
  return t ? w.temp + '° ' + t : w.temp + '°';
}

/* 公网 IP → 坐标。三个免费接口同时问，城市名少数服从多数：
   单个库偶尔会把同一个 IP 认到隔壁城市（实测把天津认成北京），
   多问两家能把它纠正过来。ipapi.co 被 Cloudflare 挡，不要用。 */
async function wxGeo() {
  const list = [
    {
      url: 'https://ipwho.is/',
      pick: (j) => (j && j.success !== false && j.latitude ? { lat: +j.latitude, lon: +j.longitude, city: j.city || j.region } : null)
    },
    {
      url: 'https://ipinfo.io/json',
      pick: (j) => {
        const parts = String((j && j.loc) || '').split(',');
        return parts.length === 2 ? { lat: +parts[0], lon: +parts[1], city: j.city || j.region } : null;
      }
    },
    {
      url: 'https://api.ip.sb/geoip',
      pick: (j) => (j && j.latitude ? { lat: +j.latitude, lon: +j.longitude, city: j.city || j.region } : null)
    }
  ];
  const hits = (
    await Promise.all(
      list.map(async (t) => {
        try {
          const j = await fetch(t.url, { signal: AbortSignal.timeout(7000) }).then((r) => r.json());
          const h = t.pick(j);
          return h && h.lat && h.lon ? h : null;
        } catch (_) {
          return null;
        }
      })
    )
  ).filter(Boolean);
  if (!hits.length) return null;
  const votes = new Map();
  hits.forEach((h) => {
    const k = String(h.city || '').toLowerCase();
    votes.set(k, (votes.get(k) || 0) + 1);
  });
  let best = hits[0];
  let bestN = 0;
  hits.forEach((h) => {
    const n = votes.get(String(h.city || '').toLowerCase()) || 0;
    if (n > bestN) {
      bestN = n;
      best = h;
    }
  });
  return best;
}

/* 英文城市名换成中文（坐标要在附近才算同一个地方） */
async function wxZhName(city, lat, lon) {
  if (!city) return '';
  if (/[\u4e00-\u9fa5]/.test(city)) return city;
  try {
    const g = await fetch(
      'https://geocoding-api.open-meteo.com/v1/search?count=1&language=zh&format=json&name=' + encodeURIComponent(city),
      { signal: AbortSignal.timeout(7000) }
    ).then((r) => r.json());
    const hit = (g.results || [])[0];
    if (hit && Math.abs(hit.latitude - lat) < 0.9 && Math.abs(hit.longitude - lon) < 0.9) return hit.name || city;
  } catch (_) {}
  return city;
}

async function wxLoad(force) {
  const st = (S.data && S.data.settings) || {};
  const cached = wxCached();
  if (!force && cached && Date.now() - cached.t < WX_TTL) {
    S.wx = cached;
    wxPaint();
    return;
  }
  try {
    let lat = cached && cached.lat;
    let lon = cached && cached.lon;
    let city = String(st.weatherCity || '').trim();
    if (city) {
      const g = await fetch(
        'https://geocoding-api.open-meteo.com/v1/search?count=1&language=zh&format=json&name=' + encodeURIComponent(city),
        { signal: AbortSignal.timeout(9000) }
      ).then((r) => r.json());
      const hit = (g.results || [])[0];
      if (!hit) {
        wxPaint('找不到这个城市');
        return;
      }
      lat = hit.latitude;
      lon = hit.longitude;
      city = hit.name || city;
    } else if (!lat || !lon) {
      const geo = await wxGeo();
      if (!geo) {
        wxPaint('定位失败，可以手动填城市');
        return;
      }
      lat = geo.lat;
      lon = geo.lon;
      city = await wxZhName(geo.city, lat, lon);
    }
    if (!lat || !lon) {
      wxPaint('定位失败，可以手动填城市');
      return;
    }
    const w = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
        '&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1',
      { signal: AbortSignal.timeout(9000) }
    ).then((r) => r.json());
    const cur = w.current || {};
    const daily = w.daily || {};
    S.wx = {
      t: Date.now(),
      city,
      lat,
      lon,
      temp: Math.round(cur.temperature_2m),
      code: cur.weather_code,
      max: Math.round((daily.temperature_2m_max || [])[0]),
      min: Math.round((daily.temperature_2m_min || [])[0])
    };
    localStorage.setItem(WX_KEY, JSON.stringify(S.wx));
    wxPaint();
  } catch (e) {
    wxPaint('天气暂时拿不到');
  }
}

function wxPaint(err) {
  const w = S.wx;
  if (el.wxSub) {
    el.wxSub.textContent = err
      ? err
      : w
        ? (w.city ? w.city + ' · ' : '') + wxText(w) + (w.min != null && w.max != null ? ' · ' + w.min + '°~' + w.max + '°' : '')
        : '还没获取';
  }
  if (S.idleSubText !== undefined) renderIdleSub();
}

/* ---------------------------------------------------------------- 交互 */

/* 两段式确认，避免误点清空 */
function confirmThen(key, hint) {
  if (S.confirmKey === key && Date.now() < S.confirmT) {
    S.confirmKey = '';
    return true;
  }
  S.confirmKey = key;
  S.confirmT = Date.now() + 3500;
  toast(hint);
  return false;
}

async function clearNotes() {
  const list = S.data.notes || [];
  if (!list.length) return toast('没有便笺可删');
  const pinned = list.filter((n) => n.pinned).length;
  const open = list.filter((n) => n.kind === 'todo' && !n.done && !n.pinned).length;
  const keepHint = [
    pinned ? '钉在桌面 ' + pinned + ' 条' : '',
    open ? '没做完的待办 ' + open + ' 条' : ''
  ].filter(Boolean).join('、');
  if (!confirmThen('notes-clear', '再点一次「全部删除」' + (keepHint ? '（' + keepHint + '会保留）' : ''))) return;
  const r = await api.notes.clear();
  toast('已删除 ' + ((r && r.removed) || 0) + ' 条' + (r && r.kept ? '，保留 ' + r.kept + ' 条' : ''));
}

async function clearClips() {
  const list = S.data.clips || [];
  if (!list.length) return toast('剪贴板已经是空的');
  const pinned = list.filter((c) => c.pinned).length;
  if (!confirmThen('clips-clear', '再点一次「全部删除」' + (pinned ? '（固定的 ' + pinned + ' 条会保留）' : ''))) return;
  const r = await api.clips.clear();
  toast('已删除 ' + ((r && r.removed) || 0) + ' 条记录' + (r && r.kept ? '，固定 ' + r.kept + ' 条已保留' : ''));
}

/* 便笺 / 剪贴板一键发到当前小纸条频道 */
async function sendToChat({ text, dataUrl, thumb, clipId, label }) {
  const room = curRoom();
  if (!room) {
    toast('还没有加入小纸条，先新建一个频道', true);
    openPanel('chat');
    return false;
  }
  let img = thumb || dataUrl;
  // 剪贴板图片走 IPC 取 dataURL：自定义协议在渲染层 fetch 会被跨域拦掉（之前就是这个原因导致点了没反应）
  if (!img && clipId) {
    const r = await api.clips.data(clipId);
    if (r && r.ok) img = r.dataUrl;
    else {
      toast('读取这张图片失败：' + ((r && r.message) || '未知原因'), true);
      return false;
    }
  }
  try {
    if (img) {
      // data: URL 用 atob 自己解码，别走 fetch —— CSP 的 connect-src 不允许 data:，fetch 会直接失败
      let blob;
      if (/^data:/i.test(img)) {
        const comma = img.indexOf(',');
        const meta = img.slice(5, comma);
        const mime = (meta.split(';')[0] || 'image/png').trim();
        const bin = atob(img.slice(comma + 1));
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        blob = new Blob([bytes], { type: mime });
      } else {
        blob = await (await fetch(img)).blob();
      }
      const file = new File([blob], 'clip.png', { type: blob.type || 'image/png' });
      const ok = await chatSendFile(file);
      if (ok) toast((label || '图片') + '已发送到「' + roomName(room) + '」');
      else toast('发送失败，换个图片再试', true);
      return ok;
    }
    const body = String(text || '');
    if (!body.trim()) {
      toast('这条内容没有可发送的文字', true);
      return false;
    }
    const ok = await chatPost('text', body);
    if (ok) toast((label || '内容') + '已发送到「' + roomName(room) + '」');
    else toast('发送失败，检查一下网络', true);
    return ok;
  } catch (err) {
    toast('发送失败：' + String((err && err.message) || err), true);
    return false;
  }
}

/* ---------------------------------------------------------------- 图片预览遮罩 */

let lbUrl = '';

/* ---- 大图缩放 / 拖动 ---- */
const LB_MIN = 0.4;
const LB_MAX = 8;
const lb = { z: 1, x: 0, y: 0, drag: null };

function lbApply() {
  if (!el.lbImg) return;
  el.lbImg.style.transform = 'translate(' + lb.x + 'px,' + lb.y + 'px) scale(' + lb.z + ')';
  if (el.lbZoom) el.lbZoom.textContent = Math.round(lb.z * 100) + '%';
  el.lbImg.classList.toggle('zoomed', lb.z > 1.02);
  el.lbImg.classList.toggle('dragging', !!lb.drag);
}

function lbReset() {
  lb.z = 1;
  lb.x = 0;
  lb.y = 0;
  lb.drag = null;
  lbApply();
}

/** 以鼠标位置为锚点缩放（滚轮） */
function lbZoomAt(clientX, clientY, factor) {
  const stage = el.lbStage;
  if (!stage) return;
  const r = stage.getBoundingClientRect();
  const cx = clientX - (r.left + r.width / 2);
  const cy = clientY - (r.top + r.height / 2);
  const next = Math.min(LB_MAX, Math.max(LB_MIN, lb.z * factor));
  if (Math.abs(next - lb.z) < 0.001) return;
  const k = next / lb.z;
  lb.x = cx - (cx - lb.x) * k;
  lb.y = cy - (cy - lb.y) * k;
  lb.z = next;
  lbApply();
}

async function openLightbox(url) {
  if (!url) return;
  lbUrl = url;
  lbReset();
  el.lbImg.src = url;
  el.lbImg.alt = '图片预览';
  let name = '图片';
  try {
    name = decodeURIComponent(url.split('/').pop() || '图片');
  } catch (_) {
    name = url.split('/').pop() || '图片';
  }
  el.lbName.textContent = name;
  el.lbMenu.classList.add('hidden');
  el.lightbox.classList.remove('hidden');
  el.stage.classList.add('lb-open');
  // 窗口放大成整屏，遮罩才铺得开
  try {
    await api.app.mask(true);
  } catch (_) {}
  S.grace = Date.now() + 600000;
}

async function closeLightbox() {
  if (el.lightbox.classList.contains('hidden')) return;
  el.lightbox.classList.add('hidden');
  el.lbMenu.classList.add('hidden');
  el.stage.classList.remove('lb-open');
  el.lbImg.removeAttribute('src');
  lbUrl = '';
  lbReset();
  try {
    await api.app.mask(false);
  } catch (_) {}
}

/* ------------------------------------------------- 备忘录右键菜单 */
function openNoteMenu(x, y, noteId) {
  const m = el.noteMenu;
  if (!m || !noteId) return;
  const n = (S.data.notes || []).find((v) => v.id === noteId);
  if (!n) return;
  m.dataset.id = noteId;
  const pinBtn = m.querySelector('[data-act="note-menu-pin"]');
  if (pinBtn) pinBtn.textContent = n.pinned ? '取消钉在桌面' : '钉到桌面';
  m.classList.remove('hidden');
  const w = m.offsetWidth || 140;
  const h = m.offsetHeight || 150;
  m.style.left = Math.min(Math.max(6, x), window.innerWidth - w - 8) + 'px';
  m.style.top = Math.min(Math.max(6, y), window.innerHeight - h - 8) + 'px';
  nudgeRect(900);
}

function closeNoteMenu() {
  if (!el.noteMenu || el.noteMenu.classList.contains('hidden')) return;
  el.noteMenu.classList.add('hidden');
  el.noteMenu.dataset.id = '';
}

/* ------------------------------------------------- 编辑框右键菜单（剪切/复制/粘贴） */
function openEditMenu(x, y, kind) {
  const m = el.editMenu;
  if (!m) return;
  S.editTarget = kind || 'rich';
  m.classList.remove('hidden');
  const w = m.offsetWidth || 150;
  const h = m.offsetHeight || 170;
  m.style.left = Math.min(Math.max(6, x), window.innerWidth - w - 8) + 'px';
  m.style.top = Math.min(Math.max(6, y), window.innerHeight - h - 8) + 'px';
  nudgeRect(900);
}

function closeEditMenu() {
  if (!el.editMenu || el.editMenu.classList.contains('hidden')) return;
  el.editMenu.classList.add('hidden');
  S.editTarget = '';
}


/* ------------------------------------------------- 聊天消息右键菜单 */
/** 小纸条里的文字选择：必须在聊天区里，不能在输入框里 */
function chatSelection() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return '';
  const text = String(sel).trim();
  if (!text || !el.chatMsgs) return '';
  const node = sel.anchorNode;
  if (!node || !el.chatMsgs.contains(node)) return '';
  return text;
}

const LINK_RE = /https?:\/\/[^\s<>"'，。；、）】]+/i;

function msgMenuRefresh(msg) {
  const m = el.msgMenu;
  if (!m) return;
  const hasSel = !!chatSelection();
  const text = String((msg && msg.text) || '');
  const hasText = !!text.trim();
  const link = hasText && text.match(LINK_RE);
  const set = (act, on, label) => {
    const b = m.querySelector(`[data-act="${act}"]`);
    if (!b) return;
    b.classList.toggle('hidden', !on);
    if (label) b.textContent = label;
  };
  set('msg-copy', hasText && hasSel, hasSel ? '复制选中文字' : '复制选中文字');
  set('msg-copy-all', hasText, '复制整条消息');
  set('msg-open-link', !!link, '打开里面的链接');
  set('msg-view', !!(msg && msg.url), '查看大图');
  set('msg-fav', !!(msg && msg.mediaId), '添加到表情包');
}

function openMsgMenu(x, y, msg) {
  const m = el.msgMenu;
  if (!m || !msg) return;
  S.msgMenu = msg;
  msgMenuRefresh(msg);
  m.classList.remove('hidden');
  const w = m.offsetWidth || 130;
  const h = m.offsetHeight || 64;
  const left = Math.min(Math.max(6, x), window.innerWidth - w - 8);
  const top = Math.min(Math.max(6, y), window.innerHeight - h - 8);
  m.style.left = left + 'px';
  m.style.top = top + 'px';
  nudgeRect(900);
}

function closeMsgMenu() {
  if (!el.msgMenu || el.msgMenu.classList.contains('hidden')) return;
  el.msgMenu.classList.add('hidden');
  S.msgMenu = null;
}

function lbShowMenu(x, y) {
  const m = el.lbMenu;
  m.classList.remove('hidden');
  const r = m.getBoundingClientRect();
  const maxX = window.innerWidth - r.width - 10;
  const maxY = window.innerHeight - r.height - 10;
  m.style.left = Math.max(10, Math.min(x, maxX)) + 'px';
  m.style.top = Math.max(10, Math.min(y, maxY)) + 'px';
}

async function lbCopy() {
  if (!lbUrl) return;
  const r = await api.app.copyImage(lbUrl);
  if (r && r.ok) toast('图片已复制到剪贴板');
  else toast('复制失败：' + ((r && r.message) || '未知错误'), true);
  el.lbMenu.classList.add('hidden');
}

async function lbSave() {
  if (!lbUrl) return;
  const r = await api.app.saveImage(lbUrl, el.lbName.textContent);
  if (r && r.ok) toast('已保存到 ' + r.path);
  else if (r && !r.canceled) toast('保存失败：' + (r.message || '未知错误'), true);
  el.lbMenu.classList.add('hidden');
}

async function handleAct(act, node) {
  const wrap = node.closest('[data-id]');
  const id = wrap ? wrap.dataset.id : '';
  const item =
    (S.data.clips || []).find((c) => c.id === id) ||
    (S.data.files || []).find((f) => f.id === id) ||
    (S.data.notes || []).find((n) => n.id === id) ||
    (S.data.mail.items || []).find((m) => String(m.uid) === String(id));

  switch (act) {
    case 'lb-copy': {
      await lbCopy();
      break;
    }
    case 'lb-fav': {
      // 从预览里把这张图存进房间表情包
      const room = curRoom();
      const hit = ((room && room.messages) || []).find((m) => m.url && chatAbs(m.url) === lbUrl);
      if (!hit || !hit.mediaId) {
        toast('这张图没有可用的图片文件', true);
        break;
      }
      await chatAddSticker(hit.mediaId, '');
      break;
    }
    case 'lb-save': {
      await lbSave();
      break;
    }
    case 'lb-close': {
      await closeLightbox();
      break;
    }
    case 'sel-copy': {
      await api.clips.writeText(S.selText || '');
      toast('已复制选中的文字');
      setMode('idle');
      break;
    }
    case 'sel-note': {
      const r = await api.notes.add(S.selText || '');
      if (r && r.ok) toast('已存成便笺');
      setMode('idle');
      break;
    }
    case 'sel-chat': {
      await sendToChat({ text: S.selText || '', label: '选中文字' });
      setMode('idle');
      break;
    }
    case 'sel-search': {
      const q = encodeURIComponent(S.selText || '');
      api.app.openExternal('https://www.bing.com/search?q=' + q);
      setMode('idle');
      break;
    }
    case 'sel-close':
      setMode('idle');
      break;
    case 'todo-toggle': {
      const id = node.closest('[data-todo]').dataset.todo;
      await api.todos.toggle(id);
      break;
    }
    case 'todo-del': {
      const id = node.closest('[data-todo]').dataset.todo;
      await api.todos.remove(id);
      renderTodos();
      nudgeRect(900);
      break;
    }
    case 'todo-pomo': {
      const id = node.closest('[data-todo]').dataset.todo;
      const t = (S.data.todos || []).find((x) => x.id === id);
      if (t && t.minutes) {
        startTimer(t.minutes * 60);
        toast('番茄钟开始：' + t.minutes + ' 分钟后提醒');
      }
      break;
    }
    case 'todo-clear-done': {
      const r = await api.todos.clearDone();
      toast('已清掉 ' + ((r && r.removed) || 0) + ' 项');
      renderTodos();
      break;
    }
    case 'room-select': {
      chatSelect(Number(node.dataset.room) || 0);
      break;
    }
    case 'room-copy': {
      await chatCopyCode(Number(node.dataset.room) || 0);
      break;
    }
    case 'room-add': {
      chatStartAdd();
      break;
    }
    case 'room-leave': {
      chatAskLeave(Number(node.dataset.room));
      break;
    }
    case 'chat-copy-code': {
      const s = curRoom();
      if (!s) break;
      await api.clips.writeText(s.code);
      toast('匹配码 ' + s.code + ' 已复制');
      break;
    }
    case 'reply-cancel': {
      clearReply();
      break;
    }
    case 'chat-leave': {
      chatAskLeave();
      break;
    }
    case 'chat-kick': {
      const devId = (node && node.dataset && node.dataset.dev) || '';
      if (!devId) break;
      chatVoteStart(devId);
      break;
    }
    case 'vote-yes': {
      if (node && node.dataset && node.dataset.id) chatVoteCast(node.dataset.id, true);
      break;
    }
    case 'vote-no': {
      if (node && node.dataset && node.dataset.id) chatVoteCast(node.dataset.id, false);
      break;
    }
    case 'warn-close': {
      closeDissolveWarn();
      break;
    }
    case 'chat-cancel-new': {
      S.chat.adding = false;
      chatRender();
      break;
    }
    case 'chat-image': {
      // 系统文件对话框会把窗口焦点拿走，这里先设宽限期，避免「选完图岛已经收起来了」
      S.pickUntil = Date.now() + 120000;
      el.chatFile.click();
      break;
    }
    case 'chat-emoji': {
      chatToggleEmoji();
      break;
    }
    case 'chat-at': {
      if (!el.pickPop || el.pickPop.classList.contains('hidden')) openPick('at');
      else closePick();
      break;
    }
    case 'chat-nudge': {
      if (!el.pickPop || el.pickPop.classList.contains('hidden')) openPick('nudge');
      else closePick();
      break;
    }
    case 'chat-send': {
      chatSendText();
      break;
    }
    case 'note-to-chat': {
      if (!item) break;
      await sendToChat({ text: notePlain(noteSelection() || item.text), label: '备忘录' });
      break;
    }
    case 'note-edit': {
      if (!item) break;
      S.noteOpen = id;
      S.noteEdit = id;
      closeNoteMenu();
      renderNotes();
      nudgeRect(900);
      focusNoteEditor(id);
      break;
    }
    case 'note-save': {
      const box = el.noteList.querySelector('.note-rich[data-id="' + id + '"]');
      if (!box) break;
      const text = noteRichRead(box);
      if (!text.trim()) return toast('内容不能为空', true);
      clearTimeout(S.noteSaveT);
      S.noteSaveT = 0;
      const r = await api.notes.update(id, text);
      if (r && r.ok === false) return toast(r.message || '保存失败', true);
      S.noteEdit = null;
      renderNotes();
      nudgeRect(900);
      toast('已保存');
      break;
    }
    case 'note-cancel': {
      S.noteEdit = null;
      renderNotes();
      nudgeRect(900);
      break;
    }
    case 'note-menu-edit': {
      if (!item) break;
      S.noteOpen = id;
      S.noteEdit = id;
      closeNoteMenu();
      renderNotes();
      nudgeRect(900);
      focusNoteEditor(id);
      break;
    }
    case 'note-menu-paste': {
      if (!item) break;
      closeNoteMenu();
      const got = await api.clips.readNow();
      if (!got || !got.ok) {
        toast((got && got.message) || '剪贴板里没有能粘贴的内容', true);
        break;
      }
      let snippet = '';
      if (got.kind === 'image') {
        const saved = await api.notes.image({ dataUrl: got.dataUrl });
        if (!saved || !saved.ok) {
          toast((saved && saved.message) || '图片存不进去', true);
          break;
        }
        snippet = noteToken(saved.file);
      } else {
        snippet = String(got.text || '');
      }
      if (!snippet) {
        toast('剪贴板里没有能粘贴的内容', true);
        break;
      }
      const nextText = (item.text || '') + (item.text ? '\n' : '') + snippet;
      await api.notes.update(id, nextText);
      toast(got.kind === 'image' ? '图片已粘贴到这条备忘录' : '已粘贴');
      break;
    }
    case 'edit-cut':
    case 'edit-copy': {
      closeEditMenu();
      try {
        document.execCommand(act === 'edit-cut' ? 'cut' : 'copy');
      } catch (_) {}
      break;
    }
    case 'edit-paste':
    case 'edit-paste-img': {
      const imageOnly = act === 'edit-paste-img';
      const from = S.editTarget;
      closeEditMenu();
      S.editTarget = from; // closeEditMenu 会清空，粘贴还要靠它判断是不是「新建框里写了一半」
      if (S.notePaste) await S.notePaste(imageOnly);
      break;
    }
    case 'edit-selectall': {
      const fromInput = S.editTarget === 'input';
      closeEditMenu();
      const rich = el.noteList.querySelector('.note-rich[contenteditable="true"]');
      if (fromInput && el.noteInput) {
        el.noteInput.focus();
        el.noteInput.select();
      } else if (rich) {
        rich.focus({ preventScroll: true });
        const r = document.createRange();
        r.selectNodeContents(rich);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
      }
      break;
    }
    case 'note-menu-copy': {
      if (!item) break;
      await api.clips.writeText(notePlain(item.text || ''));
      closeNoteMenu();
      toast('备忘录已复制');
      break;
    }
    case 'note-menu-chat': {
      if (!item) break;
      closeNoteMenu();
      await sendToChat({ text: notePlain(item.text || ''), label: '备忘录' });
      break;
    }
    case 'note-menu-pin': {
      if (!item) break;
      const r = await api.notes.togglePin(id);
      closeNoteMenu();
      toast(r && r.pinned ? '已钉到桌面' : '已取消钉在桌面');
      break;
    }
    case 'note-menu-del': {
      if (!item) break;
      closeNoteMenu();
      await api.notes.remove(id);
      toast('已删除备忘录');
      break;
    }
    case 'note-copy': {
      if (!item) break;
      const sel = noteSelection();
      await api.clips.writeText(sel || item.text);
      toast(sel ? '已复制选中的文字' : '备忘录已复制');
      break;
    }
    case 'clip-to-chat': {
      if (!item) break;
      if (item.kind === 'image') {
        await sendToChat({ clipId: item.id, label: '图片' });
      } else {
        await sendToChat({ text: item.text || '', label: '剪贴板内容' });
      }
      break;
    }
    case 'note-clear': {
      clearNotes();
      break;
    }
    case 'clip-clear': {
      clearClips();
      break;
    }
    case 'mail-copy': {
      if (!item) break;
      const addr = item.fromAddr || '';
      if (!addr) return toast('这封邮件没有发件人地址', true);
      await api.clips.writeText(addr);
      toast('已复制 ' + addr);
      break;
    }
    case 'mail-code': {
      const code = node.dataset.code || (item && item.code) || (S.mailRead && S.mailRead.data && S.mailRead.data.code) || '';
      if (!code) break;
      await api.clips.writeText(code);
      toast('验证码 ' + code + ' 已复制');
      break;
    }
    case 'mail-back': {
      closeMail();
      break;
    }
    case 'mail-view': {
      S.mailView = node.dataset.view === 'text' ? 'text' : 'html';
      renderMail();
      mailScrollTop();
      nudgeRect(900);
      break;
    }
    case 'mail-copy-from': {
      const addr = node.dataset.addr || '';
      if (!addr) return toast('这封邮件没有发件人地址', true);
      await api.clips.writeText(addr);
      toast('已复制 ' + addr);
      break;
    }
    case 'mail-link': {
      const url = node.dataset.url || (item && item.links && item.links[0]) || '';
      if (!url) break;
      const r = await api.app.openExternal(url);
      toast(r && r.ok ? '已在浏览器打开' : '打开失败', !(r && r.ok));
      break;
    }
    case 'note-pin': {
      const r = await api.notes.togglePin(id);
      toast(r && r.pinned ? '已钉到桌面' : '已取消钉在桌面');
      break;
    }
    // M6：把这条事项咻给好友
    case 'note-share': {
      if (!S.account.signedIn) {
        toast('先在设置里登录，才能咻给好友', true);
        break;
      }
      const rect = node.getBoundingClientRect();
      openSharePop(rect.left - 110, rect.bottom + 6, node.dataset.id || id);
      break;
    }
    case 'share-to': {
      const who = (S.account.friends || []).find((f) => f.id === node.dataset.id);
      closeSharePop();
      if (who) await shareNoteTo(who, S.shareNoteId, node);
      break;
    }
    case 'cp-friend': {
      await openShareHist(node.dataset.id, node.dataset.name);
      break;
    }
    case 'chat-new': {
      if ((S.chat.rooms || []).length >= 2) return toast('最多两个频道，先退出一个再建');
      if (!window.confirm('新建一个频道？')) return;
      await chatCreate();
      break;
    }
    case 'cp-hist': {
      await openShareHist('', '');
      break;
    }
    case 'cp-bind': {
      setTab('settings');
      const box = $('#accFriendName');
      if (box) setTimeout(() => box.focus(), 260);
      break;    }
    case 'friend-accept':
    case 'friend-reject':
    case 'friend-remove': {
      await accFriendAct(node.dataset.id, act.replace('friend-', ''));
      break;
    }
    case 'note-done': {
      const cur = (S.data.notes || []).find((n) => n.id === id);
      const next = !(cur && cur.done);
      await api.notes.done(id, next);
      toast(next ? '完成了一条待办' : '又变回没完成了');
      break;
    }
    case 'note-del': {
      const item = (S.data.notes || []).find((n) => n.id === id);
      if (item && item.pinned) {
        toast('先取消钉在桌面才能删除', true);
        break;
      }
      await api.notes.remove(id);
      toast('已删除');
      break;
    }
    case 'clip-pin': {
      await api.clips.togglePin(id);
      break;
    }
    case 'timer-cancel': {
      cancelTimer(id);
      break;
    }
    case 'clip-del': {
      const c = (S.data.clips || []).find((x) => x.id === id);
      if (c && c.pinned) {
        toast('先取消固定才能删除', true);
        break;
      }
      await api.clips.remove(id);
      break;
    }
    case 'file-copy': {
      const r = await api.files.copy([id]);
      toast((r && r.message) || '已复制', !(r && r.ok));
      break;
    }
    case 'file-path': {
      const r = await api.files.copyPath(id);
      toast((r && r.message) || '路径已复制', !(r && r.ok));
      break;
    }
    case 'file-reveal': {
      await api.files.reveal(id);
      break;
    }
    case 'file-cloud': {
      const item = (S.data.files || []).find((x) => x.id === id);
      if (item && item.cloudUrl) {
        await api.clips.writeText(item.cloudUrl);
        toast('云端链接已复制');
        break;
      }
      toast('正在上传到云端…');
      const r = await api.files.uploadCloud(id);
      if (r && r.ok) {
        await api.clips.writeText(r.url);
        toast('已上传，链接已复制到剪贴板');
      } else {
        toast((r && r.message) || '上传失败', true);
      }
      break;
    }
    case 'file-del': {
      await api.files.remove(id);
      break;
    }
    case 'mail-filter': {
      S.mailFilter = node.dataset.acc || '';
      renderMail();
      nudgeRect(900);
      break;
    }
    case 'mail-acc-edit': {
      S.mailEdit = node.dataset.acc || '';
      S.formKey = '';
      S.mailOpen = null;
      setTab('settings');
      renderSettings();
      break;
    }
    case 'mail-acc-del': {
      const acc = node.dataset.acc || '';
      if (!acc) break;
      if (!S.confirmKey || S.confirmKey !== 'mail-del:' + acc) {
        S.confirmKey = 'mail-del:' + acc;
        S.confirmT = Date.now();
        toast('再点一次删除这个邮箱（邮件索引也会一起删掉）');
        break;
      }
      await api.mail.remove(acc);
      if (S.mailEdit === acc) S.mailEdit = '';
      if (S.mailFilter === acc) S.mailFilter = '';
      S.formKey = '';
      toast('已删除这个邮箱');
      break;
    }
    default:
      break;
  }
}

async function handleRow(row) {
  const id = row.dataset.id;
  if (row.classList.contains('mail')) {
    // id 就是复合主键 `<accId>:<uid>`
    row.classList.add('scanning');
    await openMail(String(id));
    row.classList.remove('scanning');
    await api.mail.markRead(String(id));
  } else if (row.classList.contains('note')) {
    const n = (S.data.notes || []).find((x) => x.id === id);
    if (!n) return;
    // 正在拖选文字时不要收起/展开
    if (noteSelection()) return;
    // 编辑中的那一行，点空白处不要直接收起（避免误丢输入）
    if (S.noteEdit === id) return;
    S.noteOpen = S.noteOpen === id ? null : id;
    if (!S.noteOpen) S.noteEdit = null;
    renderNotes();
    if (S.noteOpen) nudgeRect(900);
  } else if (row.classList.contains('clip')) {
    const r = await api.clips.copy(id);
    toast(r === false ? '复制失败' : '已复制到剪贴板', r === false);
  } else if (row.classList.contains('file')) {
    const r = await api.files.open(id);
    if (r && !r.ok) toast(r.message || '打开失败', true);
  }
}

/* ---------------------------------------------------------------- 小纸条 */
const CHAT_KEY = 'island.chat.v2';
const CHAT_MAX = 2;
const CHAT_ORIGIN = 'https://chat.ccyyqq.com';
const CHAT_API = CHAT_ORIGIN + '/island';
const EMOJIS =
  '😀 😄 😂 🤣 😊 😍 🥰 😘 😜 🤔 😐 😴 😭 😤 🥳 🤯 😇 🤗 🙃 😎 🤩 🥺 😮 👻 🤖 👍 👎 👏 🙏 💪 🤝 ✌️ 👌 🫶 ❤️ 💔 🔥 ✨ 🎉 🎁 ☕ 🍜 🍺 🌙 ⭐ ⚡ 🚀 🐱 🐶 🌸 🍀 🐟 🐤'.split(' ');

function chatAbs(url) {
  if (!url) return '';
  return url.startsWith('/') ? CHAT_ORIGIN + url : url;
}

function roomName(r) {
  if (!r) return '小纸条';
  if (r.nick) return r.nick;
  const i = S.chat.rooms.indexOf(r);
  return '频道 ' + (i >= 0 ? i + 1 : 1);
}

function curRoom() {
  return S.chat.rooms[S.chat.active] || null;
}

function chatLoad() {
  try {
    const raw = JSON.parse(localStorage.getItem(CHAT_KEY) || 'null');
    if (!raw) return null;
    const rooms = (Array.isArray(raw.rooms) ? raw.rooms : [])
      .filter((r) => r && r.roomId && r.deviceId && r.token)
      .slice(0, CHAT_MAX)
      .map((r) => ({
        code: r.code || '',
        roomId: r.roomId,
        deviceId: r.deviceId,
        token: r.token,
        name: r.name || '',
        nick: r.nick || '',
        members: [],
        messages: [],
        unread: 0,
        state: 'off',
        es: null
      }));
    if (!rooms.length) return null;
    return { rooms, active: Math.min(raw.active || 0, rooms.length - 1) };
  } catch {
    /* 忽略 */
  }
  return null;
}

function chatPersist() {
  try {
    const rooms = S.chat.rooms.map((r) => ({
      code: r.code,
      roomId: r.roomId,
      deviceId: r.deviceId,
      token: r.token,
      name: r.name,
      nick: r.nick || ''
    }));
    if (!rooms.length) localStorage.removeItem(CHAT_KEY);
    else localStorage.setItem(CHAT_KEY, JSON.stringify({ rooms, active: S.chat.active }));
  } catch {
    /* 忽略 */
  }
}

async function chatFetch(path, opts = {}) {
  const init = { method: opts.method || 'GET', headers: {} };
  if (S.account && S.account.userToken) init.headers.Authorization = 'Bearer ' + S.account.userToken;
  if (opts.body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(opts.body);
  }
  try {
    const res = await fetch(CHAT_API + path, init);
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    const ok = res.ok && data && data.ok !== false;
    return { ok: !!ok, status: res.status, data: data || {}, code: (data && data.code) || '', message: (data && data.message) || '' };
  } catch (err) {
    return { ok: false, status: 0, data: {}, code: 'network', message: '连不上服务器，检查网络' };
  }
}

function chatErrText(r) {
  const map = {
    bad_code: '匹配码是 12 位，检查一下',
    no_room: '这个匹配码不存在，注意区分大小写',
    name_taken: '这个昵称已被占用，可勾选「顶替同昵称的旧设备」',
    room_full: '一个匹配码最多 4 台电脑',
    no_media: '图片上传失败',
    unauthorized: '身份已失效，请重新加入',
    network: '连不上服务器，检查网络'
  };
  return map[r.code] || r.message || '操作失败';
}

function chatSetState(room) {
  const node = el.chatState;
  if (!node || !room) return;
  const state = room.state || 'off';
  const texts = { on: '在线', connecting: '连接中…', off: '未连接', err: '已断开' };
  node.className = 'chat-state' + (state === 'on' ? ' on' : state === 'err' ? ' err' : '');
  node.innerHTML = '<i class="dot"></i>' + (state === 'on' ? '' : texts[state] || '未连接');
  renderChatMeta();
}

/* 小纸条顶部右侧：成员数 / 消息数 / 最近活跃 */
function renderChatMeta() {
  const box = $('#chatMeta');
  if (!box) return;
  const s = curRoom();
  if (!s) {
    box.textContent = '';
    return;
  }
  const parts = [];
  const members = (s.members || []).length;
  if (members) parts.push(members + ' 位成员');
  const msgs = (s.messages || []).length;
  if (msgs) parts.push(msgs + ' 条消息');
  const last = (s.info && s.info.lastActive) || (s.messages || []).length && lastMsgAt(s);
  if (last) {
    const d = new Date(last);
    if (!isNaN(d.getTime())) {
      const sameDay = new Date().toDateString() === d.toDateString();
      parts.push('最近活跃 ' + (sameDay ? pad(d.getHours()) + ':' + pad(d.getMinutes()) : (d.getMonth() + 1) + '/' + d.getDate()));
    }
  }
  box.textContent = parts.join(' · ');
  const code = s.info && s.info.code;
  box.title = code ? '匹配码 ' + code : '';
}

function lastMsgAt(s) {
  const list = s.messages || [];
  const m = list[list.length - 1];
  return (m && m.createdAt) || 0;
}

function chatShowError(msg) {
  if (!el.chatErr) return;
  el.chatErr.textContent = msg || '';
  el.chatErr.classList.toggle('hidden', !msg);
}

function chatRenderRooms() {
  const rooms = S.chat.rooms;
  if (!el.chatRooms) return;
  el.chatRooms.classList.toggle('hidden', !rooms.length);
  el.chatRooms.innerHTML =
    rooms
      .map((r, i) => {
        const on = i === S.chat.active;
        const cls = 'room-chip' + (on ? ' active' : '') + (r.state === 'on' ? '' : ' off');
        return (
          '<span class="' + cls + '" role="button" tabindex="0" data-act="room-select" data-room="' + i +
          '" title="左键切换频道 · 右键重命名（只存在本机）">' +
          '<i class="r-dot"></i>' +
          '<button class="r-copy" data-act="room-copy" data-room="' + i + '" title="复制匹配码">' +
          '<svg class="ic"><use href="#i-copy" /></svg></button>' +
          '<span class="r-name">' + esc(roomName(r)) + '</span>' +
          '<b class="r-badge' + (r.unread ? ' show' : '') + '">' + (r.unread > 99 ? '99+' : r.unread) + '</b>' +
          '<button class="r-exit" data-act="room-leave" data-room="' + i + '" title="退出这个频道">' +
          '<svg class="ic"><use href="#i-x" /></svg></button>' +
          '</span>'
        );
      })
      .join('') +
    (rooms.length < CHAT_MAX
      ? '<button class="room-add" data-act="room-add" title="再加一个频道（最多 2 个）">+</button>'
      : '');
  renderChatPeople();
}

function chatRender() {
  closePick();
  const room = curRoom();
  const showGate = !room || S.chat.adding;
  el.chatGate.classList.toggle('hidden', !showGate);
  el.chatRoom.classList.toggle('hidden', !(!showGate && room));
  if (el.chatCancelNew) el.chatCancelNew.classList.toggle('hidden', !(room && S.chat.adding));
  chatRenderRooms();
  if (!showGate && room) {
    chatSetState(room);
    renderChatMembers();
    renderChatVotes();
    renderChatMsgs();
    renderPending();
    renderMentionTags();
    return;
  }
  if (!el.chatName.value) el.chatName.value = chatDefaultName();
}

function chatSelect(i) {
  const room = S.chat.rooms[i];
  if (!room) return;
  const changed = S.chat.active !== i;
  S.chat.active = i;
  S.chat.adding = false;
  // 切频道时把待发送的 @ 名单和待发表情清掉，免得把 A 频道的东西发到 B 频道去
  S.chat.mentions.clear();
  renderMentionTags();
  clearPending();
  clearReply();
  room.unread = 0;
  chatPersist();
  chatRender();
  if (changed) chatLoadHistory(room);
  renderBadges();
}

/* 只复制匹配码，不动频道 */
async function chatCopyCode(i) {
  const room = S.chat.rooms[i];
  if (!room || !room.code) return;
  const r = await api.clips.writeText(room.code);
  toast(r && r.ok === false ? '复制失败：' + (r.message || '剪贴板不可用') : '匹配码 ' + room.code + ' 已复制', r && r.ok === false);
}

function chatStartAdd() {
  if (S.chat.rooms.length >= CHAT_MAX) return toast('一台电脑最多加入 2 个频道', true);
  S.chat.adding = true;
  chatShowError('');
  chatRender();
  setTimeout(() => el.chatCode.focus(), 60);
}

/* 频道重命名：只存本机，不写服务器 */
function chatRename(i) {
  const room = S.chat.rooms[i];
  if (!room || !el.chatRooms) return;
  const chip = el.chatRooms.querySelector('[data-room="' + i + '"]');
  if (!chip) return;
  const nameEl = chip.querySelector('.r-name');
  if (!nameEl || chip.querySelector('.room-edit')) return;
  const input = document.createElement('input');
  input.className = 'room-edit';
  input.maxLength = 12;
  input.value = room.nick || '';
  input.placeholder = room.code || '';
  nameEl.replaceWith(input);
  input.focus();
  input.select();
  let done = false;
  const finish = (save) => {
    if (done) return;
    done = true;
    if (save) {
      room.nick = input.value.trim().slice(0, 12);
      chatPersist();
      toast(room.nick ? '频道改名为「' + room.nick + '」' : '已恢复显示匹配码');
    }
    chatRenderRooms();
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      finish(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      finish(false);
    }
  });
  input.addEventListener('blur', () => finish(true));
  input.addEventListener('click', (e) => e.stopPropagation());
}

function chatDefaultName() {
  const meta = (S.data && S.data.meta) || {};
  const h = String(meta.hostname || '').split('.')[0];
  return h || '这台电脑';
}

function myPersonKey() {
  const s = curRoom();
  const uid = S.account && S.account.user && S.account.user.id;
  return uid ? 'u:' + uid : (s ? s.deviceId : '');
}

function memberKey(m) {
  if (!m) return '';
  return m.userId ? 'u:' + m.userId : m.id;
}

function renderChatMembers() {
  const s = curRoom();
  if (!s) return;
  // 按人归并：同一个账号的多台设备只显示一个成员，票数、@、拍一拍都按人算
  const groups = new Map();
  for (const m of s.members || []) {
    const key = memberKey(m);
    let g = groups.get(key);
    if (!g) {
      g = { key, name: m.name, ids: [], me: false, online: false, userId: m.userId || null };
      groups.set(key, g);
    }
    g.ids.push(m.id);
    if (m.id === s.deviceId) g.me = true;
    if (m.online !== false) g.online = true;
    if (!g.name && m.name) g.name = m.name;
  }
  el.chatMembers.innerHTML = [...groups.values()]
    .map((g) => {
      const me = g.me;
      const label = g.ids.length > 1 ? g.name + '（' + g.ids.length + ' 台）' : g.name;
      const cls = 'member' + (me ? ' me' : '') + (g.online === false && !me ? ' off' : '');
      const kick = me
        ? ''
        : '<button class="member-kick" data-act="chat-kick" data-dev="' + esc(g.key) + '" title="投票把 ' +
          esc(g.name) + ' 移出频道"><svg class="ic"><use href="#i-scale" /></svg></button>';
      return (
        '<span class="' + cls + '" data-dev="' + esc(g.key) + '" title="' +
        esc(g.name) + (g.online === false && !me ? ' · 离线' : ' · 在线') + (me ? '' : ' · 双击拍一拍') + '">' +
        '<i class="av" style="background:' + colorOf(g.name) + '">' + esc(initialOf(g.name, '')) + '</i>' +
        '<span>' + esc(label) + (me ? '（我）' : '') + '</span>' +
        '<i class="live"></i>' + kick + '</span>'
      );
    })
    .join('');
  renderChatMeta();
}

/* ------------------------------------------------- 投票踢人 */

function renderChatVotes() {
  if (!el.chatVotes) return;
  const s = curRoom();
  // 只有还没投的票才留在界面上；投完（或已结束）立刻收起
  const list = ((s && s.votes) || []).filter((v) => v.status === 'open' && (v.mine === null || v.mine === undefined));
  if (!s || !list.length) {
    el.chatVotes.classList.add('hidden');
    el.chatVotes.innerHTML = '';
    return;
  }
  el.chatVotes.classList.remove('hidden');
  el.chatVotes.innerHTML = list
    .map((v) => {
      const target = v.targetId === myPersonKey();
      const left = v.closesAt ? Math.max(0, Math.ceil((v.closesAt - Date.now()) / 60000)) : 0;
      return (
        '<div class="vote-row" data-vote="' + esc(v.id) + '">' +
        '<svg class="ic" style="width:13px;height:13px"><use href="#i-scale" /></svg>' +
        '<span>把 <b>' + esc(v.targetName || '某人') + '</b> 移出频道</span>' +
        '<span class="vcount">' + v.yes + '/' + v.need + ' 票' + (left ? ' · ' + left + ' 分钟' : '') + '</span>' +
        '<span class="grow"></span>' +
        (target
          ? '<span class="vcount">正在投你</span>'
          : '<button class="mini" data-act="vote-yes" data-id="' + esc(v.id) + '">同意</button>' +
            '<button class="mini" data-act="vote-no" data-id="' + esc(v.id) + '">反对</button>') +
        '</div>'
      );
    })
    .join('');
  nudgeRect(900);
}

async function chatVoteStart(targetId) {
  const s = curRoom();
  if (!s) return;
  if (targetId === myPersonKey()) return toast('不能投票踢自己，直接点右上角 ✕ 退出就行');
  const r = await chatFetch('/api/rooms/' + encodeURIComponent(s.roomId) + '/votes', {
    method: 'POST',
    body: { deviceId: s.deviceId, token: s.token, target: targetId }
  }).catch(() => null);
  if (!r || !r.ok) return toast((r && (r.message || chatErrText(r))) || '发起投票失败', true);
  const v = (r.data && r.data.vote) || null;
  if (v && v.duplicated) toast('这个人的投票已经在进行中了');
  else toast('已发起投票：需要 ' + (v ? v.need : 2) + ' 票同意');
  await chatLoadVotes();
}

async function chatVoteCast(voteId, yes) {
  const s = curRoom();
  if (!s) return;
  const r = await chatFetch('/api/rooms/' + encodeURIComponent(s.roomId) + '/votes/' + encodeURIComponent(voteId) + '/ballot', {
    method: 'POST',
    body: { deviceId: s.deviceId, token: s.token, yes: !!yes }
  }).catch(() => null);
  if (!r || !r.ok) return toast((r && (r.message || chatErrText(r))) || '投票失败', true);
  const d = (r && r.data) || {};
  if (Array.isArray(d.votes)) s.votes = d.votes;
  // 投完就把这张票从界面上撤掉，不要留在那里（自己投过了）
  s.votes = (s.votes || []).map((x) => (x.id === voteId ? Object.assign({}, x, { mine: !!yes }) : x));
  const v = d.vote;
  if (v && v.status === 'passed') toast('投票通过：' + (v.targetName || '那个人') + ' 已被移出频道');
  else if (v && v.status === 'rejected') toast('这次投票没通过');
  else toast(yes ? '已投同意' : '已投反对');
  renderChatVotes();
}

async function chatLoadVotes() {
  const s = curRoom();
  if (!s) return;
  const r = await chatFetch(
    '/api/rooms/' + encodeURIComponent(s.roomId) + '/votes?device=' + encodeURIComponent(s.deviceId) +
      '&token=' + encodeURIComponent(s.token)
  ).catch(() => null);
  if (r && r.ok && r.data && Array.isArray(r.data.votes)) {
    s.votes = r.data.votes;
    renderChatVotes();
  }
}

/* ------------------------------------------------- 频道即将解散 */

const WARN_KEY = 'island.dissolve.warned.v1';

function warnShownToday(roomId) {
  let map = {};
  try {
    map = JSON.parse(localStorage.getItem(WARN_KEY) || '{}') || {};
  } catch {
    map = {};
  }
  const today = new Date().toISOString().slice(0, 10);
  return map[roomId] === today;
}

function markWarnShown(roomId) {
  let map = {};
  try {
    map = JSON.parse(localStorage.getItem(WARN_KEY) || '{}') || {};
  } catch {
    map = {};
  }
  map[roomId] = new Date().toISOString().slice(0, 10);
  try {
    localStorage.setItem(WARN_KEY, JSON.stringify(map));
  } catch {
    /* 忽略 */
  }
}

function chatCheckDissolve(room) {
  const info = room && room.info;
  if (!info || !info.warn) return;
  if (warnShownToday(room.roomId)) return;
  showDissolveWarn(room, info);
}

function showDissolveWarn(room, info) {
  // 正在用面板/命令面板时别抢屏：挂起，等回到药丸状态再弹
  if (S.mode === 'panel' || S.mode === 'palette') {
    S.warnPending = { room, info };
    clearTimeout(S.warnRetry);
    S.warnRetry = setTimeout(() => {
      if (S.warnPending) showDissolveWarn(S.warnPending.room, S.warnPending.info);
    }, 15000);
    return;
  }
  S.warnPending = null;
  const left = Math.max(1, Math.ceil((info.dissolveAt - Date.now()) / 86400000));
  const name = roomName(room);
  if (el.warnTitle) el.warnTitle.textContent = '「' + name + '」还有 ' + left + ' 天就要解散';
  if (el.warnCount) {
    const d = new Date(info.dissolveAt);
    el.warnCount.textContent = d.getMonth() + 1 + ' 月 ' + d.getDate() + ' 日解散';
  }
  if (el.warnSub) el.warnSub.textContent = '这个频道已经 ' + Math.floor((info.idleMs || 0) / 86400000) + ' 天没人说话了';
  if (el.warnTip) {
    el.warnTip.textContent =
      '只要在「小纸条」里发一句话，倒计时立刻取消。' + left + ' 天后还没有人说话，这个频道的聊天记录、图片和表情包会被一起清掉。';
  }
  markWarnShown(room.roomId);
  S.warnRoom = room.roomId;
  S.pinned = true;
  setMode('warn');
  clearTimeout(S.warnTimer);
  S.warnTimer = setTimeout(closeDissolveWarn, 60000); // 按需求：一次持续 1 分钟
  nudgeRect(900);
}

function closeDissolveWarn() {
  clearTimeout(S.warnTimer);
  S.warnTimer = null;
  S.warnRoom = '';
  S.pinned = false;
  if (S.mode === 'warn') setMode('idle');
}


/* 表情包和文字混排：输入框里看不到标记，发送时把 [[st:mediaId]] 拼进正文，
   收到的一方按表情包 id 找回地址、渲染成气泡里的内联图片（和 QQ 里表情与文字混排一个意思）。
   只写 id、不带长 URL：万一对方还是老版本，气泡里也只是一小段标记，不会糊一大串链接。 */
const STICKER_TOKEN = /\[\[st:([A-Za-z0-9_-]+)(?:\|([^\]\s]+))?\]\]/g;
const STICKER_MAP_KEY = 'island.stickers.v1';

/** mediaId -> 图片地址，纯本地缓存，用来把消息里的标记还原成图片 */
let stickerMap = {};
try {
  stickerMap = JSON.parse(localStorage.getItem(STICKER_MAP_KEY) || '{}') || {};
} catch {
  stickerMap = {};
}

function rememberSticker(mediaId, url) {
  if (!mediaId || !url) return;
  if (stickerMap[mediaId] === url) return;
  stickerMap[mediaId] = url;
  const keys = Object.keys(stickerMap);
  if (keys.length > 300) delete stickerMap[keys[0]];
  try {
    localStorage.setItem(STICKER_MAP_KEY, JSON.stringify(stickerMap));
  } catch {
    /* 存不下就算了，不影响显示 */
  }
}

function rememberRoomStickers(room) {
  if (!room || !Array.isArray(room.stickers)) return;
  room.stickers.forEach((s) => rememberSticker(s.mediaId || s.id, s.url));
}

/** 把标记还原成地址：消息自带 url > 本地缓存 > 当前房间的表情包列表 */
function resolveStickerUrl(mediaId, url) {
  if (url) return url;
  if (!mediaId) return '';
  if (stickerMap[mediaId]) return stickerMap[mediaId];
  const room = curRoom();
  const hit = room && (room.stickers || []).find((s) => String(s.mediaId || s.id) === String(mediaId));
  return hit ? hit.url : '';
}

/** 把带表情标记的正文拆成 {text}/{img} 段 */
function tokenizeStickers(raw) {
  const s = String(raw || '');
  const out = [];
  let last = 0;
  let m;
  STICKER_TOKEN.lastIndex = 0;
  while ((m = STICKER_TOKEN.exec(s))) {
    if (m.index > last) out.push({ text: s.slice(last, m.index) });
    out.push({ img: resolveStickerUrl(m[1], m[2]), mediaId: m[1] });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
  STICKER_TOKEN.lastIndex = 0;
  return out;
}

/** 去掉标记后的纯文字（通知条预览、空消息判断用） */
function stripStickers(raw) {
  return tokenizeStickers(raw)
    .filter((p) => p.text)
    .map((p) => p.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstStickerUrl(raw) {
  const seg = tokenizeStickers(raw).find((p) => p.img);
  return seg ? seg.img : '';
}

function chatMsgHtml(m) {
  const s = curRoom();
  const own = s && (m.deviceId === s.deviceId || (m.deviceName && m.deviceName === s.name));
  if (m.kind === 'sys') {
    return '<div class="msg sys"><div class="bub">' + esc(m.text) + '</div></div>';
  }
  // 拍一拍：显示成一行灰色系统提示，不占气泡
  if (m.kind === 'nudge') {
    const target =
      (s && (s.members || []).find((x) => (m.mentions || []).includes(x.id))?.name) || '对方';
    return (
      '<div class="msg sys"><div class="bub nudge">' +
      esc(m.deviceName || '有人') + ' 拍了拍 ' + esc(target) + ' 👋</div></div>'
    );
  }
  const isImage = m.kind === 'image' || m.kind === 'sticker';
  const segs = tokenizeStickers(m.text);
  const hasInline = segs.some((p) => p.img);
  const plain = segs.filter((p) => p.text).map((p) => p.text).join(' ').trim();
  const stickerOnly = hasInline && !plain;
  const emojiOnly = !isImage && !hasInline && plain && plain.length <= 8 && /^[\p{Extended_Pictographic}\u200d\uFE0F\s]+$/u.test(plain);
  let body = '';
  if (isImage && m.url) {
    // 列表里用缩略图（又拍云 !default，几 KB），点开看大图时再用原图
    const full = chatAbs(m.url);
    const small = m.thumb ? chatAbs(m.thumb) : full;
    body = '<img src="' + esc(small) + '" alt="图片" loading="lazy" data-full="' + esc(full) +
      '" data-img="' + esc(full) + '" />';
  } else if (hasInline) {
    const me = (s && s.name) || '';
    const tag = me ? '@' + me : '';
    body = segs
      .map((p) => {
        if (p.img === undefined) {
          let t = esc(p.text);
          if (tag) t = t.split(esc(tag)).join('<b class="mtag-in">' + esc(tag) + '</b>');
          return t;
        }
        if (!p.img) return '<span class="inl-missing" title="表情包已被移除">[表情]</span>';
        const u = chatAbs(p.img);
        return '<img class="inl" src="' + esc(u) + '" alt="表情" loading="lazy" data-full="' + esc(u) +
          '" data-img="' + esc(u) + '" />';
      })
      .join('');
  } else {
    body = esc(m.text);
    // @到我自己的那一段高亮出来
    const me = (s && s.name) || '';
    if (me) {
      const tag = '@' + me;
      body = body.split(esc(tag)).join('<b class="mtag-in">' + esc(tag) + '</b>');
    }
  }
  // 引用的原消息：小一号、浅色，一行截断，点一下跳到原消息
  const rp = m.reply && (m.reply.text || m.reply.name)
    ? '<button class="quote" data-jump="' + esc(m.reply.id || '') + '" title="跳到原消息">' +
      '<span class="q-who">' + esc(m.reply.name || '某人') + '</span>' +
      '<span class="q-text">' + esc(String(m.reply.text || '图片').replace(/\s+/g, ' ').slice(0, 80)) + '</span></button>'
    : '';
  return (
    '<div class="msg' + (own ? ' own' : '') + (m.pending ? ' pending' : '') + '" data-mid="' + esc(m.id || '') + '">' +
    (own ? '' : '<span class="who">' + esc(m.deviceName || '') + '</span>') +
    '<div class="bub' + (emojiOnly ? ' emoji-only' : '') + (isImage ? ' img' : '') +
    (m.kind === 'sticker' || stickerOnly ? ' sticker' : '') + (hasInline ? ' mixed' : '') + '">' + body + '</div>' +
    rp +
    '<span class="time">' + esc(fmtTime(m.at)) + '</span></div>'
  );
}

function renderChatMsgs() {
  const room = curRoom();
  const all = (room && room.messages) || [];
  if (!all.length) {
    el.chatMsgs.innerHTML = '<div class="msg sys"><div class="bub">还没有消息，发一条试试</div></div>';
    renderChatMeta();
    return;
  }
  // DOM 里最多留最近 80 条，历史消息仍完整保存在 room.messages 里
  const list = all.length > 80 ? all.slice(-80) : all;
  el.chatMsgs.innerHTML = list.map(chatMsgHtml).join('');
  renderChatMeta();
}

/** 面板高度：小纸条页可以上下拖动改高，别的页签用默认 448 */
function panelHeight() {
  const h = Number(S.chat.height) || 0;
  return h >= 260 ? h : HEIGHTS.panel;
}

function chatMaxHeight() {
  // 屏幕工作区高度（拿不到就退回窗口高度）：留一点上下边距
  const base = S.screenH || window.innerHeight || 620;
  return Math.max(320, Math.round(base - 96));
}

/** 让主进程把透明窗口长到够装下这个高度的岛（超过就不裁切了） */
let fitT = 0;
function fitWindow(h, now) {
  const run = () => {
    try {
      const r = api.app.fitHeight && api.app.fitHeight(h + 40);
      if (r && typeof r.catch === 'function') r.catch(() => {});
    } catch (_) {}
  };
  if (now) return run();
  clearTimeout(fitT);
  fitT = setTimeout(run, 60);
}

function bindChatResize() {
  const grip = el.chatResize;
  if (!grip || grip.dataset.bound) return;
  grip.dataset.bound = '1';
  grip.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startH = panelHeight();
    const max = chatMaxHeight();
    // 先把窗口长够，拖的过程中就不用再改窗口尺寸（改窗口会让整页重排，掉帧）
    fitWindow(max, true);
    let pending = 0;
    let raf = 0;
    document.body.classList.add('resizing');
    // 每帧最多写一次样式：老实现每次 mousemove 都改 CSS + 发 IPC，
    // 叠上 .island 的 height 过渡就变成「拖一下、追一下」的滞后感。
    const apply = () => {
      raf = 0;
      const next = pending;
      S.chat.height = Math.round(next);
      // 只写 #stage 上的变量：写到 .island 自身会变成内联声明，
      // 之后 setMode()/setTab() 改 stage 就再也盖不掉（高度会卡住）。
      el.island.style.removeProperty('--isl-h');
      el.stage.style.setProperty('--isl-h', S.chat.height + 'px');
      nudgeRect(0);
    };
    const move = (ev) => {
      const next = Math.max(260, Math.min(max, startH + (ev.clientY - startY)));
      pending = next;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const up = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (pending) apply();
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      document.body.classList.remove('resizing');
      nudgeRect(200);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });
}

function chatScrollToEnd(force) {
  const box = el.chatMsgs;
  if (!box) return;
  const near = box.scrollHeight - box.scrollTop - box.clientHeight < 90;
  if (!force && !near) return;
  box.scrollTop = box.scrollHeight;
  if (!force) return;
  // 面板还在变形时高度还没定下来，等两帧和展开动画结束各贴一次底
  requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; });
  clearTimeout(chatScrollToEnd.t);
  chatScrollToEnd.t = setTimeout(() => { box.scrollTop = box.scrollHeight; }, 520);
}

function chatPeekFor(room, m) {
  // 拍一拍有自己的提示文案，走 chatReact，不需要普通消息条
  if (m.kind === 'nudge') return;
  const idx = S.chat.rooms.indexOf(room);
  const group = roomName(room);
  const who = m.deviceName || '有人';
  const myKeys = [room.deviceId];
  if (S.account && S.account.user && S.account.user.id) myKeys.push('u:' + S.account.user.id);
  const atMe = Array.isArray(m.mentions) && m.mentions.some((k) => myKeys.includes(k));
  const title = group + ' · ' + who + (atMe ? ' @了你' : '');
  const base = { icon: '#i-chat', time: fmtTime(m.at), room: idx, rainbow: atMe };
  if (m.kind === 'image') {
    showPeek({ ...base, kind: 'image', title, sub: '发来一张图片', thumb: m.url ? chatAbs(m.thumb || m.url) : '', dur: 5200 });
    return;
  }
  if (m.kind === 'sticker') {
    showPeek({
      ...base,
      kind: 'sticker',
      title,
      sub: '发来一个表情',
      thumb: m.url ? chatAbs(m.url) : '',
      emoji: m.url ? '' : String(m.text || '').trim(),
      dur: 4600
    });
    return;
  }
  // 表情包和文字混排的消息：只有表情时报「发来一个表情」并带缩略图
  const plainText = stripStickers(m.text);
  const stUrl = firstStickerUrl(m.text);
  if (!plainText && stUrl) {
    showPeek({ ...base, kind: 'sticker', title, sub: '发来一个表情', thumb: chatAbs(stUrl), dur: 4600 });
    return;
  }
  const text = plainText;
  const short = text.length > 20 ? text.slice(0, 20) + '…' : text;
  const fallback = atMe ? '提到了你' : '发来一条消息';
  showPeek({ ...base, kind: 'text', title, sub: short || fallback, dur: 4600 });
}

function chatPushMessage(room, m, silent) {
  const list = room.messages;
  chatReact(room, m);
  if (m.clientId) {
    const i = list.findIndex((x) => x.clientId === m.clientId);
    if (i >= 0) {
      list[i] = m;
      if (room === curRoom()) {
        renderChatMsgs();
        chatScrollToEnd();
      }
      return i;
    }
  }
  if (list.some((x) => x.id === m.id)) return -1;
  list.push(m);
  if (list.length > 400) list.splice(0, list.length - 400);

  const active = room === curRoom() && S.tab === 'chat' && S.mode === 'panel';
  if (!active) {
    room.unread = (room.unread || 0) + 1;
    chatRenderRooms();
    renderBadges();
    if (!silent) chatPeekFor(room, m);
  }
  if (room === curRoom() && S.tab === 'chat') {
    renderChatMsgs();
    chatScrollToEnd();
    if (active) chatMarkRead(room);
  }
  return list.length - 1;
}

/* ---- 拍一拍 / @提醒：被点名的这台电脑要有存在感 ---- */

const RAINBOW_MS = 7000;

function flashClass(node, cls, ms) {
  if (!node) return;
  node.classList.remove(cls);
  // 强制回流，保证连续两次触发也能重放动画
  void node.offsetWidth;
  node.classList.add(cls);
  clearTimeout(node['__t_' + cls]);
  node['__t_' + cls] = setTimeout(() => node.classList.remove(cls), ms);
}

function glowRainbow(ms) {
  flashClass(el.island, 'rainbow', ms || RAINBOW_MS);
}

/** 刘海模式下被拍：先掉下来变成灵动岛，抖完再贴回屏幕边上 */
function shakeIsland(ms) {
  const wasNotch = isNotch();
  if (wasNotch) applyStyle('island');
  flashClass(el.island, 'shake', ms || 1500);
  nudgeRect(2200);
  if (wasNotch) {
    setTimeout(() => {
      if (!S.pinned) applyStyle('notch');
    }, (ms || 1500) + 900);
  }
}

function chatReact(room, m) {
  if (!room || !m || m.deviceId === room.deviceId) return;
  const ids = Array.isArray(m.mentions) ? m.mentions : [];
  const mine = ids.includes(room.deviceId);
  if (m.kind === 'nudge') {
    if (!mine) return;
    const from = m.deviceName || '有人';
    shakeIsland(1500);
    showPeek({
      icon: '#i-bolt',
      title: from + ' 拍了拍你',
      sub: roomName(room) + ' · 快去看看',
      time: '刚刚',
      dur: 4600,
      force: true,
      rainbow: true
    });
    return;
  }
  if (mine) glowRainbow();
}

function chatCloseConn(room) {
  if (!room || !room.es) return;
  try {
    room.es.close();
  } catch {
    /* 忽略 */
  }
  room.es = null;
}

function chatDropRoom(room, reason) {
  chatCloseConn(room);
  const i = S.chat.rooms.indexOf(room);
  if (i >= 0) S.chat.rooms.splice(i, 1);
  if (S.chat.active >= S.chat.rooms.length) S.chat.active = Math.max(0, S.chat.rooms.length - 1);
  if (!S.chat.rooms.length) S.chat.adding = false;
  chatPersist();
  chatRender();
  renderBadges();
  if (reason) toast(reason, true);
}

function chatConnect(room) {
  if (!room) return;
  chatCloseConn(room);
  room.state = 'connecting';
  if (room === curRoom()) chatSetState(room);
  chatRenderRooms();

  const url =
    CHAT_API + '/api/stream?room=' + encodeURIComponent(room.roomId) +
    '&device=' + encodeURIComponent(room.deviceId) +
    '&token=' + encodeURIComponent(room.token);

  let es;
  try {
    es = new EventSource(url);
  } catch {
    room.state = 'err';
    chatSetState(room);
    return;
  }
  room.es = es;
  const alive = () => S.chat.rooms.indexOf(room) >= 0;
  const sync = () => {
    if (!alive()) return;
    chatRenderRooms();
    if (room === curRoom()) {
      chatSetState(room);
      renderChatMembers();
    }
  };

  es.addEventListener('hello', (e) => {
    if (!alive()) return;
    try {
      const d = JSON.parse(e.data || '{}');
      room.members = d.members || [];
      if (d.room) room.info = d.room;
      if (Array.isArray(d.votes)) room.votes = d.votes;
      if (Array.isArray(d.stickers)) room.stickers = d.stickers;
      rememberRoomStickers(room);
    } catch {
      /* 忽略 */
    }
    room.state = 'on';
    sync();
    if (room === curRoom()) renderChatVotes();
    chatLoadHistory(room);
    setTimeout(() => chatCheckDissolve(room), 1200);
  });
  es.addEventListener('votes', (e) => {
    if (!alive()) return;
    try {
      const incoming = JSON.parse(e.data || '{}').votes || [];
      const old = room.votes || [];
      // 广播里没有「我投了什么」，按 id 把本地的 mine 接上，否则刚投完又冒出来
      room.votes = incoming.map((v) => {
        const prev = old.find((x) => x.id === v.id);
        return { ...v, mine: v.mine !== null && v.mine !== undefined ? v.mine : prev ? prev.mine : null };
      });
    } catch {
      /* 忽略 */
    }
    if (room === curRoom()) renderChatVotes();
  });
  es.addEventListener('dissolved', (e) => {
    let reason = 'idle';
    try {
      reason = JSON.parse(e.data || '{}').reason || 'idle';
    } catch {
      /* 忽略 */
    }
    const name = roomName(room);
    // 本地把这个频道摘掉，避免还去连一个已经没了的房间
    try {
      if (room.es) room.es.close();
    } catch {
      /* 忽略 */
    }
    S.chat.rooms = S.chat.rooms.filter((r) => r !== room);
    if (S.chat.active >= S.chat.rooms.length) S.chat.active = Math.max(0, S.chat.rooms.length - 1);
    chatRender();
    if (reason === 'idle') toast('「' + name + '」太久没人说话，已经自动解散', true);
  });
  es.addEventListener('stickers', (e) => {
    if (!alive()) return;
    try {
      room.stickers = (JSON.parse(e.data || '{}').stickers) || [];
      rememberRoomStickers(room);
    } catch {
      /* 忽略 */
    }
    if (room === curRoom()) renderEmojiPop();
  });
  es.addEventListener('members', (e) => {
    if (!alive()) return;
    try {
      room.members = (JSON.parse(e.data || '{}').members) || [];
    } catch {
      /* 忽略 */
    }
    sync();
  });
  es.addEventListener('presence', (e) => {
    if (!alive()) return;
    try {
      const d = JSON.parse(e.data || '{}');
      if (d.members) room.members = d.members;
    } catch {
      /* 忽略 */
    }
    sync();
  });
  es.addEventListener('read', (e) => {
    if (!alive()) return;
    try {
      const d = JSON.parse(e.data || '{}');
      const uid = S.account && S.account.user && S.account.user.id;
      if (d && uid && d.userId === uid && d.deviceId !== room.deviceId) {
        room.unread = 0;
        chatRenderRooms();
        renderBadges();
      }
    } catch {
      /* 忽略 */
    }
  });
  es.addEventListener('message', (e) => {
    if (!alive()) return;
    try {
      const d = JSON.parse(e.data || '{}');
      if (d.message) chatPushMessage(room, d.message);
    } catch {
      /* 忽略 */
    }
  });
  es.addEventListener('kicked', (e) => {
    let reason = '这个昵称已被新电脑接管，频道已退出';
    try {
      const d = JSON.parse(e.data || '{}');
      if (d.reason) reason = d.reason;
    } catch {
      /* 忽略 */
    }
    chatDropRoom(room, reason);
  });
  es.onerror = () => {
    if (!alive() || room.es !== es) return;
    room.state = 'err';
    if (room === curRoom()) chatSetState(room);
    chatRenderRooms();
    // EventSource 自带重连；彻底关闭时兜底重连
    if (es.readyState === 2) {
      setTimeout(() => {
        if (alive() && !room.es) chatConnect(room);
      }, 3000);
    }
  };
}

async function chatMarkRead(room) {
  const r = room || curRoom();
  if (!r || !r.messages || !r.messages.length) return;
  const last = r.messages[r.messages.length - 1];
  if (!last || !last.id || String(last.id).startsWith('c')) return;
  if (r.lastReadId === last.id) return;
  r.lastReadId = last.id;
  const res = await chatFetch('/api/rooms/' + encodeURIComponent(r.roomId) + '/read', {
    method: 'POST',
    body: { deviceId: r.deviceId, token: r.token, messageId: last.id }
  }).catch(() => null);
  if (res && res.ok && res.data && res.data.lastReadId) r.lastReadId = res.data.lastReadId;
}

async function chatLoadHistory(room) {
  const r = room || curRoom();
  if (!r) return;
  const res = await chatFetch(
    '/api/rooms/' + encodeURIComponent(r.roomId) + '/messages?device=' + encodeURIComponent(r.deviceId) + '&token=' + encodeURIComponent(r.token)
  );
  if (!res.ok) return;
  const list = res.data.messages || [];
  r.messages = list.slice(-200);
  if (r === curRoom() && S.tab === 'chat') {
    renderChatMsgs();
    chatScrollToEnd(true);
    chatMarkRead(r);
  }
  chatRenderRooms();
}

function chatAddRoom(d, name) {
  if (S.chat.rooms.length >= CHAT_MAX) chatDropRoom(S.chat.rooms[S.chat.active], '');
  const room = {
    code: d.code || '',
    roomId: d.roomId,
    deviceId: d.deviceId,
    token: d.token,
    name: d.deviceName || name,
    nick: '',
    members: d.members || [],
    messages: [],
    votes: [],
    info: null,
    unread: 0,
    state: 'off',
    es: null
  };
  S.chat.rooms.push(room);
  S.chat.active = S.chat.rooms.length - 1;
  S.chat.adding = false;
  chatPersist();
  chatRender();
  chatConnect(room);
  return room;
}

async function chatCreate() {
  const name = (el.chatName.value || '').trim() || chatDefaultName();
  if (S.chat.busy) return;
  S.chat.busy = true;
  chatShowError('');
  const res = await chatFetch('/api/rooms', { method: 'POST', body: { deviceName: name } });
  S.chat.busy = false;
  if (!res.ok) return chatShowError(chatErrText(res));
  chatAddRoom(res.data, name);
  toast('频道已创建，匹配码 ' + res.data.code + '（已可分享）');
  setTimeout(() => {
    const chip = el.chatRooms && el.chatRooms.querySelector('.room-chip.active');
    chip?.animate?.(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.1)' }, { transform: 'scale(1)' }],
      { duration: 520, easing: 'cubic-bezier(.32,1.24,.42,1)' }
    );
  }, 120);
}

async function chatJoin() {
  const code = (el.chatCode.value || '').replace(/[\s-]+/g, '');
  const name = (el.chatName.value || '').trim() || chatDefaultName();
  if (code.length !== 12) return chatShowError('匹配码是 12 位，检查一下');
  if (S.chat.busy) return;
  S.chat.busy = true;
  chatShowError('');
  const res = await chatFetch('/api/rooms/join', {
    method: 'POST',
    body: { code, deviceName: name, replace: !!el.chatReplace.checked }
  });
  S.chat.busy = false;
  if (!res.ok) {
    chatShowError(chatErrText(res));
    if (res.data && res.data.canReplace) el.chatReplace.checked = true;
    return;
  }
  chatAddRoom(res.data, name);
  el.chatCode.value = '';
  el.chatReplace.checked = false;
  toast('已加入 ' + res.data.code);
}

/** 退出频道：第一次点只提示，5 秒内再点一次才真的退（防止误触） */
function chatAskLeave(index) {
  const list = S.chat.rooms || [];
  const room = Number.isInteger(index) ? list[index] : curRoom();
  if (!room) return;
  const last = (room.members || []).length <= 1;
  if (S.leaveAsk !== room.roomId || Date.now() > (S.leaveAt || 0)) {
    S.leaveAsk = room.roomId;
    S.leaveAt = Date.now() + 5000;
    toast(
      '再点一次就退出「' + roomName(room) + '」' +
        (last ? '，这是最后一个成员，频道会被删掉' : ''),
      'err'
    );
    return;
  }
  S.leaveAsk = '';
  chatLeave(Number.isInteger(index) ? index : list.indexOf(room));
}

async function chatLeave(index) {
  const list = S.chat.rooms || [];
  const room = Number.isInteger(index) ? list[index] : curRoom();
  if (!room) return;
  const label = roomName(room);
  chatDropRoom(room, '');
  toast('已退出「' + label + '」');
  chatFetch('/api/rooms/' + encodeURIComponent(room.roomId) + '/leave', {
    method: 'POST',
    body: { deviceId: room.deviceId, token: room.token }
  }).catch(() => {});
}

async function chatPost(kind, text, mediaId, url, mentions, reply) {
  const room = curRoom();
  if (!room) return false;
  const clientId = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const to = Array.isArray(mentions) ? mentions.filter(Boolean) : [];
  const local = {
    id: clientId,
    clientId,
    kind,
    text,
    mediaId: mediaId || null,
    thumb: url || null,
    url: url || null,
    reply: reply || null,
    deviceId: room.deviceId,
    deviceName: room.name,
    mentions: to,
    at: Date.now(),
    pending: true
  };
  room.messages.push(local);
  if (room === curRoom() && S.tab === 'chat') {
    renderChatMsgs();
    chatScrollToEnd(true);
  }
  const res = await chatFetch('/api/rooms/' + encodeURIComponent(room.roomId) + '/messages', {
    method: 'POST',
    body: {
      deviceId: room.deviceId,
      token: room.token,
      kind,
      text: text || '',
      mediaId: mediaId || null,
      clientId,
      mentions: to,
      reply: reply || null
    }
  });
  const i = room.messages.findIndex((x) => x.clientId === clientId);
  if (!res.ok) {
    if (i >= 0) room.messages.splice(i, 1);
    if (room === curRoom() && S.tab === 'chat') renderChatMsgs();
    toast(chatErrText(res), true);
    return false;
  }
  if (res.data.message && i >= 0) room.messages[i] = res.data.message;
  if (room === curRoom() && S.tab === 'chat') {
    renderChatMsgs();
    chatScrollToEnd();
  }
  return true;
}

function chatSendText() {
  const text = (el.chatInput.value || '').trim();
  const pend = pendingStickers();
  if (!text && !pend.length) return false;
  // 待发的表情包拼成标记跟在文字后面，服务端只当普通文本存，收到的一方渲染成内联图片
  const marks = pend
    .map((p) => {
      rememberSticker(p.mediaId, p.url);
      return '[[st:' + p.mediaId + ']]';
    })
    .join('');
  const payload = [text, marks].filter(Boolean).join(' ').trim();
  el.chatInput.value = '';
  clearPending();
  const tags = [...S.chat.mentions.values()];
  S.chat.mentions.clear();
  renderMentionTags();
  closePick();
  const reply = S.chat.reply || null;
  clearReply();
  chatPost('text', payload, null, null, tags, reply);
  return true;
}

/* ---------------------------------------------------------- 拍一拍 / @ 选择器 */

function pickCandidates() {
  const room = curRoom();
  if (!room) return [];
  return (room.members || []).filter((x) => x.id !== room.deviceId);
}

function openPick(mode, q) {
  const room = curRoom();
  if (!room) {
    toast('先加入一个频道', true);
    return;
  }
  const kw = String(q || '').trim().toLowerCase();
  const all = pickCandidates();
  const list = kw ? all.filter((x) => String(x.name || '').toLowerCase().includes(kw)) : all;
  if (!all.length) {
    toast('这个频道里还没有别人', true);
    return;
  }
  if (!list.length) {
    closePick();
    return;
  }
  S.pickMode = mode;
  const items = list
    .map(
      (x) =>
        '<button class="pick-item" data-pick="' +
        mode +
        '" data-id="' +
        x.id +
        '" data-name="' +
        String(x.name || '').replace(/"/g, '&quot;') +
        '"><i class="pick-av" style="--c:' +
        colorOf(x.name || '') +
        '">' +
        initialOf(x.name || '') +
        '</i><span class="pick-name">' +
        esc(x.name || '') +
        '</span>' +
        (x.online ? '<i class="pick-on"></i>' : '<i class="pick-off">离线</i>') +
        '</button>'
    )
    .join('');
  el.pickPop.innerHTML = (mode === 'nudge' ? '<b class="pick-title">拍一拍谁？</b>' : '<b class="pick-title">@ 谁？</b>') + items;
  el.pickPop.classList.remove('hidden');
  nudgeRect(900);
}

function closePick() {
  if (el.pickPop) el.pickPop.classList.add('hidden');
}

/** 光标前是不是正在打 @某人 */
function mentionQuery() {
  const inp = el.chatInput;
  if (!inp) return null;
  const v = inp.value || '';
  const pos = inp.selectionStart == null ? v.length : inp.selectionStart;
  const m = /@([^\s@]{0,12})$/.exec(v.slice(0, pos));
  if (!m) return null;
  return { start: pos - m[1].length - 1, q: m[1] };
}

function addMention(name, id) {
  const inp = el.chatInput;
  const v = inp.value || '';
  const pos = inp.selectionStart == null ? v.length : inp.selectionStart;
  const m = /@([^\s@]{0,12})$/.exec(v.slice(0, pos));
  const ins = '@' + name + ' ';
  if (m) {
    const s = pos - m[1].length - 1;
    inp.value = v.slice(0, s) + ins + v.slice(pos);
  } else {
    inp.value = v + (v && !/\s$/.test(v) ? ' ' : '') + ins;
  }
  const s0 = curRoom();
  const mm = s0 ? (s0.members || []).find((x) => x.id === id || (x.userId && 'u:' + x.userId === id)) : null;
  S.chat.mentions.set(mm ? memberKey(mm) : id, mm ? memberKey(mm) : id);
  renderMentionTags();
  inp.focus();
  const end = inp.value.length;
  try {
    inp.setSelectionRange(end, end);
  } catch {
    /* 忽略 */
  }
}

function renderMentionTags() {
  if (!el.mentionTags) return;
  const room = curRoom();
  const members = (room && room.members ? room.members : []);
  const text = (el.chatInput && el.chatInput.value) || '';
  // 文字里已经把 @某人 删掉了，提示就跟着消失（不能只看 Map）
  for (const id of [...S.chat.mentions.keys()]) {
    const mm = members.find((x) => x.id === id);
    if (!mm || !text.includes('@' + mm.name)) S.chat.mentions.delete(id);
  }
  const names = members.filter((x) => S.chat.mentions.has(x.id)).map((x) => x.name);
  if (!names.length) {
    el.mentionTags.classList.add('hidden');
    el.mentionTags.innerHTML = '';
    return;
  }
  el.mentionTags.classList.remove('hidden');
  el.mentionTags.innerHTML = names
    .map((n) => '<span class="mtag">@' + esc(n) + '</span>')
    .join('');
}

/* 退格 / 删除：把 @某人 当成一整段，一次删干净 */
function mentionSpanAt(v, pos) {
  const room = curRoom();
  const members = (room && room.members ? room.members : []);
  let best = null;
  for (const id of S.chat.mentions.keys()) {
    const mm = members.find((x) => x.id === id);
    if (!mm) continue;
    const tok = '@' + mm.name;
    const at = v.lastIndexOf(tok, Math.max(0, pos - 1));
    if (at < 0) continue;
    const end = at + tok.length;
    // 光标落在 @名字 之内，或者紧跟在它后面（含那个尾随空格）
    if (pos >= at && pos <= end + 1) {
      const stop = v[end] === ' ' ? end + 1 : end;
      if (!best || at > best.start) best = { start: at, end: stop };
    }
  }
  return best;
}

function deleteMentionWhole() {
  const inp = el.chatInput;
  if (!inp || !S.chat.mentions.size) return false;
  const v = inp.value || '';
  const a = inp.selectionStart;
  const b = inp.selectionEnd;
  if (a == null || a !== b) return false;
  const span = mentionSpanAt(v, a);
  if (!span) return false;
  inp.value = v.slice(0, span.start) + v.slice(span.end);
  try {
    inp.setSelectionRange(span.start, span.start);
  } catch {
    /* 忽略 */
  }
  renderMentionTags();
  return true;
}

function sendNudge(id) {
  const room = curRoom();
  if (!room || !id) return;
  chatPost('nudge', '', null, null, [id]);
}

/* ---------------------------------------------------------- 引用回复 */

function replyTextOf(m) {
  const t = String((m && m.text) || '')
    .replace(/\[\[st:[^\]]*\]\]/g, '[表情]')
    .replace(/\s+/g, ' ')
    .trim();
  if (t) return t;
  if (m && (m.kind === 'image' || m.kind === 'sticker')) return '[图片]';
  return '';
}

function setReply(m) {
  if (!m) return;
  const room = curRoom();
  const mine = room && m.deviceId === room.deviceId;
  S.chat.reply = {
    id: m.id || m.clientId || '',
    name: mine ? '我' : m.deviceName || '某人',
    text: replyTextOf(m)
  };
  renderReplyBar();
  el.chatInput.focus();
}

function clearReply() {
  S.chat.reply = null;
  renderReplyBar();
}

function renderReplyBar() {
  if (!el.replyBar) return;
  const r = S.chat.reply;
  if (!r) {
    el.replyBar.classList.add('hidden');
    el.replyBar.innerHTML = '';
    return;
  }
  el.replyBar.classList.remove('hidden');
  el.replyBar.innerHTML =
    '<span class="reply-ic"><svg class="ic"><use href="#i-quote" /></svg></span>' +
    '<span class="reply-main"><b>' + esc(r.name) + '</b>' + esc(r.text || '[图片]') + '</span>' +
    '<button class="reply-x" data-act="reply-cancel" title="取消回复"><svg class="ic"><use href="#i-x" /></svg></button>';
}

function chatJumpTo(id) {
  if (!id) return;
  const node = el.chatMsgs.querySelector('.msg[data-mid="' + String(id).replace(/"/g, '') + '"]');
  if (!node) {
    toast('原消息不在当前显示范围内（只保留最近 80 条）', true);
    return;
  }
  node.scrollIntoView({ block: 'center', behavior: 'smooth' });
  node.classList.remove('flash');
  void node.offsetWidth;
  node.classList.add('flash');
  setTimeout(() => node.classList.remove('flash'), 1500);
}

/* ---------------------------------------------------------- 表情包（房间共享） */

async function chatAddSticker(mediaId, name) {
  const room = curRoom();
  if (!room || !mediaId) {
    toast('先加入一个频道', true);
    return false;
  }
  const r = await chatFetch('/api/rooms/' + encodeURIComponent(room.roomId) + '/stickers', {
    method: 'POST',
    body: { deviceId: room.deviceId, token: room.token, mediaId, name: name || '' }
  });
  if (!r.ok) {
    toast(chatErrText(r), true);
    return false;
  }
  if (Array.isArray(r.data.stickers)) room.stickers = r.data.stickers;
  rememberRoomStickers(room);
  renderEmojiPop();
  toast(r.data.duplicated ? '这张图已经在表情包里了' : '已添加到表情包');
  return true;
}

async function chatRemoveSticker(id) {
  const room = curRoom();
  if (!room || !id) return false;
  const r = await chatFetch('/api/rooms/' + encodeURIComponent(room.roomId) + '/stickers/' +
    encodeURIComponent(id) + '/remove', {
    method: 'POST',
    body: { deviceId: room.deviceId, token: room.token }
  });
  if (!r.ok) {
    toast(chatErrText(r), true);
    return false;
  }
  if (Array.isArray(r.data.stickers)) room.stickers = r.data.stickers;
  rememberRoomStickers(room);
  renderEmojiPop();
  toast('已从表情包移除');
  return true;
}

/* ------------------------------------------------ 待发表情包（和文字一起发） */

function pendingStickers() {
  if (!Array.isArray(S.chat.pending)) S.chat.pending = [];
  return S.chat.pending;
}

function renderPending() {
  const bar = el.pendingBar;
  if (!bar) return;
  const list = pendingStickers();
  if (!list.length) {
    bar.classList.add('hidden');
    bar.innerHTML = '';
    return;
  }
  bar.classList.remove('hidden');
  bar.innerHTML =
    list
      .map(
        (p, i) =>
          '<span class="p-item"><img src="' + esc(chatAbs(p.thumb || p.url)) + '" alt="" />' +
          '<i class="p-del" data-pending-del="' + i + '" title="移除">×</i></span>'
      )
      .join('') + '<span class="p-tip">会跟着文字一起发出去</span>';
}

function addPendingSticker(st) {
  if (!st) return;
  const list = pendingStickers();
  if (list.length >= 4) {
    toast('一条消息最多带 4 个表情', true);
    return;
  }
  list.push({ mediaId: st.mediaId, url: st.url, thumb: st.thumb || st.url });
  rememberSticker(st.mediaId, st.url);
  renderPending();
  el.chatInput.focus();
}

function clearPending() {
  S.chat.pending = [];
  renderPending();
}

/** 表情包里点一下：放进待发区，跟文字一起发（不再立即单独发送） */
function chatSendSticker(st) {
  addPendingSticker(st);
  chatToggleEmoji(false);
}

// 大图先压一下：手机截图动辄 10~20MB，直接传会让对方等很久，甚至传到一半超时
async function shrinkImage(file) {
  const type = file.type || '';
  if (!/^image\//i.test(type) || /gif|svg/i.test(type)) return file;
  if (file.size < 3 * 1024 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file);
    const max = 2400;
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const big = file.size > 8 * 1024 * 1024;
    if (scale > 0.999 && !big) {
      if (bmp.close) bmp.close();
      return file;
    }
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    cv.getContext('2d').drawImage(bmp, 0, 0, w, h);
    if (bmp.close) bmp.close();
    const blob = await new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.86));
    if (!blob || blob.size >= file.size) return file;
    const name = (file.name || 'image').replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  } catch {
    return file; // 解不开就按原文件发，别让功能因此失败
  }
}

async function chatSendFile(file) {
  const room = curRoom();
  if (!file || !room) return false;
  if (file.size > 30 * 1024 * 1024) {
    toast('图片超过 30MB，换一张吧', true);
    return false;
  }
  const IMG_RE = /^image\//i;
  const EXT_RE = /\.(png|jpe?g|gif|webp|avif|bmp|heic|heif|ico)$/i;
  if (!IMG_RE.test(file.type) && !EXT_RE.test(file.name || '')) {
    toast('只能发送图片 / GIF / 动图', true);
    return false;
  }
  toast('正在上传图片…');
  file = await shrinkImage(file);
  // 有些格式（heic/heif）拿不到 mime，按扩展名补一个
  const type = IMG_RE.test(file.type)
    ? file.type
    : /\.(heic|heif)$/i.test(file.name || '')
      ? 'image/heic'
      : 'image/png';
  toast('正在上传图片…');
  try {
    const buf = await file.arrayBuffer();
    const res = await fetch(CHAT_API + '/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': type },
      body: buf
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast('图片上传失败', true);
      return false;
    }
    const mediaId = data.mediaId || data.id;
    // 服务器已经等 !default 缩略图生成好才回包，这里把 thumb 一起带出去，
    // 对方收到消息时通知条里就有小图
    const ok = await chatPost('image', '', mediaId, data.thumb || data.url);
    if (ok) {
      const last = room.messages[room.messages.length - 1];
      if (last && !last.url) last.url = data.url || '/island/media/' + mediaId + '.png';
      if (room === curRoom() && S.tab === 'chat') {
        renderChatMsgs();
        chatScrollToEnd(true);
      }
    }
    return ok;
  } catch {
    toast('图片发送失败', true);
    return false;
  }
}

function chatToggleEmoji(force) {
  const pop = el.emojiPop;
  const want = force === undefined ? pop.classList.contains('hidden') : !!force;
  pop.classList.toggle('hidden', !want);
  if (want) {
    S.emojiTab = S.emojiTab || 'emoji';
    renderEmojiPop();
  }
}

/** 表情面板：表情（字符）+ 表情包（房间共享的图片，类似微信收藏表情） */
function renderEmojiPop() {
  const pop = el.emojiPop;
  if (!pop) return;
  const tab = S.emojiTab || 'emoji';
  const room = curRoom();
  const stickers = (room && room.stickers) || [];
  const head =
    '<div class="emoji-tabs">' +
    '<button type="button" class="emoji-tab' + (tab === 'emoji' ? ' active' : '') +
    '" data-emoji-tab="emoji" title="Emoji 表情"><svg class="ic"><use href="#i-smile" /></svg></button>' +
    '<button type="button" class="emoji-tab' + (tab === 'sticker' ? ' active' : '') +
    '" data-emoji-tab="sticker" title="自定义表情包"><svg class="ic"><use href="#i-heart" /></svg>' +
    (stickers.length ? '<b class="et-count">' + stickers.length + '</b>' : '') +
    '</button>' +
    '</div>';
  let body;
  if (tab === 'sticker') {
    body = stickers.length
      ? '<div class="sticker-grid">' +
        stickers
          .map(
            (s) =>
              '<button type="button" class="sticker-cell" data-sticker="' + esc(s.id) + '" title="' +
              esc(s.name || '表情') + '">' +
              '<img src="' + esc(chatAbs(s.thumb || s.url)) + '" alt="" />' +
              '<i class="sticker-del" data-sticker-del="' + esc(s.id) + '" title="从表情包移除">×</i>' +
              '</button>'
          )
          .join('') +
        '</div>'
      : '<div class="sticker-empty">还没有表情包<br /><span>右键聊天里的图片 →「添加到表情包」，群里所有人都能用</span></div>';
  } else {
    body = '<div class="emoji-grid">' + EMOJIS.map((e) => '<button type="button" data-emoji="' + e + '">' + e + '</button>').join('') + '</div>';
  }
  pop.innerHTML = head + body;
}

function chatBind() {
  if (!el.chatGate) return;
  el.chatCreate.addEventListener('click', chatCreate);
  el.chatJoin.addEventListener('click', chatJoin);
  el.chatCode.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      chatJoin();
    }
  });
  el.chatName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      el.chatCode.focus();
    }
  });
  el.chatInput.addEventListener('keydown', (e) => {
    if ((e.key === 'Backspace' || e.key === 'Delete') && !e.isComposing && deleteMentionWhole()) {
      e.preventDefault();
      return;
    }
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      chatSendText();
    }
    if (e.key === 'Escape') {
      chatToggleEmoji(false);
      el.chatInput.blur();
    }
  });
  // 打字时：@ 打头就把成员列表拉出来（按已输入的字过滤），删掉 @ 就收起
  el.chatInput.addEventListener('input', () => {
    renderMentionTags();
    const q = mentionQuery();
    if (q) openPick('at', q.q);
    else if (S.pickMode === 'at' && el.pickPop && !el.pickPop.classList.contains('hidden')) closePick();
  });
  el.chatInput.addEventListener('paste', (e) => {
    const items = (e.clipboardData && e.clipboardData.items) || [];
    for (const it of items) {
      if (it.kind === 'file' && /^image\//.test(it.type)) {
        e.preventDefault();
        chatSendFile(it.getAsFile());
        return;
      }
    }
  });
  el.chatFile.addEventListener('change', () => {
    const f = el.chatFile.files && el.chatFile.files[0];
    el.chatFile.value = '';
    S.pickUntil = 0;
    if (f) chatSendFile(f);
  });
  el.emojiPop.addEventListener('click', (e) => {
    // 面板内部点击一律不外传：renderEmojiPop() 会重建 innerHTML，
    // 冒泡到 document 时 e.target 已经脱离文档，"点了别处"的判断就会误关面板
    e.stopPropagation();
    const tabBtn = e.target.closest('[data-emoji-tab]');
    if (tabBtn) {
      S.emojiTab = tabBtn.dataset.emojiTab;
      renderEmojiPop();
      return;
    }
    const del = e.target.closest('[data-sticker-del]');
    if (del) {
      e.stopPropagation();
      const room = curRoom();
      const st = ((room && room.stickers) || []).find((s) => String(s.id) === del.dataset.stickerDel);
      if (st && confirm('从表情包里移除「' + (st.name || '这张图') + '」？')) chatRemoveSticker(st.id);
      return;
    }
    const st = e.target.closest('[data-sticker]');
    if (st) {
      const room = curRoom();
      const item = ((room && room.stickers) || []).find((s) => String(s.id) === st.dataset.sticker);
      if (item) chatSendSticker(item);
      return;
    }
    const b = e.target.closest('[data-emoji]');
    if (!b) return;
    el.chatInput.value += b.dataset.emoji;
    el.chatInput.focus();
  });
  el.pickPop.addEventListener('click', (e) => {
    e.stopPropagation();
    const b = e.target.closest('[data-pick]');
    if (!b) return;
    const name = b.dataset.name || '';
    if (b.dataset.pick === 'nudge') {
      sendNudge(b.dataset.id);
      toast('已经拍了拍 ' + name);
    } else {
      addMention(name, b.dataset.id);
    }
    closePick();
  });
  el.chatMsgs.addEventListener('click', (e) => {
    const jump = e.target.closest('[data-jump]');
    if (jump) {
      chatJumpTo(jump.dataset.jump);
      return;
    }
    const img = e.target.closest('[data-img]');
    if (img) openLightbox(img.dataset.img);
  });
  // 双击成员名字 = 拍一拍（不再单独放按钮）
  el.chatMembers.addEventListener('dblclick', (e) => {
    const m = e.target.closest('.member');
    if (!m || m.classList.contains('me')) return;
    const id = m.dataset.dev;
    if (!id) return;
    const name = (m.querySelector('span') && m.querySelector('span').textContent) || '对方';
    sendNudge(id);
    toast('你拍了拍 ' + name);
  });
  // 待发表情包：点小叉移除
  el.pendingBar.addEventListener('click', (e) => {
    e.stopPropagation();
    const del = e.target.closest('[data-pending-del]');
    if (!del) return;
    const i = Number(del.dataset.pendingDel);
    if (Number.isInteger(i) && i >= 0) {
      pendingStickers().splice(i, 1);
      renderPending();
    }
  });
  // 聊天消息右键：文本出「复制」，图片出「查看大图 / 添加到表情包」
  el.chatMsgs.addEventListener('contextmenu', (e) => {
    const img = e.target.closest('[data-img]');
    const room = curRoom();
    const all = (room && room.messages) || [];
    if (img) {
      e.preventDefault();
      const src = img.dataset.img;
      let hit = all.find((m) => m.url && chatAbs(m.url) === src);
      if (!hit) {
        // 文字 + 表情混排的气泡里右键：从标记里把 mediaId 找回来
        for (const m of all) {
          const seg = tokenizeStickers(m.text).find((p) => p.img && chatAbs(p.img) === src);
          if (seg) {
            hit = { url: seg.img, mediaId: seg.mediaId };
            break;
          }
        }
      }
      openMsgMenu(e.clientX, e.clientY, hit || { url: src, mediaId: null });
      return;
    }
    const bub = e.target.closest('.bub');
    if (!bub || !el.chatMsgs.contains(bub)) return;
    // 找到自己这条消息（混排里可能夹着表情图）
    const msgEl = bub.closest('.msg');
    const nodes = Array.from(el.chatMsgs.querySelectorAll('.msg'));
    const idx = msgEl ? nodes.indexOf(msgEl) : -1;
    const list = all.length > 80 ? all.slice(-80) : all;
    const hit = idx >= 0 ? list[idx] : null;
    if (!hit || !String(hit.text || '').trim()) return;
    e.preventDefault();
    openMsgMenu(e.clientX, e.clientY, hit);
  });
  // 缩略图（!default）还没被 CDN 处理完时会 404，回落到原图；原图也失败就留一个占位提示
  el.chatMsgs.addEventListener(
    'error',
    (e) => {
      const img = e.target;
      if (!img || img.tagName !== 'IMG') return;
      const full = img.dataset.full || img.dataset.img || '';
      if (full && img.src !== full) {
        img.src = full;
        return;
      }
      img.classList.add('img-fail');
      img.alt = '图片加载失败';
    },
    true
  );
  el.msgMenu.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const msg = S.msgMenu;
    const act = b.dataset.act;
    closeMsgMenu();
    if (!msg) return;
    if (act === 'msg-view') openLightbox(chatAbs(msg.url));
    else if (act === 'msg-fav') chatAddSticker(msg.mediaId, '');
    else if (act === 'msg-reply') setReply(msg);
    else if (act === 'msg-copy' || act === 'msg-copy-all') {
      const text = act === 'msg-copy' ? chatSelection() : String(msg.text || '');
      if (!text) {
        toast('先用鼠标拖选要复制的文字', true);
        return;
      }
      const r = await api.clips.writeText(text);
      toast(r && r.ok ? '已复制到剪贴板' : '复制失败', !(r && r.ok));
    } else if (act === 'msg-open-link') {
      const hit = String(msg.text || '').match(LINK_RE);
      if (hit) api.app.openExternal(hit[0]);
    }
  });
  // 备忘录右键菜单的点击由全局 [data-act] 委托统一处理（菜单自己带 data-id）

  // 预览遮罩：点空白关闭 / 右键出菜单 / 按钮
  el.lightbox.addEventListener('click', (e) => {
    if (e.target === el.lightbox || e.target === el.lbStage) closeLightbox();
  });
  el.lbImg.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    lbShowMenu(e.clientX, e.clientY);
  });
  document.addEventListener('click', (e) => {
    if (el.msgMenu && !el.msgMenu.classList.contains('hidden') && !e.target.closest('#msgMenu')) closeMsgMenu();
    if (el.noteMenu && !el.noteMenu.classList.contains('hidden') && !e.target.closest('#noteMenu')) closeNoteMenu();
    if (el.editMenu && !el.editMenu.classList.contains('hidden') && !e.target.closest('#editMenu')) closeEditMenu();
    if (
      el.shareHist &&
      !el.shareHist.classList.contains('hidden') &&
      !e.target.closest('#shareHist') &&
      !e.target.closest('[data-act="cp-friend"]') &&
      !e.target.closest('[data-act="cp-hist"]')
    )
      closeShareHist();
    if (
      el.sharePop &&
      !el.sharePop.classList.contains('hidden') &&
      !e.target.closest('#sharePop') &&
      !e.target.closest('[data-act="note-share"]')
    )
      closeSharePop();
    if (el.lbMenu.classList.contains('hidden')) return;
    if (!e.target.closest('#lbMenu') && !e.target.closest('#lbImg')) el.lbMenu.classList.add('hidden');
  });
  // 大图：滚轮缩放（以鼠标为锚点）+ 拖拽平移 + 双击切换 100% / 200%
  if (el.lbStage) {
    el.lbStage.addEventListener(
      'wheel',
      (e) => {
        if (el.lightbox.classList.contains('hidden')) return;
        e.preventDefault();
        lbZoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12);
      },
      { passive: false }
    );
    el.lbStage.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      lb.drag = { x: e.clientX - lb.x, y: e.clientY - lb.y };
      el.lbImg.classList.add('dragging');
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!lb.drag) return;
      lb.x = e.clientX - lb.drag.x;
      lb.y = e.clientY - lb.drag.y;
      lbApply();
    });
    window.addEventListener('mouseup', () => {
      if (!lb.drag) return;
      lb.drag = null;
      el.lbImg.classList.remove('dragging');
    });
    el.lbStage.addEventListener('dblclick', () => {
      if (lb.z > 1.02) lbReset();
      else {
        lb.z = 2;
        lbApply();
      }
    });
  }
  el.chatRoom.addEventListener('dragover', (e) => {
    if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
    }
  });
  el.chatRoom.addEventListener('drop', (e) => {
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f) return;
    e.preventDefault();
    e.stopPropagation();
    chatSendFile(f);
  });
  document.addEventListener('click', (e) => {
    if (el.emojiPop.classList.contains('hidden')) return;
    if (!e.target.closest('#emojiPop') && !e.target.closest('[data-act="chat-emoji"]')) chatToggleEmoji(false);
  });
  // 右键频道名 → 重命名（只存本机）
  if (el.chatRooms) {
    el.chatRooms.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.r-copy')) return;
      const chip = e.target.closest('[data-room]');
      if (!chip) return;
      e.preventDefault();
      chatRename(Number(chip.dataset.room) || 0);
    });
  }
  if (el.chatCancelNew) {
    el.chatCancelNew.addEventListener('click', () => {
      S.chat.adding = false;
      chatShowError('');
      chatRender();
    });
  }
}

function chatInit() {
  const stored = chatLoad();
  if (stored) {
    S.chat.rooms = stored.rooms;
    S.chat.active = stored.active;
  }
  chatBind();
  bindChatResize();
  chatRender();
  S.chat.rooms.forEach((r) => chatConnect(r));
  if (!S.chat.rooms.length && el.chatName && !el.chatName.value) el.chatName.value = chatDefaultName();
}

function bindUi() {
  bindAccountUi();

  // 卫星圆点击：直接打开对应页签
  [
    [el.satMail, 'mail'],
    [el.satChat, 'chat'],
    [el.satSys, 'tools'],
    [el.timerOrb, 'tools']
  ].forEach(([node, tab]) => {
    if (!node) return;
    node.addEventListener('click', (e) => {
      e.stopPropagation();
      openPanel(tab);
    });
  });

  document.addEventListener('click', (e) => {
    const actNode = e.target.closest && e.target.closest('[data-act]');
    if (actNode) {
      e.stopPropagation();
      handleAct(actNode.dataset.act, actNode);
      return;
    }
    // 通知条：有验证码时点一下直接复制；小纸条消息点开对应频道
    if (S.mode === 'peek' && e.target.closest && e.target.closest('#viewPeek')) {
      if (S.peekCode) {
        const code = S.peekCode;
        api.clips.writeText(code).then(() => {
          toast('验证码 ' + code + ' 已复制');
          setPinned(false);
          setMode('idle');
        });
      } else if (S.peekTab === 'chat' && typeof S.peekRoom === 'number' && S.peekRoom >= 0) {
        chatSelect(S.peekRoom, false);
        openPanel('chat');
      } else {
        openPanel('mail');
      }
      return;
    }
    const tab = e.target.closest && e.target.closest('.tab');
    if (tab) {
      setTab(tab.dataset.tab);
      return;
    }
    const open = e.target.closest && e.target.closest('[data-open]');
    if (open) {
      openPanel(open.dataset.open);
      return;
    }
    const row = e.target.closest && e.target.closest('.row');
    if (row) {
      handleRow(row);
      return;
    }
    if (e.target.closest && e.target.closest('.island')) {
      if (S.suppressClick) return; // 刚拖动过，别当成点击
      if (S.mode !== 'panel') openPanel(S.tab);
    }
  });

  document.addEventListener('contextmenu', (e) => e.preventDefault());

  // 头部按钮
  $('#btnPin').addEventListener('click', (e) => {
    e.stopPropagation();
    setPinned(!S.pinned);
    if (S.pinned) toast('已固定，不会自动收起');
  });
  $('#btnCollapse').addEventListener('click', (e) => {
    e.stopPropagation();
    setPinned(false);
    setMode('idle');
  });
  el.mark.parentElement.addEventListener('click', (e) => {
    e.stopPropagation();
    openPanel('mail');
  });

  // 邮件
  el.mailRefresh.addEventListener('click', async () => {
    el.mailRefresh.classList.add('spin');
    const r = await api.mail.refresh();
    setTimeout(() => el.mailRefresh.classList.remove('spin'), 500);
    if (r && r.ok === false && r.message) toast(r.message, true);
    else if (r && r.skipped) toast('正在同步中…');
    else toast('已刷新');
  });
  const goMailSetup = () => setTab('settings');
  $('#mailToSettings').addEventListener('click', goMailSetup);
  $('#mailSetupBtn').addEventListener('click', goMailSetup);

  // 便笺 / Qing事项（M4：备忘录与待办合成一个入口）
  const paintNoteType = () => {
    const box = $('#noteType');
    if (!box) return;
    for (const b of box.querySelectorAll('.nt-chip')) {
      const on = b.dataset.noteType === S.noteType;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    }
    if (el.noteInput) {
      el.noteInput.placeholder = S.noteType === 'todo' ? '要做点什么… Ctrl+Enter 保存' : '记点什么… Ctrl+Enter 保存';
    }
  };
  const saveNote = async () => {
    const t = el.noteInput.value.trim();
    if (!t) return;
    const kind = S.noteType === 'todo' ? 'todo' : 'note';
    const r = await api.notes.add(t, kind);
    el.noteInput.value = '';
    el.noteInput.style.height = 'auto';
    if (kind === 'todo' && r && r.note) {
      try {
        await api.notes.togglePin(r.note.id);
      } catch (_) {}
      toast('待办已建好，并钉到桌面右上角');
    } else {
      toast('已保存');
    }
  };
  $('#noteType')?.addEventListener('click', (e) => {
    const b = e.target.closest('.nt-chip');
    if (!b) return;
    S.noteType = b.dataset.noteType === 'todo' ? 'todo' : 'note';
    paintNoteType();
  });
  paintNoteType();
  $('#noteSave').addEventListener('click', saveNote);
  el.noteInput.addEventListener('input', () => {
    el.noteInput.style.height = 'auto';
    el.noteInput.style.height = Math.min(96, el.noteInput.scrollHeight) + 'px';
  });
  el.noteInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      saveNote();
    } else if (e.key === 'Escape') {
      el.noteInput.blur();
    }
  });

  // 剪贴板
  el.clipSearch.addEventListener('input', () => {
    S.clipQuery = el.clipSearch.value;
    renderClips();
  });
  el.clipSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      el.clipSearch.value = '';
      S.clipQuery = '';
      renderClips();
      el.clipSearch.blur();
    }
  });
  $('#clipClear').addEventListener('click', () => clearClips());
  if (el.noteClear) el.noteClear.addEventListener('click', () => clearNotes());

  // 文件
  $('#filePick').addEventListener('click', async () => {
    const r = await api.files.pick();
    if (r && r.added) toast('已添加 ' + r.added + ' 个项目');
  });
  $('#filePrune').addEventListener('click', async () => {
    const r = await api.pruneFiles();
    if (!r || !r.removed) return toast('文件区很干净，没有失效项');
    toast('已清理 ' + r.removed + ' 项（失效 ' + r.gone + '，过期 ' + r.aged + '）');
  });
  $('#fileClear').addEventListener('click', async () => {
    await api.files.clear();
    toast('已清空文件区');
  });
  $('#fileCopyAll').addEventListener('click', async () => {
    const ids = (S.data.files || []).map((f) => f.id);
    if (!ids.length) return;
    const r = await api.files.copy(ids);
    toast((r && r.message) || '已复制', !(r && r.ok));
  });

  // ---- 本地文件搜索：文件名 / 文件夹名 / 内容一起搜（Everything 优先，没有就用内置扫描）
  const fsBox = () => document.getElementById('fsResults');
  const fsInputEl = () => document.getElementById('fileQuery');

  function fsMeta(it) {
    if (it.isDir) return '文件夹 · ' + (it.dir || '');
    const kind = it.content ? '内容命中' : '文件';
    return fmtSize(it.size) + ' · ' + kind + ' · ' + (it.dir || '');
  }

  function fsRowHtml(it) {
    const sel = S.fs.sel.has(it.path);
    const line = it.line ? '<span class="fs-line">' + esc(String(it.line).trim().slice(0, 90)) + '</span>' : '';
    return (
      '<div class="fs-row' +
      (sel ? ' sel' : '') +
      '" data-path="' +
      esc(it.path) +
      '">' +
      '<span class="fs-check' +
      (sel ? ' on' : '') +
      '" data-fs-check="1" role="checkbox" aria-checked="' +
      sel +
      '"><svg class="ic"><use href="#i-check"/></svg></span>' +
      '<span class="fs-name">' +
      esc(it.name) +
      '</span><span class="fs-meta">' +
      esc(fsMeta(it)) +
      '</span>' +
      line +
      '</div>'
    );
  }

  function renderFsResults() {
    const box = fsBox();
    if (!box) return;
    if (!S.fs.items.length) {
      if (S.fs.q) {
        box.classList.remove('hidden');
        box.innerHTML =
          '<div class="fs-head"><span class="fs-info">没有找到「' +
          esc(S.fs.q) +
          '」</span><span class="grow"></span>' +
          '<button class="icon-btn" data-fs-act="close" title="收起结果"><svg class="ic"><use href="#i-x"/></svg></button></div>' +
          '<div class="fs-tip">内置扫描只看桌面 / 文档 / 下载；要搜整台电脑，装一个 <b>Everything</b> 并打开它的 HTTP 服务（默认 127.0.0.1:8010），这里会自动用上。</div>';
        nudgeRect(1200);
      } else {
        box.classList.add('hidden');
        box.innerHTML = '';
      }
      return;
    }
    box.classList.remove('hidden');
    const n = S.fs.sel.size;
    const head =
      '<div class="fs-head"><span class="fs-info">' +
      S.fs.items.length +
      ' 条 · ' +
      (S.fs.engine === 'everything' ? 'Everything' : S.fs.wide ? '全盘浅扫' : '内置扫描') +
      (n ? ' · 已选 ' + n : '') +
      '</span><span class="grow"></span>' +
      '<button class="btn ghost small" data-fs-act="stash">发送到文件区</button>' +
      '<button class="btn ghost small" data-fs-act="all">全选</button>' +
      '<button class="icon-btn" data-fs-act="close" title="收起结果"><svg class="ic"><use href="#i-x"/></svg></button></div>';
    box.innerHTML = head + S.fs.items.map(fsRowHtml).join('') + '<div class="fs-hint">点前面的方框多选，也可以在空白处按住左键划框，再右键「发送到文件区」</div>';
    nudgeRect(1200);
  }

  async function runFsSearch() {
    const q = (fsInputEl() && fsInputEl().value.trim()) || '';
    if (!q) {
      S.fs.q = '';
      S.fs.items = [];
      S.fs.sel.clear();
      renderFsResults();
      return;
    }
    S.fs.q = q;
    const box = fsBox();
    if (box) {
      box.classList.remove('hidden');
      box.innerHTML = '<div class="fs-head"><span class="fs-info">正在搜索「' + esc(q) + '」…</span></div>';
      nudgeRect(1200);
    }
    const nameR = await api.files.search(q, { mode: 'name', limit: 40 });
    let items = ((nameR && nameR.results) || []).map((it) => Object.assign({}, it));
    S.fs.engine = (nameR && nameR.engine) || '';
    S.fs.wide = !!(nameR && nameR.wide);
    // 文件名命中的不多时，再补一轮「内容命中」，两种结果合并显示
    if (items.length < 6 && q.length >= 2) {
      const contentR = await api.files.search(q, { mode: 'content', limit: 20 });
      const seen = new Set(items.map((x) => x.path));
      for (const it of (contentR && contentR.results) || []) {
        if (seen.has(it.path)) continue;
        seen.add(it.path);
        items.push(Object.assign({}, it, { content: true }));
      }
    }
    S.fs.items = items;
    S.fs.sel.clear();
    renderFsResults();
    if (nameR && !nameR.ok) toast((nameR && nameR.message) || '搜索失败', true);
  }

  // 把选中的搜索结果放进文件区；内容命中的文件顺手把正文放进剪贴板
  async function stashSearch(list) {
    const items = list && list.length ? list : S.fs.items.filter((it) => S.fs.sel.has(it.path));
    if (!items.length) return toast('先勾选几条结果，或者在空白处划框多选');
    const paths = items.map((it) => it.path);
    const r = await api.files.add(paths);
    const texty = items.find((it) => !it.isDir && it.content);
    if (texty) {
      const t = await api.files.readText(texty.path);
      if (t && t.ok) await api.clips.writeText(t.text);
    }
    toast('已发送 ' + ((r && r.added) || paths.length) + ' 项到文件区' + (texty ? '，命中文件的内容已复制' : ''));
    S.fs.sel.clear();
    renderFsResults();
    openPanel('files', true);
  }

  function fsPaintSelection() {
    const box = fsBox();
    if (!box) return;
    box.querySelectorAll('.fs-row').forEach((row) => {
      const on = S.fs.sel.has(row.dataset.path);
      row.classList.toggle('sel', on);
      const ck = row.querySelector('.fs-check');
      if (ck) {
        ck.classList.toggle('on', on);
        ck.setAttribute('aria-checked', String(on));
      }
    });
    const info = box.querySelector('.fs-info');
    if (info && !info.dataset.fixed) {
      const n = S.fs.sel.size;
      info.textContent = S.fs.items.length + ' 条 · ' + (S.fs.engine === 'everything' ? 'Everything' : S.fs.wide ? '全盘浅扫' : '内置扫描') + (n ? ' · 已选 ' + n : '');
    }
  }

  if (fsInputEl()) {
    fsInputEl().addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        runFsSearch();
      } else if (e.key === 'Escape') {
        S.fs.q = '';
        S.fs.items = [];
        S.fs.sel.clear();
        renderFsResults();
        fsInputEl().blur();
      }
    });
  }
  const fsClearBtn = document.getElementById('fsClear');
  if (fsClearBtn) {
    fsClearBtn.addEventListener('click', () => {
      if (fsInputEl()) fsInputEl().value = '';
      S.fs.q = '';
      S.fs.items = [];
      S.fs.sel.clear();
      renderFsResults();
      if (fsInputEl()) fsInputEl().focus();
    });
  }

  const fsRes = fsBox();
  if (fsRes) {
    fsRes.addEventListener('click', (e) => {
      const act = e.target.closest('[data-fs-act]');
      if (act) {
        const what = act.dataset.fsAct;
        if (what === 'close') {
          S.fs.q = '';
          S.fs.items = [];
          S.fs.sel.clear();
          renderFsResults();
        } else if (what === 'stash') stashSearch();
        else if (what === 'all') {
          S.fs.items.forEach((it) => S.fs.sel.add(it.path));
          fsPaintSelection();
        } else if (what === 'none') {
          S.fs.sel.clear();
          fsPaintSelection();
        }
        return;
      }
      const row = e.target.closest('.fs-row');
      if (!row) return;
      const p = row.dataset.path;
      if (S.fs.sel.has(p)) S.fs.sel.delete(p);
      else S.fs.sel.add(p);
      fsPaintSelection();
    });
    fsRes.addEventListener('dblclick', (e) => {
      const row = e.target.closest('.fs-row');
      if (!row) return;
      const item = S.fs.items.find((it) => it.path === row.dataset.path);
      if (item) stashSearch([item]);
    });
    // 空白处按住左键划框多选
    fsRes.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('.fs-check') || e.target.closest('[data-fs-act]') || e.target.closest('.fs-row')) return;
      const boxRect = fsRes.getBoundingClientRect();
      const band = document.createElement('div');
      band.className = 'fs-marquee';
      fsRes.appendChild(band);
      const add = e.ctrlKey || e.metaKey || e.shiftKey;
      const base = add ? new Set(S.fs.sel) : new Set();
      if (!add) S.fs.sel.clear();
      const startX = e.clientX;
      const startY = e.clientY;
      let moved = false;
      const onMove = (ev) => {
        const x = Math.min(startX, ev.clientX);
        const y = Math.min(startY, ev.clientY);
        const w = Math.abs(ev.clientX - startX);
        const h = Math.abs(ev.clientY - startY);
        if (w + h > 4) moved = true;
        band.style.display = moved ? 'block' : 'none';
        band.style.left = x - boxRect.left + fsRes.scrollLeft + 'px';
        band.style.top = y - boxRect.top + fsRes.scrollTop + 'px';
        band.style.width = w + 'px';
        band.style.height = h + 'px';
        const hit = { left: x, top: y, right: x + w, bottom: y + h };
        S.fs.sel = new Set(base);
        fsRes.querySelectorAll('.fs-row').forEach((row) => {
          const r = row.getBoundingClientRect();
          const overlap = r.left < hit.right && r.right > hit.left && r.top < hit.bottom && r.bottom > hit.top;
          if (overlap) S.fs.sel.add(row.dataset.path);
        });
        fsPaintSelection();
      };
      const onUp = () => {
        band.remove();
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      e.preventDefault();
    });
    fsRes.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const row = e.target.closest('.fs-row');
      if (row && !S.fs.sel.has(row.dataset.path)) {
        S.fs.sel.add(row.dataset.path);
        fsPaintSelection();
      }
      fsShowMenu(e.clientX, e.clientY);
    });
  }

  const fsMenuNode = document.getElementById('fsMenu');
  function fsShowMenu(x, y) {
    if (!fsMenuNode) return;
    fsMenuNode.classList.remove('hidden');
    const r = fsMenuNode.getBoundingClientRect();
    const left = Math.min(x, window.innerWidth - r.width - 8);
    const top = Math.min(y, window.innerHeight - r.height - 8);
    fsMenuNode.style.left = Math.max(8, left) + 'px';
    fsMenuNode.style.top = Math.max(8, top) + 'px';
    nudgeRect(1200);
  }
  function fsHideMenu() {
    if (fsMenuNode) fsMenuNode.classList.add('hidden');
  }
  if (fsMenuNode) {
    fsMenuNode.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-fs-act]');
      if (!btn) return;
      const what = btn.dataset.fsAct;
      fsHideMenu();
      if (what === 'stash') stashSearch();
      else if (what === 'all') {
        S.fs.items.forEach((it) => S.fs.sel.add(it.path));
        fsPaintSelection();
      } else if (what === 'none') {
        S.fs.sel.clear();
        fsPaintSelection();
      }
    });
  }
  document.addEventListener('pointerdown', (e) => {
    if (fsMenuNode && !fsMenuNode.classList.contains('hidden') && !e.target.closest('#fsMenu')) fsHideMenu();
  }, true);

  // 文件拖出
  el.fileList.addEventListener('dragstart', (e) => {
    const row = e.target.closest && e.target.closest('.row.file');
    if (!row) return;
    e.preventDefault();
    api.files.dragOut(row.dataset.id);
  });

  // 设置
  el.setAutoStart.addEventListener('change', async () => {
    const r = await api.settings.save({ autoStart: el.setAutoStart.checked });
    if (r && typeof r.autoStart === 'boolean') {
      el.setAutoStart.checked = r.autoStart;
      toast(r.autoStart ? '已开启开机自启' : '已关闭开机自启');
    }
  });
  el.setNotify.addEventListener('change', () => api.settings.save({ notifyMail: el.setNotify.checked }));
  el.setClip.addEventListener('change', () => api.settings.save({ clipEnabled: el.setClip.checked }));
  el.setPoll.addEventListener('change', () => {
    api.settings.save({ pollMinutes: Number(el.setPoll.value) });
    toast('检查间隔已更新');
  });
  $('#accentRow').addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('.swatch');
    if (!b || !b.dataset.accent) return;
    applyAccent(b.dataset.accent);
    api.settings.save({ accent: b.dataset.accent });
  });

  $('#themeSeg').addEventListener('click', (e) => {
    const b = e.target.closest('.seg-btn');
    if (!b) return;
    applyTheme(b.dataset.theme);
    api.settings.save({ theme: b.dataset.theme });
    toast(b.dataset.theme === 'light' ? '已切换到浅色基调' : '已切换到深色基调');
  });

  const styleSeg = $('#styleSeg');
  if (styleSeg) {
    styleSeg.addEventListener('click', (e) => {
      const b = e.target.closest('.seg-btn');
      if (!b) return;
      applyStyle(b.dataset.style);
      api.settings.save({ style: b.dataset.style });
      toast(
        b.dataset.style === 'notch'
          ? '已切换成刘海样式：贴在屏幕最上边，鼠标靠近才伸出来'
          : '已切换成灵动岛样式'
      );
    });
  }

  // 备忘录：右键弹菜单（编辑 / 复制 / 发小纸条 / 钉桌面 / 删除）
  el.noteList.addEventListener('contextmenu', (e) => {
    const row = e.target.closest('.row.note');
    if (!row) return;
    e.preventDefault();
    openNoteMenu(e.clientX, e.clientY, row.dataset.id);
  });

  /** 富文本里光标离正文开头有多远（字符数；占位符不计） */
  function caretOffsetIn(box) {
    const sel = window.getSelection();
    if (!box || !sel || !sel.rangeCount) return null;
    const r = sel.getRangeAt(0);
    if (!box.contains(r.startContainer)) return null;
    const pre = document.createRange();
    pre.selectNodeContents(box);
    pre.setEnd(r.startContainer, r.startOffset);
    return pre.toString().replace(/\u200b/g, '').length;
  }

  /** 把光标放回富文本的第 off 个字符（off 为空就放末尾） */
  function placeCaret(box, off) {
    if (!box) return;
    const r = document.createRange();
    if (off === null || off === undefined) {
      r.selectNodeContents(box);
      r.collapse(false);
    } else {
      const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT, null);
      let left = Math.max(0, off);
      let node = walker.nextNode();
      let done = false;
      while (node) {
        const len = node.nodeValue.replace(/\u200b/g, '').length;
        if (left <= len) {
          r.setStart(node, Math.min(node.nodeValue.length, left));
          done = true;
          break;
        }
        left -= len;
        node = walker.nextNode();
      }
      if (!done) {
        r.selectNodeContents(box);
        r.collapse(false);
      } else {
        r.collapse(true);
      }
    }
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  }

  /** 正在编辑 / 刚编辑过的那条备忘录（粘贴图片时决定往哪儿插） */
  function activeNoteId() {
    return S.noteEdit || S.noteOpen || (S.noteCaret && S.noteCaret.id) || null;
  }

  // 记住最后一次落在富文本里的光标位置：点一下别处再 Ctrl+V 也能插回原位
  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const node = sel.anchorNode;
    const box = node && (node.nodeType === 1 ? node : node.parentElement);
    const rich = box && box.closest && box.closest('.note-rich');
    if (!rich || !rich.dataset.id) return;
    const off = caretOffsetIn(rich);
    if (off === null) return;
    S.noteCaret = { id: rich.dataset.id, off };
  });

  // 备忘录：粘贴图片 → 落盘后插在当前光标处（正在编辑的富文本框里）；
  // 没聚焦到富文本、但有正在编辑 / 展开的那条，就插回它记住的光标位置，别新建。
  const pasteNoteImage = async (e) => {
    const rich = e.target && e.target.closest && e.target.closest('.note-rich');
    const items = (e.clipboardData && e.clipboardData.items) || [];
    const imgItem = Array.from(items).find((it) => it.kind === 'file' && /^image\//.test(it.type));
    if (rich) {
      // 富文本里：图片直接插在光标后，文字按纯文本插（不走默认的 HTML 粘贴）
      if (imgItem) {
        e.preventDefault();
        e.stopPropagation();
        await insertRichImage(rich, imgItem);
        return;
      }
      const txt = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
      if (txt) {
        e.preventDefault();
        document.execCommand('insertText', false, txt);
      }
      return;
    }
    if (!imgItem) return;
    e.preventDefault();
    e.stopPropagation();
    const file = imgItem.getAsFile();
    if (!file) return;
    if (file.size > 24 * 1024 * 1024) {
      toast('图片超过 24MB，换一张吧', true);
      return;
    }
    const dataUrl = await fileToDataUrl(file).catch(() => '');
    if (!dataUrl) {
      toast('这张图读不出来', true);
      return;
    }
    const saved = await api.notes.image({ dataUrl });
    if (!saved || !saved.ok) {
      toast((saved && saved.message) || '存图片失败', true);
      return;
    }
    const liveBox = liveNoteBox();
    // 顶部新建框里已经写了一半：图和这些字合成同一条（哪怕下面的编辑框还开着）
    if (e.target === el.noteInput && el.noteInput.value.trim()) {
      await composeNoteWithImage(saved.file, el.noteInput.value);
      return;
    }
    if (liveBox) {
      // 眼前正打开的编辑框优先：光标回到上次的位置，图就插在那儿
      if (document.activeElement !== liveBox) {
        liveBox.focus({ preventScroll: true });
        const same = S.noteCaret && S.noteCaret.id === liveBox.dataset.id;
        placeCaret(liveBox, same ? S.noteCaret.off : null);
      }
      await insertRichImageData(liveBox, dataUrl, saved);
      return;
    }
    const targetId = activeNoteId();
    if (targetId && (S.data.notes || []).some((n) => n.id === targetId)) {
      // 有正在编辑（或刚展开）的那条：插回它记住的位置，绝不另起一条
      await insertImageIntoNote(targetId, dataUrl, saved);
      return;
    }
    if (el.noteInput && el.noteInput.value.trim()) {
      // 顶部新建框里已经写了一半：图和这些字合成同一条，别拆成两条
      await composeNoteWithImage(saved.file, el.noteInput.value);
      return;
    }
    const r = await api.notes.add(noteToken(saved.file));
    if (el.noteInput) el.noteInput.value = '';
    if (!r || !r.ok) toast((r && r.message) || '存图片失败', true);
  };

  /** 把「新建框里正在写的字 + 这张图」合成同一条备忘录，并直接进入编辑态 */
  async function composeNoteWithImage(file, text) {
    const body = String(text).replace(/\s+$/, '') + '\n' + noteToken(file);
    const r = await api.notes.add(body);
    if (!r || !r.ok) {
      toast((r && r.message) || '存图片失败', true);
      return;
    }
    const nid = (r.note && r.note.id) || r.id;
    if (el.noteInput) el.noteInput.value = '';
    if (!nid) return;
    S.noteOpen = nid;
    S.noteEdit = nid;
    renderNotes();
    nudgeRect(900);
    setTimeout(() => {
      const box = el.noteList.querySelector('.note-rich[data-id="' + nid + '"]');
      if (box) {
        box.focus({ preventScroll: true });
        placeCaret(box, null);
      }
    }, 80);
  }

  /** 把已经落盘的一张图插进指定备忘录（必要时自动进入编辑态、恢复光标） */
  async function insertImageIntoNote(id, dataUrl, saved) {
    const note = (S.data.notes || []).find((n) => n.id === id);
    if (!note) return false;
    // 目标已经在编辑态：直接用现有节点，不重绘（重绘会丢光标、也可能丢未保存的字）
    let box = el.noteList.querySelector('.note-rich[data-id="' + id + '"]');
    if (!box) {
      flushLiveNote();
      S.noteOpen = id;
      S.noteEdit = id;
      renderNotes();
      await new Promise((r) => setTimeout(r, 40));
      box = el.noteList.querySelector('.note-rich[data-id="' + id + '"]');
    }
    if (!box) return false;
    box.focus({ preventScroll: true });
    const off = S.noteCaret && S.noteCaret.id === id ? S.noteCaret.off : null;
    placeCaret(box, off);
    await insertRichImageData(box, dataUrl, saved);
    return true;
  }

  /** 把剪贴板里的一张图存盘并插进富文本光标处，插完光标停在图片下一行 */
  async function insertRichImage(box, item) {
    const file = item && item.getAsFile && item.getAsFile();
    if (!file) return;
    return insertRichImageFromFile(box, file);
  }

  async function insertRichImageFromFile(box, file) {
    if (!file) return;
    if (file.size > 24 * 1024 * 1024) return toast('图片超过 24MB，换一张吧', true);
    const dataUrl = await fileToDataUrl(file).catch(() => '');
    if (!dataUrl) return toast('这张图读不出来', true);
    return insertRichImageData(box, dataUrl, null);
  }

  /** dataUrl → 占位符 → 落盘 → 换成图片。saved 传已有的 {ok,file} 时不再重复存 */
  async function insertRichImageData(box, dataUrl, saved) {
    if (!box || !dataUrl) return;
    // 关键：先在光标处放进一个占位符，再异步存图。
    // 存图要 await，等回来时浏览器可能已经把选区弄丢/挪到开头，位置就错了。
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !box.contains(sel.anchorNode)) {
      focusNoteEditor(box.dataset.id);
    }
    const s0 = window.getSelection();
    if (!s0 || !s0.rangeCount) return;
    const range = s0.getRangeAt(0);
    range.deleteContents();
    // 只放一个占位符：图片是块级元素，自己就会独占一行，不用再补换行，
    // 否则「图片 + 一个换行」会读出两个换行、渲染出一条空行。
    const ph = document.createTextNode('\u200b');
    range.insertNode(ph);

    if (!saved || !saved.ok) saved = await api.notes.image({ dataUrl });
    if (!saved || !saved.ok) {
      ph.parentNode && ph.parentNode.removeChild(ph);
      return toast((saved && saved.message) || '存图片失败', true);
    }
    const holder = document.createElement('div');
    holder.innerHTML = noteRichImg(saved.file);
    const img = holder.firstElementChild;
    const after = ph.nextSibling;
    if (ph.parentNode) ph.parentNode.replaceChild(img, ph);
    // 光标落到图片后面（下一行的开头）：有后面的文字就从它的开头接，
    // 没有就补一个空文本节点，等着继续打字。
    let nextNode = after;
    if (!nextNode) {
      nextNode = document.createTextNode('');
      img.parentNode.insertBefore(nextNode, img.nextSibling);
    }
    const s3 = window.getSelection();
    const c2 = document.createRange();
    try {
      if (nextNode.nodeType === 3) c2.setStart(nextNode, 0);
      else c2.setStartBefore(nextNode);
      c2.collapse(true);
      s3.removeAllRanges();
      s3.addRange(c2);
    } catch (_) {}
    box.focus({ preventScroll: true });
    const off2 = caretOffsetIn(box);
    if (off2 !== null) S.noteCaret = { id: box.dataset.id, off: off2 };
    noteDirty(box);
  }

  /** 编辑中：标记脏 + 800ms 后静默保存（防止忘点保存） */
  function noteDirty(box) {
    if (!box || !box.dataset.id) return;
    const id = box.dataset.id;
    S.noteEdit = id;
    clearTimeout(S.noteSaveT);
    S.noteSaveT = setTimeout(async () => {
      const live = el.noteList.querySelector('.note-rich[data-id="' + id + '"]');
      if (!live) return;
      const text = noteRichRead(live);
      if (!text.trim()) return;
      const cur = (S.data.notes || []).find((n) => n.id === id);
      if (cur && cur.text === text) return;
      await api.notes.update(id, text).catch(() => null);
    }, 800);
  }
  if (el.noteInput) el.noteInput.addEventListener('paste', pasteNoteImage);
  el.noteList.addEventListener('paste', pasteNoteImage);

  /** 右键菜单里的「粘贴」：图片插到光标处，文字按纯文本插 */
  const pasteFromClipboard = async (imageOnly) => {
    const got = await api.clips.readNow();
    if (!got || !got.ok) return toast((got && got.message) || '剪贴板里没有能粘贴的内容', true);
    const box = liveNoteBox();
    if (got.kind === 'image') {
      if (!got.dataUrl) return toast('这张图读不出来', true);
      const typed = el.noteInput ? el.noteInput.value : '';
      if (S.editTarget === 'input' && typed.trim()) {
        // 新建框里写了一半：图和这些字合成同一条（此时哪怕下面还开着编辑框也以新建框为准）
        const saved = await api.notes.image({ dataUrl: got.dataUrl });
        if (!saved || !saved.ok) return toast((saved && saved.message) || '存图片失败', true);
        return composeNoteWithImage(saved.file, typed);
      }
      if (box) {
        box.focus({ preventScroll: true });
        return insertRichImageData(box, got.dataUrl, null);
      }
      const saved = await api.notes.image({ dataUrl: got.dataUrl });
      if (!saved || !saved.ok) return toast((saved && saved.message) || '存图片失败', true);
      const tid = activeNoteId();
      if (tid && (S.data.notes || []).some((n) => n.id === tid)) {
        return insertImageIntoNote(tid, got.dataUrl, saved);
      }
      await api.notes.add(noteToken(saved.file));
      if (el.noteInput) el.noteInput.value = '';
      return;
    }
    if (imageOnly) return toast('剪贴板里没有图片', true);
    const txt = String(got.text || '');
    if (!txt) return toast('剪贴板里没有能粘贴的内容', true);
    if (box) {
      box.focus({ preventScroll: true });
      document.execCommand('insertText', false, txt);
      noteDirty(box);
      return;
    }
    if (el.noteInput) {
      const s = el.noteInput.selectionStart || 0;
      const v = el.noteInput.value || '';
      el.noteInput.value = v.slice(0, s) + txt + v.slice(s);
      el.noteInput.selectionStart = el.noteInput.selectionEnd = s + txt.length;
      el.noteInput.focus();
    }
  };
  S.notePaste = pasteFromClipboard;

  // 编辑框右键：剪切 / 复制 / 粘贴 / 粘贴图片 / 全选（Electron 默认没有右键菜单）
  el.noteList.addEventListener('contextmenu', (e) => {
    const rich = e.target.closest && e.target.closest('.note-rich');
    if (!rich) return;
    e.preventDefault();
    e.stopPropagation();
    closeNoteMenu();
    openEditMenu(e.clientX, e.clientY, 'rich');
  });
  if (el.noteInput) {
    el.noteInput.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openEditMenu(e.clientX, e.clientY, 'input');
    });
  }
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape') return;
      if (el.shareHist && !el.shareHist.classList.contains('hidden')) {
        e.preventDefault();
        e.stopPropagation();
        closeShareHist();
        return;
      }
      if (el.sharePop && !el.sharePop.classList.contains('hidden')) {
        e.preventDefault();
        e.stopPropagation();
        closeSharePop();
        return;
      }
      if (!el.editMenu || el.editMenu.classList.contains('hidden')) return;
      e.preventDefault();
      e.stopPropagation();
      closeEditMenu();
    },
    true
  );

  // 编辑中一边打字一边标记脏（用于自动保存），富文本里的图片点开也走大图
  el.noteList.addEventListener('input', (e) => {
    const box = e.target.closest && e.target.closest('.note-rich');
    if (box) noteDirty(box);
  });

  // 备忘录里的图片：点一下在岛内看大图（不要触发整行展开/收起）
  el.noteList.addEventListener(
    'click',
    (e) => {
      const img = e.target.closest('.note-img[data-img], .note-thumb[data-img], .note-pic[data-img]');
      if (!img) return;
      e.preventDefault();
      e.stopPropagation();
      openLightbox(img.dataset.img);
    },
    true
  );

  // 编辑框：Ctrl+Enter 保存、Esc 取消（富文本里回车只是换行）
  el.noteList.addEventListener('keydown', (e) => {
    const box = e.target.closest('.note-rich');
    if (!box) return;
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const btn = box.parentElement.querySelector('[data-act="note-save"]');
      if (btn) btn.click();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      clearTimeout(S.noteSaveT);
      S.noteEdit = null;
      renderNotes();
      nudgeRect(600);
    }
  });
  // 点进富文本时不要当成「点整行展开/收起」，同时保证滚动到底
  el.noteList.addEventListener(
    'click',
    (e) => {
      const box = e.target.closest('.note-rich');
      if (!box) return;
      e.stopPropagation();
      // 同节点上的冒泡监听（整行展开/收起）也要拦掉
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    },
    true
  );
  el.noteList.addEventListener('focusin', (e) => {
    const box = e.target.closest('.note-rich');
    if (!box) return;
    box.scrollTop = box.scrollHeight;
  });

  const cc = $('#accentCustom');
  cc.addEventListener('input', () => {
    // 拖动取色器时即时预览
    document.documentElement.style.setProperty('--accent', cc.value);
    document.documentElement.style.setProperty('--accent-soft', hexA(cc.value, 0.16));
  });
  cc.addEventListener('change', () => {
    applyAccent('custom', cc.value);
    api.settings.save({ accent: 'custom', accentColor: cc.value });
    toast('主题色已更新');
  });
  const recenter = $('#btnRecenter');
  if (recenter) {
    recenter.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      applyShift(0, true);
      toast('已回到屏幕正中');
    });
  }
// --- 热更新
  const upCheck = $('#updateCheck');
  const upInstall = $('#updateInstall');
  const upVer = $('#updateVer');
  if (upVer && S.data && S.data.meta) upVer.textContent = S.data.meta.version || '-';

  // --- 文件搜索 / Everything 联动
  const evSub = $('#evSub');
  const evConnect = $('#evConnect');
  const evInstall = $('#evInstall');
  async function paintEverything(busyText) {
    if (!evSub) return;
    if (busyText) evSub.textContent = busyText;
    const r = (await api.files.everything('status')) || {};
    if (r.installed && r.running) {
      evSub.textContent = '已连接 Everything' + (r.version ? ' ' + r.version : '') + ' · 端口 ' + r.port + (r.total ? ' · 索引 ' + r.total.toLocaleString() + ' 项' : '');
      evConnect && evConnect.classList.add('hidden');
      evInstall && evInstall.classList.add('hidden');
      return;
    }
    if (r.installed) {
      evSub.textContent = 'Everything 已安装（' + (r.version || '已检测') + '），但搜索服务没开 · 点「连接」自动开启';
      evConnect && evConnect.classList.remove('hidden');
      evInstall && evInstall.classList.add('hidden');
      return;
    }
    evSub.textContent = r.builtin ? '没检测到 Everything · 可以一键安装（安装包已随软件带）' : '没检测到 Everything · 装了之后会自动连上';
    evConnect && evConnect.classList.remove('hidden');
    evInstall && evInstall.classList.toggle('hidden', !r.builtin);
  }
  if (evConnect) {
    evConnect.addEventListener('click', async (e) => {
      e.stopPropagation();
      evConnect.disabled = true;
      await paintEverything('正在开启 Everything 搜索服务…');
      const r = (await api.files.everything('ensure')) || {};
      evConnect.disabled = false;
      if (r.ok) toast('已连接 Everything ' + (r.version || ''));
      else toast((r && r.message) || '连接失败：请确认 Everything 已安装', true);
      paintEverything();
    });
  }
  if (evInstall) {
    evInstall.addEventListener('click', async (e) => {
      e.stopPropagation();
      evInstall.disabled = true;
      await paintEverything('正在安装 Everything（会弹一次系统授权）…');
      const r = (await api.files.everything('install')) || {};
      evInstall.disabled = false;
      if (r.ok) toast('Everything 装好了，已经连上');
      else toast((r && r.message) || '安装失败', true);
      paintEverything();
    });
  }
  setTimeout(() => paintEverything(), 2600);

  // --- 短信验证码：复制手机端要填的地址与密钥
  const smsCopy = $('#smsCopy');
  if (smsCopy) {
    smsCopy.addEventListener('click', async (e) => {
      e.stopPropagation();
      // 优先用已经建好的第一台设备；一把都没有就现场建一个
      let dev = smsDeviceTokens()[0];
      const active = ((S.smsDev && S.smsDev.items) || []).filter((d) => !d.revoked);
      if (dev && active.length && !active.some((d) => d.id === dev.id)) dev = null;
      if (!dev) {
        const nameInput = $('#smsDevName');
        dev = await smsDeviceCreate(nameInput && nameInput.value ? nameInput.value : '手机');
        if (!dev) {
          toast('还没填电脑端密钥，填好之后才能建手机密钥', true);
          return;
        }
      }
      try {
        await api.clips.writeText(smsConfigText(dev.token));
        toast('「' + dev.name + '」的配置已复制，发到手机就能用');
      } catch (err) {
        toast('复制失败', true);
      }
    });
  }

  const smsDevName = $('#smsDevName');
  const smsDevAdd = $('#smsDevAdd');
  if (smsDevAdd) {
    smsDevAdd.addEventListener('click', async (e) => {
      e.stopPropagation();
      smsDevAdd.disabled = true;
      const dev = await smsDeviceCreate(smsDevName ? smsDevName.value : '');
      smsDevAdd.disabled = false;
      if (!dev) return;
      if (smsDevName) smsDevName.value = '';
      try {
        await api.clips.writeText(smsConfigText(dev.token));
        toast('「' + dev.name + '」的密钥已建好并复制，发到手机粘贴即可');
      } catch (err) {
        toast('密钥已建好，但复制失败', true);
      }
    });
  }

  const smsDevList = $('#smsDevList');
  if (smsDevList) {
    smsDevList.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      e.stopPropagation();
      const id = b.dataset.id;
      if (b.dataset.act === 'sms-dev-copy') {
        const dev = smsDeviceTokens().find((x) => x.id === id);
        if (!dev) return toast('这台设备的密钥只建它的电脑上存着，换台电脑请撤销后重建', true);
        await api.clips.writeText(smsConfigText(dev.token));
        toast('「' + dev.name + '」的配置已复制');
      } else if (b.dataset.act === 'sms-dev-revoke') {
        await smsDeviceRevoke(id);
      } else if (b.dataset.act === 'sms-dev-remove') {
        await smsDeviceRemove(id);
        toast('已删除记录');
      }
    });
  }

  // 电脑端「读取密钥」：粘一次，只存在这台电脑
  const smsRead = $('#smsRead');
  const smsReadSave = $('#smsReadSave');
  if (smsRead && smsReadSave) {
    if (S.data && S.data.settings && S.data.settings.smsReadToken) smsRead.value = S.data.settings.smsReadToken;
    smsReadSave.addEventListener('click', async (e) => {
      e.stopPropagation();
      const v = smsRead.value.trim();
      if (!v) {
        toast('先粘贴电脑端密钥', true);
        return;
      }
      await api.settings.save({ smsReadToken: v });
      if (S.data && S.data.settings) S.data.settings.smsReadToken = v;
      if (S.sms) {
        S.sms.token = '';
        try {
          if (S.sms.es) S.sms.es.close();
        } catch (err) {
          /* ignore */
        }
        S.sms.es = null;
      }
      await smsInit();
      await smsDevicesLoad();
      toast(S.sms && S.sms.ok ? '已连上，验证码会自己弹出来' : '已保存，正在连接…');
    });
  }
  const smsRebind = $('#smsRebind');
  if (smsRebind) {
    smsRebind.addEventListener('click', async (e) => {
      e.stopPropagation();
      // 忘掉本机身份，用主密钥重新换一把（换了电脑/想重新划分归属时用）
      await api.settings.save({ smsOwnerToken: '', smsDevices: [] });
      if (S.data && S.data.settings) {
        S.data.settings.smsOwnerToken = '';
        S.data.settings.smsDevices = [];
      }
      if (S.sms) {
        try {
          if (S.sms.es) S.sms.es.close();
        } catch (err) {
          /* ignore */
        }
        S.sms.es = null;
        S.sms.token = '';
      }
      await smsInit();
      await smsDevicesLoad();
      toast(S.sms && S.sms.ok ? '已重新绑定：现在只显示这台电脑名下的手机' : '重新绑定失败，检查主密钥', !(S.sms && S.sms.ok));
    });
  }
  if (upCheck) {
    upCheck.addEventListener('click', async (e) => {
      e.stopPropagation();
      upCheck.disabled = true;
      upCheck.textContent = '检查中…';
      const r = await api.app.checkUpdate();
      upCheck.disabled = false;
      upCheck.textContent = '检查更新';
      if (!r || !r.ok) {
        toast((r && r.message) || '检查更新失败', true);
        return;
      }
      if (upVer) upVer.textContent = r.current || upVer.textContent;
      if (r.hasUpdate) {
        upInstall.classList.remove('hidden');
        upInstall.textContent = '下载并安装 ' + r.latest;
        toast('发现新版本 ' + r.latest + (r.size ? '（' + (r.size / 1048576).toFixed(1) + ' MB）' : ''));
      } else {
        upInstall.classList.add('hidden');
        toast('已经是最新版本 ' + r.current);
      }
    });
  }
  if (upInstall) {
    upInstall.addEventListener('click', async (e) => {
      e.stopPropagation();
      upInstall.disabled = true;
      upInstall.textContent = '下载中… 0%';
      const r = await api.app.downloadUpdate();
      if (!r || !r.ok) {
        upInstall.disabled = false;
        upInstall.textContent = '下载并安装';
        toast((r && r.message) || '下载失败', true);
        return;
      }
      upInstall.textContent = '正在安装…';
      toast('安装包已就绪，软件会自动关闭并升级');
    });
  }

  $('#providers').addEventListener('click', (e) => {    const c = e.target.closest && e.target.closest('.chip');
    if (!c) return;
    applyProvider(c.dataset.provider, true);
  });

  /* ---- 小工具：计时器 / 免打扰 ---- */
  $('#timerPresets').addEventListener('click', (e) => {
    const c = e.target.closest && e.target.closest('.chip');
    if (!c) return;
    $$('#timerPresets .chip').forEach((x) => x.classList.remove('active'));
    c.classList.add('active');
    const min = Number(c.dataset.timer);
    setTimerInputs(min * 60);
    startTimer(min * 60);
  });
  const addTodo = async () => {
    const v = (el.todoInput.value || '').trim();
    if (!v) return;
    el.todoInput.value = '';
    const r = await api.todos.add(v);
    if (r && r.ok) {
      renderTodos();
      toast(r.todo.minutes ? '已加入待办（' + r.todo.minutes + ' 分钟番茄钟）' : '已加入待办');
    }
  };
  if (el.todoAdd) el.todoAdd.addEventListener('click', addTodo);
  if (el.todoInput) {
    el.todoInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addTodo();
      }
    });
  }
  if (el.remAdd) el.remAdd.addEventListener('click', addReminderFromInput);
  if (el.remText) el.remText.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addReminderFromInput(); } });
  if (el.remQuick) el.remQuick.addEventListener('change', () => { if (el.remQuick.value === 'custom') el.remAt.focus(); });
  if (el.cdAdd) el.cdAdd.addEventListener('click', addCountdownFromInput);
  if (el.cdPayday) el.cdPayday.addEventListener('change', () => api.countdowns.setPayday(Number(el.cdPayday.value)));
  if (el.remList) el.remList.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const id = b.dataset.id;
    if (b.dataset.act === 'rem-done') api.reminders.done(id).then(renderTools);
    else if (b.dataset.act === 'rem-snooze') api.reminders.snooze(id, 5).then(() => { toast('5 分钟后再提醒'); renderTools(); });
  });
  if (el.cdList) el.cdList.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act="cd-del"]');
    if (b) api.countdowns.removeAnniversary(b.dataset.id).then(renderTools);
  });
  el.timerStart.addEventListener('click', () => startTimer(timerFromInputs()));
  [el.timerH, el.timerM, el.timerS].forEach((inp) => {
    if (!inp) return;
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') startTimer(timerFromInputs());
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const step = e.key === 'ArrowUp' ? 1 : -1;
        const max = inp === el.timerH ? 23 : 59;
        inp.value = String(Math.max(0, Math.min(max, (Number(inp.value) || 0) + step)));
      }
    });
    inp.addEventListener('focus', () => inp.select());
  });
  el.dndChips.addEventListener('click', (e) => {
    const c = e.target.closest && e.target.closest('.chip');
    if (!c) return;
    setDnd(Number(c.dataset.dnd));
  });
  el.setDnd.addEventListener('change', () => {
    if (el.setDnd.checked) setDnd(30);
    else setDnd(0);
  });

  /* ---- 小工具卡片 / 开发小工具 / 天气 ---- */
  const toolsPane = $('.pane[data-pane="tools"]');
  if (toolsPane) {
    toolsPane.addEventListener('click', (e) => {
      const t = e.target;
      const head = t.closest && t.closest('[data-tool-toggle]');
      if (head) {
        toggleTool(head.dataset.toolToggle);
        return;
      }
      const tab = t.closest && t.closest('#dvTabs .dv-tab');
      if (tab) {
        S.dvTab = tab.dataset.dv;
        S.dvOut = '';
        devToolsRedraw();
        return;
      }
      const act = t.closest && t.closest('[data-dv-act]');
      if (act) {
        dvRun(act.dataset.dvAct);
        return;
      }
      if (t.closest && t.closest('[data-act="dv-copy"]')) {
        if (!S.dvOut) return;
        api.clips.writeText(S.dvOut).then((r) => toast(r && r.ok === false ? '复制失败' : '已复制到剪贴板'));
      }
      if (t.closest && t.closest('[data-act="dv-src-copy"]')) {
        if (!S.dvSrc) return;
        api.clips.writeText(S.dvSrc).then((r) => toast(r && r.ok === false ? '复制失败' : '已复制（' + S.dvSrc.length + ' 字符）'));
        return;
      }
      if (t.closest && t.closest('[data-act="dv-src-clear"]')) {
        dvClearSrc();
        dvClearImage();
        S.dvOut = '';
        dvPaint();
        toast('已清空');
        return;
      }
      if (t.closest && t.closest('[data-act="dv-save"]')) {
        if (!S.dvImgUrl) return;
        const a = document.createElement('a');
        a.href = S.dvImgUrl;
        a.download = S.dvImgName || 'image.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast('已保存到下载文件夹：' + a.download);
        return;
      }
    });
  }
  if (el.dvFile) {
    el.dvFile.addEventListener('change', () => {
      const f = el.dvFile.files && el.dvFile.files[0];
      if (f) dvRunImage(f);
      el.dvFile.value = '';
    });
  }
  if (el.dvIn) {
    // 兜底：图片直接粘进这个框（而不是把几 MB 的 base64 塞进 textarea）
    el.dvIn.addEventListener('paste', (e) => {
      const items = (e.clipboardData && e.clipboardData.items) || [];
      for (const it of items) {
        if (it.type && it.type.startsWith('image/')) {
          const f = it.getAsFile();
          if (f) {
            e.preventDefault();
            dvRunImage(f);
            return;
          }
        }
      }
      const txt = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
      if (txt && txt.length > B64_INLINE_MAX) {
        e.preventDefault();
        dvSetSrc(txt, '已读入 ' + humanSize(txt.length) + '（不放进输入框，避免卡顿）');
        toast('这段有 ' + humanSize(txt.length) + '，已放进内存；直接点「解码」或「编码」就行。');
        return;
      }
    });
    el.dvIn.addEventListener('input', () => {
      if (el.dvIn.value.length > B64_INLINE_MAX) {
        dvSetSrc(el.dvIn.value, '已读入 ' + humanSize(el.dvIn.value.length) + '（不放进输入框，避免卡顿）');
      }
      dvPaint();
    });
    el.dvIn.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        const first = (DV_ACTS[S.dvTab] || [])[0];
        if (first) dvRun(first.k);
      }
    });
  }
  if (el.wxSave) {
    el.wxSave.addEventListener('click', async () => {
      const v = ((el.wxCity && el.wxCity.value) || '').trim();
      await api.settings.save({ weatherCity: v });
      toast(v ? '天气城市已设为 ' + v : '天气按 IP 自动获取');
      wxLoad(true);
    });
  }

  $('#mailTest').addEventListener('click', async () => {
    const cfg = mailCfg();
    if (!cfg.user || !cfg.host) {
      el.mailTestMsg.textContent = '请先填写邮箱地址和 IMAP 服务器';
      el.mailTestMsg.className = 'alert';
      return;
    }
    if (cfg.auth === 'oauth' && !((S.data.mail || {}).oauthReady)) {
      el.mailTestMsg.textContent = '请先点「用微软账户登录」完成授权，再测试连接';
      el.mailTestMsg.className = 'alert';
      return;
    }
    el.mailTestMsg.textContent = '正在连接…';
    el.mailTestMsg.className = 'alert ok';
    const r = await api.mail.test(cfg);
    el.mailTestMsg.textContent = (r && r.message) || (r && r.ok ? '连接成功' : '连接失败');
    el.mailTestMsg.className = 'alert' + (r && r.ok ? ' ok' : '');
  });

  // 添加一个新的邮箱（清空表单，进入「新增」态）
  $('#mailAdd').addEventListener('click', () => {
    S.mailEdit = '';
    S.formKey = '';
    el.mUser.value = '';
    el.mPass.value = '';
    el.mHost.value = '';
    el.mPort.value = '993';
    el.mPass.placeholder = 'QQ/163 请用授权码';
    el.mailTestMsg.className = 'alert hidden';
    applyProvider('qq', true);
    el.mUser.focus();
  });

  $('#mailSave').addEventListener('click', async () => {
    const cfg = mailCfg();
    if (!cfg.user || !cfg.host) {
      el.mailTestMsg.textContent = '请先填写邮箱地址和 IMAP 服务器';
      el.mailTestMsg.className = 'alert';
      return;
    }
    if (cfg.auth === 'oauth' && !((S.data.mail || {}).oauthReady)) {
      el.mailTestMsg.textContent = '请先点「用微软账户登录」完成授权';
      el.mailTestMsg.className = 'alert';
      el.msOauthBox.classList.remove('hidden');
      return;
    }
    const r = await api.mail.save(cfg);
    if (r && r.id) S.mailEdit = r.id;
    S.formKey = '';
    el.mPass.value = '';
    el.mailTestMsg.className = 'alert hidden';
    toast(cfg.auth === 'oauth' ? '已保存，正在同步微软邮箱…' : '已保存，正在同步邮件…');
    setTimeout(() => setTab('mail'), 400);
  });

  // 微软 OAuth 引导
  $('#msGuideToggle').addEventListener('click', () => el.msGuide.classList.toggle('hidden'));
  $('#msLogin').addEventListener('click', () => msStartOauth());
  $('#msPortal').addEventListener('click', () =>
    api.app.openExternal('https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps')
  );
  $('#msCodeCopy').addEventListener('click', async () => {
    const code = el.msCodeVal.textContent.trim();
    if (!code) return;
    await api.clips.writeText(code);
    toast('代码 ' + code + ' 已复制');
  });
  $('#msCodeOpen').addEventListener('click', () => api.app.openExternal(msUri));
  $('#msCodeCancel').addEventListener('click', async () => {
    msStopPolling(true);
    await api.mail.oauthCancel();
    toast('已取消授权');
  });

  $('#mailDisconnect').addEventListener('click', async () => {
    if (S.mailEdit) {
      await api.mail.remove(S.mailEdit);
      S.mailEdit = '';
      S.formKey = '';
      toast('已删除这个邮箱');
    } else {
      await api.mail.disconnect();
      toast('已断开邮箱');
    }
  });

  $('#openData').addEventListener('click', (e) => {
    e.preventDefault();
    api.app.revealData();
  });
  $('#btnQuit').addEventListener('click', () => api.app.quit());

  // 键盘
  document.addEventListener('keydown', (e) => {
    const lbVisible = !el.lightbox.classList.contains('hidden');
    // Ctrl+K 呼出命令面板（和设置里、全局热键里给的口径一致）
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openPalette();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && chatSelection()) {
      e.preventDefault();
      const text = chatSelection();
      api.clips.writeText(text).then((r) => {
        if (r && r.ok) toast('已复制选中的文字');
      });
      return;
    }
    if (lbVisible && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        lbZoomAt(cx, cy, 1.2);
        return;
      }
      if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        lbZoomAt(cx, cy, 1 / 1.2);
        return;
      }
      if (e.key === '0') {
        e.preventDefault();
        lbReset();
        return;
      }
    }
    if (lbVisible && (e.ctrlKey || e.metaKey)) {
      const k = e.key.toLowerCase();
      if (k === 'c') {
        e.preventDefault();
        lbCopy();
        return;
      }
      if (k === 's') {
        e.preventDefault();
        lbSave();
        return;
      }
    }
    if (e.key === 'Escape') {
      // 命令面板 → 划词条 → 图片预览 → 面板，按"最上层"顺序关
      if (!el.palette.classList.contains('hidden')) {
        closePalette();
        return;
      }
      if (S.mode === 'sel') {
        setMode('idle');
        return;
      }
      if (S.mode === 'warn') {
        closeDissolveWarn();
        return;
      }
      // 图片预览优先关掉
      if (!el.lightbox.classList.contains('hidden')) {
        closeLightbox();
        return;
      }
      if (isEditing()) {
        document.activeElement.blur();
        return;
      }
      if (S.mode === 'panel' || S.mode === 'compact' || S.mode === 'peek') {
        setPinned(false);
        setMode('idle');
      }
    }
  });

  // 拖入文件：普通文件直接进文件区；图片分两区（文件区 / 发小纸条）
  // 从资源管理器拖来的文件，item.type 往往是空的，只能用文件名后缀判断
  const IMG_EXT = /\.(png|jpe?g|gif|webp|bmp|avif|heic)$/i;
  const dragKindOf = (dt) => {
    const items = dt && dt.items ? Array.from(dt.items) : [];
    const files = items.filter((it) => it.kind === 'file');
    const types = files.map((it) => it.type || '').filter(Boolean);
    const names = [];
    for (const it of files) {
      try {
        const entry = it.webkitGetAsEntry ? it.webkitGetAsEntry() : null;
        if (entry && entry.name) names.push(entry.name);
      } catch {
        /* 忽略：拿不到 entry 时退化为后缀判断 */
      }
    }
    if (!names.length && dt && dt.files) {
      for (const f of Array.from(dt.files)) if (f && f.name) names.push(f.name);
    }
    const byType = types.length > 0 && types.every((t) => /^image\//.test(t));
    const byName = names.length > 0 && names.every((n) => IMG_EXT.test(n));
    const has = hasFiles(dt) || files.length > 0;
    return { has, images: byType || byName };
  };

  const showDrop = (images) => {
    S.dragKind = images ? 'images' : 'files';
    S.dropTarget = 'files';
    el.stage.dataset.drop = S.dragKind;
    if (el.dropChatSub) {
      const room = curRoom();
      el.dropChatSub.textContent = room ? '发到「' + roomName(room) + '」' : '还没有频道';
    }
    el.dropFiles.classList.add('hot');
    el.dropChat.classList.remove('hot');
    setMode('drop');
  };

  const hideDrop = () => {
    S.dragKind = '';
    S.dropTarget = '';
    el.dropFiles.classList.remove('hot');
    el.dropChat.classList.remove('hot');
    if (S.mode === 'drop') setMode('idle');
  };

  window.addEventListener('dragenter', (e) => {
    const info = dragKindOf(e.dataTransfer);
    if (!info.has) return;
    e.preventDefault();
    S.dragDepth++;
    showDrop(info.images);
  });
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    if (S.mode !== 'drop') return;
    const half = e.target && e.target.closest ? e.target.closest('[data-drop]') : null;
    const t = half && half.dataset.drop === 'chat' && S.dragKind === 'images' ? 'chat' : 'files';
    if (t !== S.dropTarget) {
      S.dropTarget = t;
      el.dropFiles.classList.toggle('hot', t === 'files');
      el.dropChat.classList.toggle('hot', t === 'chat');
    }
  });
  window.addEventListener('dragleave', (e) => {
    S.dragDepth--;
    if (S.dragDepth <= 0) {
      S.dragDepth = 0;
      hideDrop();
    }
  });
  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    S.dragDepth = 0;
    const dt = e.dataTransfer;
    const target = S.dropTarget || 'files';
    const kind = S.dragKind;
    hideDrop();
    if (!dt || !dt.files || !dt.files.length) return;
    const files = Array.from(dt.files);

    // 图片发到小纸条
    if (target === 'chat' && kind === 'images') {
      if (!curRoom()) {
        toast('还没有加入小纸条，先新建一个频道', true);
        openPanel('chat');
        return;
      }
      const ok = await chatSendFile(files[0]);
      if (ok) toast('图片已发到「' + roomName(curRoom()) + '」');
      return;
    }

    const paths = [];
    for (const f of files) {
      const p = api.pathForFile ? api.pathForFile(f) : f.path;
      if (p) paths.push(p);
    }
    if (!paths.length) {
      toast('没有识别到文件路径', true);
      return;
    }
    const r = await api.files.add(paths);
    toast('已放入文件区 ' + ((r && r.added) || paths.length) + ' 个项目');
  });

  // 鼠标进入/离开
  if (api.onPointer) {
    api.onPointer((p) => {
      S.pointerIn = !!p.inside;
      if (p.inside) {
        clearTimeout(S.collapseT);
        if (S.mode === 'idle') setMode('compact');
      } else {
        dropSpinFocus();
        if (S.mode === 'compact') scheduleCollapse(420, 'idle');
        else if (S.mode === 'panel') scheduleCollapse(1100, 'idle');
      }
    });
  }

  // 按住药丸 / 快捷条可以把工具条拖到顶部任意位置
  el.island.addEventListener('mousedown', startIslandDrag);

  // 点了别处就立刻收起（还没固定、也不在输入的时候）
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (S.pinned || isEditing()) return;
      // 岛本身、大图遮罩、提示条、右键菜单、表情面板、卫星圆都不算「点了别处」
      if (e.target.closest && e.target.closest('#island, #lightbox, #toast, #msgMenu, #noteMenu, #emojiPop, #pickPop, .sat'))
        return;
      if (S.mode === 'panel' || S.mode === 'compact') setMode('idle');
    },
    true
  );

  // 切到别的窗口 / 桌面也算"移开"，直接收起
  window.addEventListener('blur', () => {
    if (Date.now() < (S.pickUntil || 0)) return; // 正在挑文件，别收
    if (S.pinned || isEditing()) return;
    if (S.mode === 'panel' || S.mode === 'compact' || S.mode === 'peek') {
      clearTimeout(S.collapseT);
      setMode('idle');
    }
  });

  // 轻微的视差倾斜，让岛"有生命"
  if (api.onPointerMove) {
    api.onPointerMove((p) => {
      const r = el.island.getBoundingClientRect();
      if (!r.width) return;
      const cx = r.x + r.width / 2;
      const nx = Math.max(-1, Math.min(1, (p.x - cx) / (r.width / 2 + 40)));
      el.island.style.setProperty('--ry', (nx * 1.4).toFixed(2) + 'deg');
      el.island.style.setProperty('--rx', (-nx * 0.3).toFixed(2) + 'deg');
    });
  }

  if (api.onCommand) api.onCommand(onCommand);
  if (api.onState) api.onState((s) => applyState(s));
  if (api.reminders && api.reminders.onFire) api.reminders.onFire(onReminderFire);

  window.addEventListener('resize', () => nudgeRect(600));
}

/** 提醒到点：抖 + 边缘彩虹，弹一个提示条 */
function onReminderFire(data) {
  if (!data) return;
  // 1) 抖一抖（复用拍一拍的动画）
  try { shakeIsland(1500); } catch (_) {}
  // 2) 边缘彩虹跑马灯
  try {
    el.island.classList.add('rim-rainbow');
    setTimeout(() => el.island.classList.remove('rim-rainbow'), 6000);
  } catch (_) {}
  // 3) 弹条
  try {
    showPeek({
      icon: '#i-bell',
      title: data.anniversary ? '今天是' : '提醒',
      sub: data.text,
      time: '刚刚',
      dur: 9000,
      force: true
    });
  } catch (_) {}
  // 4) 顺便刷一下小工具页的列表
  setTimeout(() => { try { renderTools(); } catch (_) {} }, 200);
}

function onCommand(msg) {
  if (!msg || !msg.type) return;
  switch (msg.type) {
    case 'wake':
      S.grace = Date.now() + 1500;
      nudgeRect(1200);
      break;
    case 'resync':
      // 主进程刚把窗口重新显示出来：重新量一次岛矩形并上报，别让穿透判定用旧值
      nudgeRect(1600);
      break;
    case 'toggle':
      if (S.mode === 'panel') {
        setPinned(false);
        setMode('idle');
      } else {
        openPanel(S.tab);
      }
      break;
    case 'open':
      openPanel(msg.tab || 'mail', !!msg.pin);
      break;
    case 'mail:new':
      newMailPing(msg.item);
      if (S.mode !== 'panel' && !S.pinned) {
        const it = msg.item || {};
        showPeek({
          icon: '#i-mail',
          title: it.code ? '验证码 ' + it.code : it.fromName || it.fromAddr || '新邮件',
          sub: it.code ? (it.fromName || it.fromAddr || '') + ' · ' + (it.subject || '') : it.subject || '(无主题)',
          time: timeShort(it.date),
          dur: 5200,
          code: it.code || ''
        });
      }
      break;
    case 'toast':
      toast(msg.text || '', msg.err);
      break;
    case 'palette':
      openPalette();
      break;
    case 'selection':
      showSelection(msg.text || '');
      break;
    case 'update-progress': {
      const b = $('#updateInstall');
      if (b) b.textContent = '下载中… ' + (msg.pct || 0) + '%';
      break;
    }
    case 'update-installing': {
      const b = $('#updateInstall');
      if (b) b.textContent = '正在安装…';
      toast('正在安装新版本，装完会自动重新打开');
      break;
    }
    case 'lb-close':
      if (!el.lightbox.classList.contains('hidden')) {
        el.lightbox.classList.add('hidden');
        el.lbMenu.classList.add('hidden');
        el.stage.classList.remove('lb-open');
        el.lbImg.removeAttribute('src');
        lbUrl = '';
      }
      break;
    default:
      break;
  }
}

/* ---------------------------------------------------------------- 启动 */

/* 节气：按 1900 年小寒起的分钟偏移近似求日期（1900–2100 内准确到天） */
const TERM_NAMES = [
  '小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
  '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑',
  '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至',
];
/*
 * 节气时刻：用太阳视黄经求解（Meeus 低精度公式，误差约 1 分钟），
 * 比早年那套「1900 年起按分钟偏移查表」的近似准 —— 那套在 2026 年把立冬算成了 11 月 8 日。
 * 节气按黄经每 15° 一个：春分（第 5 个）为 0°。
 */
function solarLon(ms) {
  const rad = Math.PI / 180;
  const T = (ms / 86400000 + 2440587.5 - 2451545) / 36525;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * rad;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M)
    + (0.019993 - 0.000101 * T) * Math.sin(2 * M)
    + 0.000289 * Math.sin(3 * M);
  const omega = (125.04 - 1934.136 * T) * rad;
  const lon = L0 + C - 0.00569 - 0.00478 * Math.sin(omega);
  return ((lon % 360) + 360) % 360;
}

/** 某年第 n 个节气（0=小寒）交节的本地日期（当天 0 点） */
function termDay(year, n) {
  const target = (((n - 5) * 15) % 360 + 360) % 360;
  let ms = Date.UTC(year, 0, 6) + n * 15.2 * 86400000;
  for (let i = 0; i < 12; i += 1) {
    const diff = ((target - solarLon(ms) + 540) % 360) - 180;
    ms += (diff * 86400000) / 0.98565;
    if (Math.abs(diff) < 1e-7) break;
  }
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** 返回当天所属的节气名（只在交节当天显示，第二天就不再显示） */
function currentTerm(d) {
  const today = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  let best = -1;
  let name = '';
  for (let year = d.getFullYear() - 1; year <= d.getFullYear(); year += 1) {
    for (let n = 0; n < 24; n += 1) {
      const t = termDay(year, n);
      if (t <= today && t > best) {
        best = t;
        name = TERM_NAMES[n];
      }
    }
  }
  return best === today ? name : '';
}

/** 公历固定日期的节日 */
const SOLAR_FESTIVALS = {
  '1-1': '元旦',
  '2-14': '情人节',
  '3-8': '妇女节',
  '4-1': '愚人节',
  '5-1': '劳动节',
  '5-4': '青年节',
  '6-1': '儿童节',
  '7-1': '建党节',
  '8-1': '建军节',
  '9-10': '教师节',
  '10-1': '国庆节',
  '12-25': '圣诞节'
};

/** 农历节日（键 = 农历月名 + 日名） */
const LUNAR_FESTIVALS = {
  正月初一: '春节',
  正月十五: '元宵节',
  二月初二: '龙抬头',
  五月初五: '端午节',
  七月初七: '七夕',
  八月十五: '中秋节',
  九月初九: '重阳节',
  腊月初八: '腊八节',
  腊月廿三: '小年'
};

function lunarParts(d) {
  try {
    const parts = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { month: 'long', day: 'numeric' }).formatToParts(d);
    const month = (parts.find((p) => p.type === 'month') || {}).value || '';
    const dayRaw = (parts.find((p) => p.type === 'day') || {}).value || '';
    const n = parseInt(dayRaw, 10);
    if (!month || !Number.isFinite(n)) return null;
    return { month, day: n };
  } catch (err) {
    return null;
  }
}

/** 当天是不是节日；公历节日优先，其次农历节日（除夕特殊处理） */
function festivalOf(d) {
  const solar = SOLAR_FESTIVALS[d.getMonth() + 1 + '-' + d.getDate()];
  if (solar) return solar;
  const lp = lunarParts(d);
  if (!lp) return '';
  const key = lp.month + lunarDayName(lp.day);
  if (LUNAR_FESTIVALS[key]) return LUNAR_FESTIVALS[key];
  // 除夕：明天就是正月初一
  const tm = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  const tp = lunarParts(tm);
  if (tp && tp.month === '正月' && tp.day === 1) return '除夕';
  return '';
}

/* 农历日的中文写法：初五 / 十二 / 廿三 / 三十 */
const LUNAR_NUM = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
function lunarDayName(n) {
  if (n === 10) return '初十';
  if (n > 0 && n < 10) return '初' + LUNAR_NUM[n];
  if (n > 10 && n < 20) return '十' + LUNAR_NUM[n - 10];
  if (n === 20) return '二十';
  if (n > 20 && n < 30) return '廿' + LUNAR_NUM[n - 20];
  if (n === 30) return '三十';
  return String(n);
}

/** 农历月日（Chromium 自带中国农历日历，无需查表/联网） */
function lunarDay(d) {
  try {
    const parts = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { month: 'long', day: 'numeric' }).formatToParts(d);
    const month = (parts.find((p) => p.type === 'month') || {}).value || '';
    const dayRaw = (parts.find((p) => p.type === 'day') || {}).value || '';
    const n = parseInt(dayRaw, 10);
    if (!month || !Number.isFinite(n)) return '';
    return month + lunarDayName(n);
  } catch (err) {
    return '';
  }
}

function tickClock() {
  const d = new Date();
  const t = pad(d.getHours()) + ':' + pad(d.getMinutes());
  if (el.clock) el.clock.textContent = t;
  if (el.idleNow) el.idleNow.textContent = t;

  // 日期 / 农历 / 节气每天只算一次
  const key = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  if (S.dayKey !== key) {
    S.dayKey = key;
    if (el.idleDate) {
      el.idleDate.textContent = d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
    }
    // 节日 > 节气（同一天只显示节日）；两者都没有就只显示农历
    S.idleSubText = [lunarDay(d), festivalOf(d) || currentTerm(d)].filter(Boolean).join(' · ') || '农历';
    renderIdleSub();
  }
}

/* 待机第二行：农历 · 节气 ·（有天气时）温度 */
function renderIdleSub() {
  if (!el.idleSub) return;
  const base = S.idleSubText || '';
  const wx = S.wx ? wxText(S.wx) : '';
  el.idleSub.textContent = (base + (wx ? ' · ' + wx : '')).replace(/^ · /, '') || '农历';
  el.idleSub.title = S.wx && S.wx.city ? S.wx.city + ' · ' + wxText(S.wx) : '';
  renderHeadExtra();
}

/* 面板标题栏的补充信息：日期 · 农历/节日 · 天气（时间单独由 #clock 显示） */
function renderHeadExtra() {
  if (!el.headExtra) return;
  const d = new Date();
  const wd = '日一二三四五六'[d.getDay()];
  const parts = [`${d.getMonth() + 1}月${d.getDate()}日 周${wd}`];
  if (S.idleSubText) parts.push(S.idleSubText);
  const wx = S.wx ? wxText(S.wx) : '';
  if (wx) parts.push(wx);
  el.headExtra.textContent = parts.join(' · ');
  el.headExtra.title = S.wx && S.wx.city ? `农历/节日 + 天气 · ${S.wx.city}` : '日期 · 农历/节日';
}

// ---------------------------------------------------------------- 命令面板
const PAL_ICON = {
  mail: '#i-mail',
  notes: '#i-note',
  clipboard: '#i-clip',
  files: '#i-files',
  chat: '#i-chat',
  tools: '#i-timer',
  settings: '#i-gear'
};

function prettyKey(acc) {
  return String(acc || '')
    .replace(/Control/g, 'Ctrl')
    .replace(/\+/g, '+');
}

function palCommands() {
  const list = [
    { id: 'tab:mail', label: '打开 邮件', icon: '#i-mail', key: 'Ctrl+1' },
    { id: 'tab:notes', label: '打开 备忘录', icon: '#i-note', key: 'Ctrl+2' },
    { id: 'tab:clipboard', label: '打开 剪贴板', icon: '#i-clip', key: 'Ctrl+3' },
    { id: 'tab:files', label: '打开 文件', icon: '#i-files', key: 'Ctrl+4' },
    { id: 'tab:chat', label: '打开 小纸条', icon: '#i-chat', key: 'Ctrl+5' },
    { id: 'tab:tools', label: '打开 小工具', icon: '#i-timer', key: 'Ctrl+6' },
    { id: 'tab:settings', label: '打开 设置', icon: '#i-gear', key: 'Ctrl+7' },
    { id: 'act:note-new', label: '新建一条备忘录', icon: '#i-plus' },
    { id: 'act:timer-5', label: '计时 5 分钟', icon: '#i-timer' },
    { id: 'act:timer-25', label: '计时 25 分钟（番茄钟）', icon: '#i-timer' },
    { id: 'act:timer-custom', label: '自定义计时…', icon: '#i-timer' },
    { id: 'act:shot', label: '截屏到剪贴板' + (S.data.meta.shortcuts && S.data.meta.shortcuts.shot ? '（' + prettyKey(S.data.meta.shortcuts.shot) + '）' : ''), icon: '#i-image' },
    { id: 'act:sel', label: '划词速递' + (S.data.meta.shortcuts && S.data.meta.shortcuts.select ? '（' + prettyKey(S.data.meta.shortcuts.select) + '）' : ''), icon: '#i-bolt' },
    { id: 'act:dnd', label: '免打扰 30 分钟', icon: '#i-moon' },
    { id: 'act:dnd-off', label: '关闭免打扰', icon: '#i-moon' },
    { id: 'act:check-update', label: '检查更新', icon: '#i-refresh' },
    { id: 'act:center', label: '工具条回到正中', icon: '#i-pin' },
    { id: 'act:hide', label: '隐藏灵动岛', icon: '#i-collapse' }
  ];
  const q = (el.palInput.value || '').trim().toLowerCase();
  if (!q) return list;
  return list.filter((c) => c.label.toLowerCase().includes(q) || c.id.includes(q));
}

function palSearch(q) {
  const norm = (s) => String(s == null ? '' : s).toLowerCase();
  const groups = [];
  const cmds = palCommands().map((c) => Object.assign({}, c, { kind: 'cmd' }));
  if (cmds.length) groups.push({ name: '命令', items: cmds });
  if (!q) return groups;

  const oneLine = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n || 52);

  const notes = (S.data.notes || [])
    .filter((n) => norm(n.text).includes(q))
    .slice(0, 6)
    .map((n) => ({
      id: 'note:' + n.id,
      kind: 'note',
      label: oneLine(n.text) || '（空备忘录）',
      icon: '#i-note',
      sub: '备忘录',
      ref: n
    }));
  if (notes.length) groups.push({ name: '备忘录', items: notes });

  const clips = (S.data.clips || [])
    .filter((c) => c.kind === 'text' && norm(c.text).includes(q))
    .slice(0, 6)
    .map((c) => ({
      id: 'clip:' + c.id,
      kind: 'clip',
      label: oneLine(c.text),
      icon: '#i-clip',
      sub: '剪贴板',
      ref: c
    }));
  if (clips.length) groups.push({ name: '剪贴板', items: clips });

  const mails = ((S.data.mail && S.data.mail.items) || [])
    .filter((m) => norm(m.subject).includes(q) || norm(m.fromName).includes(q) || norm(m.fromAddr).includes(q))
    .slice(0, 6)
    .map((m) => ({
      id: 'mail:' + m.key,
      kind: 'mail',
      label: oneLine(m.subject, 44) || '(无主题)',
      icon: '#i-mail',
      sub: oneLine(m.fromName || m.fromAddr, 22) || '邮件',
      ref: m
    }));
  if (mails.length) groups.push({ name: '邮件', items: mails });

  const files = (S.palFiles || []).slice(0, 8).map((f) => ({
    id: 'file:' + f.path,
    kind: 'file',
    label: f.name,
    icon: f.isDir ? '#i-folder' : '#i-files',
    sub: oneLine((f.dir || '').split(/[\\/]/).slice(-2).join('\\'), 30),
    ref: f
  }));
  if (files.length) {
    groups.push({ name: '文件', note: S.palBusy ? '正在找…' : S.palFileEngine || '', items: files });
  }
  return groups;
}

let palFileT = 0;

function palScheduleFileSearch() {
  const q = (el.palInput.value || '').trim();
  clearTimeout(palFileT);
  if (q.length < 2) {
    S.palFiles = [];
    S.palBusy = false;
    return;
  }
  S.palBusy = true;
  const token = ++S.palQ;
  palFileT = setTimeout(async () => {
    try {
      const r = await api.files.search(q, { limit: 8 });
      if (token !== S.palQ) return; // 迟到的结果直接丢掉
      S.palFiles = (r && r.results) || [];
      S.palFileEngine = r && r.engine === 'everything' ? '全盘' : r && r.wide ? '全盘浅扫' : '本机';
    } catch (_) {
      if (token !== S.palQ) return;
      S.palFiles = [];
      S.palFileEngine = '';
    }
    S.palBusy = false;
    renderPalette();
    nudgeRect(600);
  }, 260);
}

function renderPalette() {
  const q = (el.palInput.value || '').trim().toLowerCase();
  const groups = palSearch(q);
  const flat = [];
  groups.forEach((g) => g.items.forEach((it) => flat.push(it)));
  S.palItems = flat;
  if (S.palSel >= flat.length) S.palSel = Math.max(0, flat.length - 1);
  if (!flat.length) {
    el.palList.innerHTML = '<div class="pal-empty">' + (S.palBusy ? '正在找文件…' : '没有匹配的结果') + '</div>';
    return;
  }
  let html = '';
  let idx = 0;
  groups.forEach((g) => {
    html +=
      '<div class="pal-group">' + esc(g.name) + (g.note ? ' · ' + esc(g.note) : '') + '</div>';
    g.items.forEach((it) => {
      const i = idx++;
      html +=
        '<button class="pal-item' + (i === S.palSel ? ' sel' : '') + '" data-pal="' + i + '">' +
        '<svg class="ic"><use href="' + it.icon + '"/></svg>' +
        '<span class="pal-label">' + esc(it.label) + '</span>' +
        (it.sub ? '<span class="pal-sub">' + esc(it.sub) + '</span>' : '') +
        (it.key ? '<small>' + esc(it.key) + '</small>' : '') +
        '</button>';
    });
  });
  el.palList.innerHTML = html;
  const sel = el.palList.querySelector('.pal-item.sel');
  if (sel) sel.scrollIntoView({ block: 'nearest' });
}

function openPalette() {
  setPinned(true);
  S.palSel = 0;
  S.palFiles = [];
  S.palBusy = false;
  S.palQ++;
  el.palInput.value = '';
  el.palette.classList.remove('hidden');
  renderPalette();
  setMode('palette');
  focusPaletteInput();
  nudgeRect(1600);
}

// Ctrl+K 是系统级全局快捷键：窗口不会自己拿到焦点，
// 所以这里既要把窗口激活（主进程 app:focus），又要顶住形态切换的动画多试几次聚焦。
function focusPaletteInput() {
  const inp = el.palInput;
  const grab = () => {
    try {
      if (document.activeElement !== inp) inp.focus({ preventScroll: true });
      if (document.activeElement === inp) return true;
    } catch {}
    return false;
  };
  try { api.app.focus?.(); } catch {}
  grab();
  requestAnimationFrame(grab);
  setTimeout(grab, 60);
  setTimeout(grab, 160);
  setTimeout(grab, 320);
}

function closePalette() {
  el.palette.classList.add('hidden');
  setPinned(false);
  setMode('idle');
  nudgeRect(900);
}

async function runPalette(i) {
  const c = S.palItems[i];
  if (!c) return;
  if (c.kind && c.kind !== 'cmd') {
    el.palette.classList.add('hidden');
    if (c.kind === 'note') {
      const r = await api.clips.writeText(notePlain((c.ref && c.ref.text) || ''));
      toast(r && r.ok === false ? '复制失败' : '备忘录已复制');
    } else if (c.kind === 'clip') {
      const r = await api.clips.copy(c.ref.id);
      toast(r === false ? '复制失败' : '已复制到剪贴板', r === false);
    } else if (c.kind === 'mail') {
      S.pinned = false;
      openPanel('mail', false);
      await openMail(c.ref.key);
      api.mail.markRead(c.ref.key).catch(() => {});
      return;
    } else if (c.kind === 'file') {
      const r = await api.app.openPath(c.ref.path);
      if (r && r.ok === false) toast(r.message || '打不开这个文件', true);
    }
    setPinned(false);
    setMode('idle');
    return;
  }
  el.palette.classList.add('hidden');
  const [kind, arg] = c.id.split(':');
  if (kind === 'tab') {
    S.pinned = false;
    openPanel(arg, false);
    return;
  }
  switch (arg) {
    case 'note-new':
      S.pinned = false;
      openPanel('notes', false);
      setTimeout(() => el.noteInput && el.noteInput.focus(), 480);
      break;
    case 'timer-5':
      startTimer(5 * 60);
      toast('已开始 5 分钟计时');
      break;
    case 'timer-25':
      startTimer(25 * 60);
      toast('番茄钟开始：25 分钟后提醒休息');
      break;
    case 'timer-custom':
      S.pinned = false;
      openPanel('tools', false);
      setTimeout(() => el.timerM && el.timerM.select(), 480);
      break;
    case 'shot': {
      const r = await api.app.screenshot();
      toast(r.ok ? '已截图并复制到剪贴板' : r.message || '截图失败', !r.ok);
      break;
    }
    case 'sel': {
      const r = await api.app.grabSelection();
      if (r.ok) showSelection(r.text);
      else toast(r.message || '没有选中文字', true);
      break;
    }
    case 'dnd':
      setDnd(30);
      toast('已开启免打扰 30 分钟');
      break;
    case 'dnd-off':
      setDnd(0);
      toast('已关闭免打扰');
      break;
    case 'check-update':
      S.pinned = false;
      openPanel('settings', false);
      setTimeout(() => el.updateCheck && el.updateCheck.click(), 500);
      break;
    case 'center':
      applyShift(0, true);
      toast('工具条已回到正中');
      break;
    case 'hide':
      api.app.hide();
      break;
    default:
      break;
  }
  // 除了「打开某个页面」这类命令，其余执行完就收回药丸
  const keepOpen = kind === 'tab' || ['note-new', 'timer-custom', 'check-update'].includes(arg);
  if (!keepOpen) {
    setPinned(false);
    setMode('idle');
  }
}

// ---------------------------------------------------------------- 划词速递
function showSelection(text) {
  S.selText = String(text || '').slice(0, 4000);
  if (!S.selText) return;
  el.selQuote.textContent = S.selText.replace(/\s+/g, ' ').trim();
  setPinned(false);
  setMode('sel');
  nudgeRect(1400);
  // 没人理会就自己收起来，免得一直挂着
  clearTimeout(S.selT);
  S.selT = setTimeout(() => {
    if (S.mode === 'sel') setMode('idle');
  }, 9000);
}

function bindPalette() {
  el.palInput.addEventListener('input', () => {
    S.palSel = 0;
    S.palFiles = [];
    S.palBusy = false;
    S.palQ++;
    renderPalette();
    palScheduleFileSearch();
  });
  el.palInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      S.palSel = Math.min((S.palSel || 0) + 1, (S.palItems || []).length - 1);
      renderPalette();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      S.palSel = Math.max((S.palSel || 0) - 1, 0);
      renderPalette();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runPalette(S.palSel || 0);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closePalette();
    }
  });
  el.palList.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pal]');
    if (b) runPalette(Number(b.dataset.pal));
  });
  el.palette.addEventListener('pointerdown', (e) => {
    if (e.target === el.palette) closePalette();
  });
}

/* ------------------------------------------------------- 短信 / 验证码通道 */

const SMS_HINT = /(验证码|校验码|动态码|确认码|激活码|口令|一次性代码|一次性密码|verification\s*code|security\s*code|one[-\s]?time\s*code|code|passcode|otp)/i;

/** 从一段文本里挑验证码：关键词后 16 字内的 4–8 位数字，否则离「验证码」最近的 4–8 位 */
function smsCodeFrom(text) {
  const t = String(text || '');
  if (!t || t.length > 500) return '';
  const flat = t.replace(/[\u200b-\u200f\u2060\ufeff]/g, '').replace(/(\d)[\s\u00a0]+(?=\d)/g, '$1');
  const m = flat.match(SMS_HINT);
  if (!m) return '';
  const after = flat.slice(m.index, m.index + 40).match(/(?<!\d)(\d{4,8})(?!\d)/);
  if (after) return after[1];
  const before = flat.slice(Math.max(0, m.index - 20), m.index).match(/(?<!\d)(\d{4,8})(?!\d)\D*$/);
  return before ? before[1] : '';
}

function paintSms(extra) {
  const sub = $('#smsSub');
  if (!sub) return;  const s = S.sms || {};
  if (!s.token) {
    sub.textContent = extra || '服务端还没开这个通道（升级服务端后自动可用）';
    return;
  }
  sub.textContent = s.ok
    ? '已连接' +
      (s.ownerName ? ' · ' + s.ownerName : '') +
      ' · 手机端发来验证码会自动复制并弹条' +
      (extra ? ' · ' + extra : '')
    : '已拿到密钥 · 正在连接…' + (extra ? ' · ' + extra : '');
  renderToolsSummaries();
}

function smsShow(m) {
  const code = (m && m.code) || '';
  const from = (m && m.from) || '';
  const body = (m && m.text) || '';
  const dev = (m && m.device) || '';
  if (code) api.clips.writeText(code, true).catch(() => {});
  const title = code ? '验证码 ' + code : from || '收到一条短信';
  const who = from && dev && dev !== '旧版共用密钥' ? from + ' · ' + dev : from || dev;
  const sub = code ? (who ? who + ' · 已复制' : '已复制到剪贴板') : body.slice(0, 26);
  showPeek({ icon: '#i-shield', title, sub, force: true, dur: 9000 });
}

/**
 * 只接收「本机建过密钥」的手机推来的短信。
 * 服务器是所有电脑共用的一条流，不做过滤的话同事那台手机的验证码也会弹到你这台电脑上。
 * 老共用密钥（没有 deviceId）仍然放行，免得旧 APK 突然收不到。
 */
function smsAccept(m) {
  const id = (m && m.deviceId) || '';
  if (!id) return true;
  const mine = smsDeviceTokens();
  if (!mine.length) return true; // 还没建过任何密钥：不过滤，免得一条都收不到
  return mine.some((d) => d.id === id);
}

function smsConnect() {
  const s = S.sms || (S.sms = { token: '', es: null, ok: false, lastId: '' });
  if (!s.token || s.es) return;
  try {
    const es = new EventSource(`${CHAT_API}/api/sms/stream?token=${encodeURIComponent(s.token)}`);
    s.es = es;
    s.openedAt = 0;
    s.lastEvent = Date.now();
    es.addEventListener('hello', () => {
      s.ok = true;
      s.openedAt = Date.now();
      s.lastEvent = Date.now();
      paintSms();
    });
    es.addEventListener('sms', (e) => {
      s.lastEvent = Date.now();
      let m = null;
      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      }
      if (!m || m.id === s.lastId) return;
      s.lastId = m.id;
      if (!smsAccept(m)) return;
      smsShow(m);
    });
    es.addEventListener('error', () => {
      s.ok = false;
      paintSms();
      // readyState 2 = CLOSED：浏览器不会再自动重连，自己重来一次
      if (es.readyState === 2) {
        setTimeout(() => {
          if (S.sms && S.sms.es === es) {
            S.sms.es = null;
            smsConnect();
          }
        }, 4000);
      }
    });
  } catch (err) {
    paintSms('连接失败：' + (err && err.message ? err.message : err));
  }
}

/**
 * 流的健康检查：EventSource 在 403 / 网络切换后会永久 CLOSED 而不重连，
 * 结果是「服务端收到了、桌面一声不响」。每 30 秒兜一次。
 */
function smsWatchdog() {
  const s = S.sms;
  if (!s || !s.token) return;
  const es = s.es;
  const dead = !es || es.readyState === 2;
  const mute = es && es.readyState === 1 && s.lastEvent && Date.now() - s.lastEvent > 180000;
  if (dead || mute) {
    s.es = null;
    s.ok = false;
    smsConnect();
  }
}

async function smsInit() {
  S.sms = S.sms || { token: '', hook: '', es: null, ok: false, lastId: '' };
  // 多租户：这台电脑先用自己的「本机身份」跟服务器绑定一次，之后只看得见自己名下的手机
  const owner = await smsEnsureOwner();
  if (!owner) {
    S.sms.token = '';
    paintSms('还没绑定这台电脑：在下面粘贴一次服务器主密钥就行');
    return;
  }
  if (S.sms.token === owner && S.sms.es && S.sms.es.readyState !== 2) return;
  S.sms.token = owner;
  S.sms.es = null;
  try {
    const r = await fetch(`${CHAT_API}/api/hook/info?token=${encodeURIComponent(owner)}`, { cache: 'no-store' });
    const info = await r.json();
    if (info && info.ok) {
      S.sms.hook = info.hook || '';
      S.sms.post = info.post;
      S.sms.ownerName = (info.owner && info.owner.name) || (S.data.settings && S.data.settings.smsOwnerName) || '';
      smsConnect();
      paintSms();
      S.sms.ready = true;
      smsDevicesLoad();
      return;
    }
    paintSms('服务器不认这台电脑的身份（' + (info && info.message ? info.message : '未知原因') + '），可以点「重新绑定」');
  } catch (err) {
    paintSms('连不上服务器：' + (err && err.message ? err.message : err));
  }
}

/** 这台电脑的身份密钥：没有就用手上的主密钥去服务器换一把（只换一次） */
async function smsEnsureOwner() {
  const st = (S.data && S.data.settings) || {};
  const own = String(st.smsOwnerToken || '').trim();
  if (own) return own;
  const master = String(st.smsReadToken || '').trim();
  if (!master) return '';
  try {
    const r = await fetch(`${CHAT_API}/api/sms/enroll?token=${encodeURIComponent(master)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: st.smsOwnerName || '我的电脑' })
    });
    const d = await r.json();
    if (d && d.ok && d.token) {
      await api.settings.save({ smsOwnerToken: d.token, smsOwnerName: d.name || '我的电脑' });
      S.data.settings.smsOwnerToken = d.token;
      S.data.settings.smsOwnerName = d.name || '我的电脑';
      return d.token;
    }
  } catch {
    /* 下面统一提示 */
  }
  return '';
}

/* ---------- 手机密钥：每台手机一把，可单独撤销 ---------- */
function smsReadKey() {
  const st = (S.data && S.data.settings) || {};
  return String(st.smsOwnerToken || '').trim();
}

function smsMasterKey() {
  return String((S.data && S.data.settings && S.data.settings.smsReadToken) || '').trim();
}

function smsDeviceTokens() {
  const list = (S.data && S.data.settings && S.data.settings.smsDevices) || [];
  return Array.isArray(list) ? list : [];
}

function smsConfigText(token) {
  return (
    'Qing Tools 短信验证码\n' +
    '安卓 APK：https://qing.ccyyqq.com/island/update/QingToolsSMS.apk\n' +
    'POST https://chat.ccyyqq.com/island/api/hook/sms\n' +
    '密钥 ' + token + '\n' +
    'iPhone：复制验证码后灵动岛会自动识别（也可在快捷指令里用这个密钥推同样的地址）'
  );
}

function renderSmsDevList() {
  const box = $('#smsDevList');
  if (!box) return;
  const items = (S.smsDev && S.smsDev.items) || [];
  if (!items.length) {
    box.innerHTML = '<div class="sms-dev"><span class="sd-meta">还没有手机密钥：在上面输入设备名，点「新建密钥」，再把配置发到手机。</span></div>';
    return;
  }
  const now = Date.now();
  box.innerHTML = items
    .map((d) => {
      const local = smsDeviceTokens().find((x) => x.id === d.id);
      const on = !d.revoked && d.lastSeen && now - d.lastSeen < 7 * 864e5;
      const meta = d.revoked
        ? '已撤销'
        : d.lastSeen
          ? '最近使用 ' + fmtDate(d.lastSeen) + ' · 累计 ' + (d.count || 0) + ' 条'
          : '还没用过';
      // 服务器已经按「本机身份」过滤过了，这里看到的都是自己名下的手机
      const tag = '';
      return (
        '<div class="sms-dev' + (on ? ' on' : '') + (d.revoked ? ' revoked' : '') + '">' +
        '<i class="sd-dot"></i>' +
        '<b class="sd-name">' + esc(d.name) + '</b>' +
        tag +
        '<span class="sd-meta">' + esc(meta) + '</span>' +
        '<span class="sd-acts">' +
        (local && !d.revoked
          ? '<button class="mini" data-act="sms-dev-copy" data-id="' + d.id + '">复制配置</button>'
          : '') +
        (d.revoked
          ? '<button class="mini danger" data-act="sms-dev-remove" data-id="' + d.id + '">删除</button>'
          : '<button class="mini danger" data-act="sms-dev-revoke" data-id="' + d.id + '">撤销</button>') +
        '</span></div>'
      );
    })
    .join('');
}

async function smsDevicesLoad() {
  const read = smsReadKey();
  if (!read) return;
  try {
    const r = await fetch(`${CHAT_API}/api/sms/devices?token=${encodeURIComponent(read)}`, { cache: 'no-store' });
    const d = await r.json();
    S.smsDev = { items: (d && d.items) || [] };
    // 服务器上已经不存在的手机（被删了）就别再留本机的死记录了
    const alive = new Set(((d && d.items) || []).map((x) => x.id));
    const local = smsDeviceTokens();
    const kept = local.filter((x) => alive.has(x.id));
    if (kept.length !== local.length) {
      await api.settings.save({ smsDevices: kept });
      if (S.data && S.data.settings) S.data.settings.smsDevices = kept;
    }
  } catch {
    S.smsDev = { items: [] };
  }
  renderSmsDevList();
}

async function smsDeviceCreate(name) {
  const read = smsReadKey();
  if (!read) {
    toast('先填电脑端密钥，才能管理手机密钥', true);
    return null;
  }
  const label = (name || '').trim() || '手机';
  try {
    const r = await fetch(`${CHAT_API}/api/sms/devices?token=${encodeURIComponent(read)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ name: label })
    });
    const d = await r.json();
    if (!d || !d.ok) {
      toast((d && d.message) || '建密钥失败', true);
      return null;
    }
    const list = smsDeviceTokens().filter((x) => x.id !== d.item.id);
    list.push({ id: d.item.id, name: d.item.name, token: d.token });
    await api.settings.save({ smsDevices: list });
    if (S.data && S.data.settings) S.data.settings.smsDevices = list;
    await smsDevicesLoad();
    return { id: d.item.id, name: d.item.name, token: d.token };
  } catch (err) {
    toast('建密钥失败：' + (err && err.message ? err.message : err), true);
    return null;
  }
}

async function smsDeviceRevoke(id) {
  const read = smsReadKey();
  if (!read) return;
  await fetch(`${CHAT_API}/api/sms/devices/${encodeURIComponent(id)}/revoke?token=${encodeURIComponent(read)}`, {
    method: 'POST'
  }).catch(() => {});
  toast('已撤销，那台手机再也推不上来了');
  await smsDevicesLoad();
}

async function smsDeviceRemove(id) {
  const read = smsReadKey();
  if (!read) return;
  await fetch(`${CHAT_API}/api/sms/devices/${encodeURIComponent(id)}/remove?token=${encodeURIComponent(read)}`, {
    method: 'POST'
  }).catch(() => {});
  const list = smsDeviceTokens().filter((x) => x.id !== id);
  await api.settings.save({ smsDevices: list });
  if (S.data && S.data.settings) S.data.settings.smsDevices = list;
  await smsDevicesLoad();
}

/** 剪贴板里出现验证码（iPhone 长按「拷贝验证码」）时也弹一下 */
function smsClipCheck(clips) {
  const s = S.sms || (S.sms = { token: '', es: null, ok: false, lastId: '' });
  const top = (clips || [])[0];
  if (!top || top.kind !== 'text') return;
  const text = String(top.text || '');
  if (!text || text === s.lastClip) return;
  s.lastClip = text;
  if (s.lastId && text === s.lastSmsText) return;
  const code = smsCodeFrom(text);
  if (!code) return;
  if (Date.now() - (s.lastClipAt || 0) < 1500) return;
  s.lastClipAt = Date.now();
  showPeek({ icon: '#i-shield', title: '验证码 ' + code, sub: '从剪贴板识别 · 已复制', force: true, dur: 7000 });
  if (S.mode === 'idle') setMode('peek');
}

async function boot() {
  tickClock();
  setInterval(tickClock, 15000);

  try {
    const s = await api.getState();
    applyState(s);
  } catch (err) {
    console.error('getState failed', err);
  }
  try {
    const m = await api.app.metrics();
    if (m && m.workArea && m.workArea.height) S.screenH = m.workArea.height - (m.bounds ? m.bounds.y - m.workArea.y : 0);
  } catch (_) {}

  bindUi();
  bindPalette();
  chatInit();
  loadTimers();
  startTimerLoop();
  updateOrb();
  startSysLoop();
  setTimeout(() => wxLoad(false), 900);
  setTimeout(() => {
    devToolsRedraw();
    applyToolOpen();
  }, 300);
  setTimeout(smsInit, 1500);
  loadCloudBase().then(() => {
    if (S.data) renderNotes();
  });
  setTimeout(() => {
    accLoadStatus();
  }, 400);
  setInterval(() => {
    pollShares();
  }, 20000);
  setInterval(smsWatchdog, 30000);
  setTimeout(() => {
    smsDevicesLoad();
  }, 2600);
  setMode('idle', true);
  applyProvider('qq', false);
  requestAnimationFrame(() => {
    positionGlider();
    nudgeRect(900);
  });

  // 面板每次展开结束后校正一次高亮块位置
  el.island.addEventListener('transitionend', (e) => {
    if (e.propertyName !== 'width' || S.mode !== 'panel') return;
    positionGlider();
    if (S.tab === 'chat') chatScrollToEnd(true);
  });
}

boot();
