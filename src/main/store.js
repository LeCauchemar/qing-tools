'use strict';
/**
 * 轻量持久化：单个 JSON 文件 + 原子写入 + DPAPI 加密敏感字段
 */
const fs = require('node:fs');
const path = require('node:path');
const { app, safeStorage } = require('electron');

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

const DEFAULTS = {
  settings: {
    autoStart: true,
    notifyMail: true,
    clipEnabled: true,
    clipLimit: 60,
    accent: 'violet',
    accentColor: '#8f7bff', // 自定义主题色（accent === 'custom' 时生效）
    theme: 'dark', // dark | light
    style: 'island', // island（灵动岛）| notch（刘海：贴顶部边缘，平时缩成一条）
    pollMinutes: 3,
    topOffset: 8,
    uiScale: 1,
    showOnAllDisplays: false,
    islandX: 0, // 工具条相对屏幕中线的水平偏移（DIP）
    msClientId: '', // 微软 OAuth 应用（客户端）ID，留空则用内置
    smsReadToken: '', // 服务器主密钥：只在第一次给这台电脑换「本机身份」时用一次
    smsOwnerToken: '', // 本机身份密钥：服务器发的、只属于自己的那把，读短信接口都用它
    smsOwnerName: '', // 本机身份名字（绑定时生成，显示在设置里）
    smsDevices: [], // 本机建过的手机密钥 [{id,name,token}]（token 只存这份，服务器不再返回）
    dndUntil: 0, // 免打扰截止时间戳（0 = 未开启）
    weatherCity: '', // 天气城市：留空 = 按公网 IP 自动定位
    toolsOpen: {}, // 小工具页哪张卡片是展开的（{ timer: true } 之类）
    // 文件搜索：auto（有 Everything 就用）/ everything（强制）/ local（内置扫描）
    searchEngine: 'auto',
    everythingUrl: 'http://127.0.0.1:8010',
    everythingAuto: true, // 启动时自动把 Everything 的搜索服务开起来并连上
    everythingPath: '', // 手动指定 Everything.exe（留空自动探测）
    everythingPort: 8010,
    searchRoots: [] // 额外要扫描的目录，留空则用内置默认（桌面/文档/下载等）
  },
  notes: [],
  clips: [],
  files: [],
  todos: [],
  // 1.10.9：提醒事项（到点抖动 + 边缘彩虹跑马灯）
  reminders: [],
  // 1.10.9：倒数日（发薪日 / 节假日 / 纪念日）
  countdowns: {
    payday: 0, // 每月发薪日（1-31，0 = 未设置）
    anniversaries: [] // [{id,name,date:'YYYY-MM-DD',repeat:'yearly'|'once'}]
  },
  mail: {
    config: null, // { host, port, secure, user, pass(enc), label }
    items: [],
    total: 0,
    unseen: 0,
    lastSync: 0,
    error: null,
    errorAt: 0
  }
};

function deepMerge(base, patch) {
  if (Array.isArray(base)) return Array.isArray(patch) ? patch : base;
  if (base && typeof base === 'object') {
    const out = { ...base };
    if (patch && typeof patch === 'object') {
      for (const k of Object.keys(patch)) {
        out[k] = k in base ? deepMerge(base[k], patch[k]) : patch[k];
      }
    }
    return out;
  }
  return patch === undefined ? base : patch;
}

/** 用 Windows DPAPI（通过 Electron safeStorage）加密；不可用时退化为 base64 并标记 */
function encryptSecret(plain) {
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

function decryptSecret(value) {
  if (!value) return '';
  try {
    if (value.startsWith('dpapi:')) {
      return safeStorage.decryptString(Buffer.from(value.slice(6), 'base64'));
    }
    if (value.startsWith('b64:')) {
      return Buffer.from(value.slice(4), 'base64').toString('utf8');
    }
  } catch (_) {
    /* ignore */
  }
  return '';
}

class Store {
  constructor(file) {
    this.file = file;
    this.resolve = () => file;
    this.data = this._load();
    this._timer = null;
  }

  static at(file) {
    return new Store(file);
  }

  _load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      return deepMerge(clone(DEFAULTS), raw);
    } catch (_) {
      return clone(DEFAULTS);
    }
  }

  save() {
    if (this._timer) return;
    this._timer = setTimeout(() => {
      this._timer = null;
      this.flush();
    }, 150);
  }

  flush() {
    try {
      const dir = path.dirname(this.file);
      fs.mkdirSync(dir, { recursive: true });
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8');
      fs.renameSync(tmp, this.file);
    } catch (err) {
      console.error('[store] flush failed', err);
    }
  }
}

module.exports = { Store, DEFAULTS, encryptSecret, decryptSecret, clone };

/** 常用 id */
let seq = 0;
function uid(prefix = 'id') {
  seq = (seq + 1) % 100000;
  return `${prefix}_${Date.now().toString(36)}_${seq.toString(36)}`;
}
module.exports.uid = uid;
