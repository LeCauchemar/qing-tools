'use strict';
/**
 * search.js —— 「类 macOS 聚焦」的本地文件搜索
 *
 * 两条通路：
 *   1) voidtools Everything 的 HTTP 服务（快、全盘索引，需要用户开着 Everything 并启用 HTTP Server）
 *   2) 内置广度优先扫描（慢，只扫常见目录，Everything 不可用时兜底）
 *
 * 约束：
 *   - 纯 Node 内置模块（Node 24 自带全局 fetch），不 require electron，不引入第三方依赖
 *   - 所有方法都不抛异常，失败时返回 { ok:false, message }
 *   - 打开文件/文件夹不在这里做（需要 electron.shell），交给调用方
 */

const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const os = require('node:os');

/* ------------------------------------------------------------------ 常量 */

/** 文本类扩展名白名单：决定 isText，以及「内容搜索」时允许读取的文件 */
const TEXT_EXT = new Set([
  '.txt', '.md', '.log', '.json', '.js', '.ts', '.css', '.html', '.yml', '.yaml',
  '.ini', '.csv', '.xml', '.ps1', '.py'
]);

/** 扫描时整目录跳过的名字（一律转小写比较） */
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.svn', '.hg', '.idea', '.vscode',
  'appdata', 'windows', 'programdata', 'program files', 'program files (x86)',
  '$recycle.bin', 'system volume information', '$windows.~bt', '$windows.~ws',
  'recovery', 'temp', 'tmp'
]);

const DEFAULT_EVERYTHING_URL = 'http://127.0.0.1:8010';
const HTTP_TIMEOUT_MS = 6000; // Everything 请求超时（3M+ 文件时首查可能要 2~4 秒），超时才回退
const SCAN_MAX_DEPTH = 4; // 全局广度优先深度上限
const SCAN_MAX_ENTRIES = 40000; // 最多访问的条目数
const SCAN_MAX_MS = 3500; // 最长扫描时间
const CONTENT_MAX_BYTES = 512 * 1024; // 内容搜索只读 < 512KB 的文本文件
const CONTENT_MAX_FILES = 3000; // 内容搜索最多读这么多文件，防止整盘打满
const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 100;
const DOWN_BACKOFF_MS = 8000; // Everything 失败后，这段时间内不再重试（避免每次按键都等 2.5s）

/* ------------------------------------------------------------ 小工具函数 */

function clampLimit(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(n)));
}

function extensionOf(file) {
  const ext = path.extname(String(file || '')).toLowerCase();
  return ext.length > 12 ? '' : ext; // 明显不是扩展名的长尾巴忽略
}

function isTextPath(file) {
  return TEXT_EXT.has(extensionOf(file));
}

/** 统一的错误描述（fetch 的报错藏在 cause 里） */
function describeError(err) {
  if (!err) return '未知错误';
  const name = String(err.name || '');
  if (name === 'TimeoutError') return '连接超时';
  if (name === 'AbortError') return '请求已取消';
  let cause = '';
  try {
    const c = err.cause;
    if (c) {
      if (Array.isArray(c.errors) && c.errors.length) {
        cause = c.errors[0] && (c.errors[0].code || c.errors[0].message) || '';
      } else {
        cause = c.code || c.message || '';
      }
    }
  } catch (_) {
    /* ignore */
  }
  const msg = String(err.message || name || err);
  return cause ? `${msg} (${cause})` : msg;
}

/**
 * Everything 的 date_modified 是 Windows FILETIME（1601 起的 100 纳秒数），
 * 不是 unix 秒。三种形态都要认：
 *   FILETIME（>1e16）→ (n/10000) - 11644473600000
 *   unix 秒（<1e12）  → *1000
 *   已经是毫秒       → 原样
 */
function normalizeMtime(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n > 1e15) return Math.round(n / 10000 - 11644473600000);
  return Math.round(n < 1e12 ? n * 1000 : n);
}

/** 异步 stat，永不抛 */
async function statOf(target) {
  try {
    const st = await fsp.stat(target);
    return { ok: true, size: Number(st.size) || 0, mtime: Math.round(Number(st.mtimeMs) || 0) };
  } catch (_) {
    return { ok: false, size: 0, mtime: 0 };
  }
}

/** 默认扫描根：桌面 / 文档 / 下载 / 用户主目录最上层 / 本地程序目录 */
function defaultRoots() {
  const home = os.homedir();
  const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
  const roots = [
    { dir: path.join(home, 'Desktop'), maxDepth: SCAN_MAX_DEPTH },
    { dir: path.join(home, 'Documents'), maxDepth: SCAN_MAX_DEPTH },
    { dir: path.join(home, 'Downloads'), maxDepth: SCAN_MAX_DEPTH },
    { dir: home, maxDepth: 0 }, // 主目录只看最上层，避免把整个 profile 翻一遍
    { dir: path.join(localAppData, 'Programs'), maxDepth: 2 }
  ];
  const out = [];
  const seen = new Set();
  for (const item of roots) {
    let resolved;
    try {
      resolved = path.resolve(item.dir);
    } catch (_) {
      continue;
    }
    const key = resolved.toLowerCase();
    if (seen.has(key)) continue;
    try {
      if (!fs.statSync(resolved).isDirectory()) continue;
    } catch (_) {
      continue; // 目录不存在（比如没有 OneDrive 桌面）就跳过
    }
    seen.add(key);
    out.push({ dir: resolved, maxDepth: item.maxDepth });
  }
  return out;
}

/** 把用户配置的 searchRoots 解析成 { dir, maxDepth } 列表 */
function normalizeRoots(value) {
  // 缺字段或空数组都当作「没配置」，回落到默认根（默认根各自带 maxDepth，主目录只看最上层）
  if (!Array.isArray(value) || value.length === 0) {
    return defaultRoots();
  }
  const out = [];
  const seen = new Set();
  for (const raw of value) {
    // 同时支持 "D:\\xxx" 与 { dir: "D:\\xxx", maxDepth: 2 } 两种写法
    let dirText = '';
    let depth = SCAN_MAX_DEPTH;
    if (typeof raw === 'string') {
      dirText = raw.trim();
    } else if (raw && typeof raw === 'object') {
      if (typeof raw.dir === 'string') dirText = raw.dir.trim();
      if (Number.isFinite(raw.maxDepth)) {
        depth = Math.max(0, Math.min(8, Math.round(raw.maxDepth)));
      }
    }
    if (!dirText) continue;
    let resolved;
    try {
      resolved = path.resolve(dirText);
    } catch (_) {
      continue;
    }
    const key = resolved.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ dir: resolved, maxDepth: depth });
  }
  return out;
}

/** 把 Everything 的一条结果整理成统一形状；脏数据返回 null */
function normalizeEverythingItem(item) {
  if (!item || typeof item !== 'object') return null;
  const rawPath = typeof item.path === 'string' ? item.path.trim() : '';
  const rawName = typeof item.name === 'string' ? item.name.trim() : '';
  if (!rawPath && !rawName) return null;

  const isDriveRoot = /^[a-zA-Z]:[\\/]$/.test(rawPath);
  const dirLike = /[\\/]$/.test(rawPath);
  let clean = isDriveRoot ? rawPath : rawPath.replace(/[\\/]+$/, '');

  // path_column 带出来的是「所在目录」，真正的一条结果 = 目录 + name
  if (clean && rawName) {
    const tail = path.basename(clean);
    if (tail.toLowerCase() !== rawName.toLowerCase()) clean = path.join(clean, rawName);
  } else if (!clean) {
    clean = rawName;
  }

  let full;
  try {
    full = path.resolve(clean);
  } catch (_) {
    return null;
  }
  if (!full) return null;

  const name = (typeof item.name === 'string' && item.name.trim()) || path.basename(full) || full;
  const type = typeof item.type === 'string' ? item.type.toLowerCase() : '';
  const isDir = dirLike || type === 'folder' || type === 'directory' || item.isFolder === true;
  const size = Number(item.size);

  return {
    name,
    path: full,
    dir: path.dirname(full),
    size: Number.isFinite(size) && size > 0 ? size : 0,
    mtime: normalizeMtime(item.date_modified),
    isDir,
    isText: !isDir && isTextPath(full)
  };
}

/* ------------------------------------------------------------- 类实现 */

class SearchService {
  /**
   * @param {{ getSettings?: () => any, log?: (...args: any[]) => void }} [options]
   */
  constructor(options = {}) {
    const opts = options && typeof options === 'object' ? options : {};
    this.getSettings = typeof opts.getSettings === 'function' ? opts.getSettings : () => ({});
    this.log = typeof opts.log === 'function' ? opts.log : null;
    this._downUntil = 0;
    this._downMessage = '';
  }

  _log(...args) {
    try {
      if (this.log) this.log(...args);
    } catch (_) {
      /* 日志钩子自己出错也不能影响搜索 */
    }
  }

  /** 读取配置，缺字段全部给默认值 */
  _settings() {
    let raw = {};
    try {
      const got = this.getSettings();
      if (got && typeof got === 'object') raw = got;
    } catch (err) {
      this._log('[search] getSettings 失败，使用默认配置', err);
    }

    const engine = ['auto', 'everything', 'local'].includes(raw.searchEngine) ? raw.searchEngine : 'auto';

    let everythingUrl = DEFAULT_EVERYTHING_URL;
    if (typeof raw.everythingUrl === 'string' && raw.everythingUrl.trim()) {
      const text = raw.everythingUrl.trim();
      everythingUrl = /^https?:\/\//i.test(text) ? text : `http://${text}`;
      everythingUrl = everythingUrl.replace(/\/+$/, '');
    }

    const searchRoots = normalizeRoots(raw.searchRoots);
    return { engine, everythingUrl, searchRoots };
  }

  _markDown(message) {
    this._downUntil = Date.now() + DOWN_BACKOFF_MS;
    this._downMessage = message || '';
  }

  /** 拼 Everything 的 HTTP 查询 URL */
  _buildUrl(baseUrl, expression, options = {}) {
    // 千万不要带 sort= —— 在 300 万文件的索引上按 date_modified 排序会让 Everything
    // 卡住十几秒甚至更久（实测 >90s），结果还要在客户端再排一次。这里只取原始顺序，
    // 排序在 _searchEverything 里对拿到的这一小批做。
    const params = new URLSearchParams({
      search: String(expression || ''),
      json: '1',
      // Everything 的条数限制参数是 count（不是 max！用 max 会忽略它，把整个索引
      // 几百万条全吐回来，实测能到 400MB+，Node 直接 OOM/超长字符串报错）
      count: String(Math.max(1, Math.floor(options.max || 1))),
      // 注意：要 path_column=1 结果里才会带 path（`path=1` 无效），
      // 而且带出来的是「所在目录」，文件名在 name 里，normalize 时再拼回去。
      path_column: '1',
      size_column: '1',
      date_modified_column: '1',
      regex: '0',
      case: '0'
    });
    if (Number(options.offset) > 0) params.set('offset', String(Math.floor(options.offset)));
    const base = String(baseUrl || DEFAULT_EVERYTHING_URL).replace(/\/+$/, '');
    return `${base}/?${params.toString()}`;
  }

  /* ------------------------------------------------------------ probe */

  /**
   * 探测 Everything HTTP 是否可用。
   * engine 为 'local' 时直接返回本地引擎；'auto' 时探测失败也算 ok（退化为 local）；
   * engine 为 'everything' 时探测失败返回 ok:false。
   * @returns {Promise<{ok:boolean, engine:'everything'|'local', address:string, version:string, count:number, message?:string}>}
   */
  async probe() {
    try {
      const cfg = this._settings();

      if (cfg.engine === 'local') {
        return {
          ok: true,
          engine: 'local',
          address: '',
          version: '',
          count: 0,
          message: '已设置为内置扫描'
        };
      }

      const info = await this._probeEverything(cfg.everythingUrl);
      if (info.ok) {
        this._downUntil = 0;
        this._downMessage = '';
        return {
          ok: true,
          engine: 'everything',
          address: cfg.everythingUrl,
          version: info.version,
          count: info.count
        };
      }

      this._markDown(info.message);
      if (cfg.engine === 'everything') {
        return {
          ok: false,
          engine: 'everything',
          address: cfg.everythingUrl,
          version: '',
          count: 0,
          message: info.message
        };
      }
      return {
        ok: true,
        engine: 'local',
        address: cfg.everythingUrl,
        version: '',
        count: 0,
        message: `Everything 不可用（${info.message}），使用内置扫描`
      };
    } catch (err) {
      this._log('[search] probe 异常', err);
      return { ok: false, engine: 'local', address: '', version: '', count: 0, message: describeError(err) };
    }
  }

  /** 真正打一次 Everything HTTP；返回 { ok:true, count, version } 或 { ok:false, message } */
  async _probeEverything(baseUrl) {
    // 空表达式会让 Everything 把整个索引（300 万条）吐回来，直接把响应撑爆，
    // 所以探测时用一个几乎必然命中的最小查询。
    const url = this._buildUrl(baseUrl, 'a', { max: 1 });
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS)
      });
      if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
      let data = null;
      try {
        data = await res.json();
      } catch (_) {
        return { ok: false, message: '返回内容不是 JSON' };
      }
      if (!data || typeof data !== 'object' || !('totalResults' in data)) {
        return { ok: false, message: '返回内容不是 Everything 的 JSON' };
      }
      const version = data.version || data.everythingVersion || data.build || '';
      return { ok: true, count: Number(data.totalResults) || 0, version: String(version || '') };
    } catch (err) {
      return { ok: false, message: describeError(err) };
    }
  }

  /* ----------------------------------------------------------- search */

  /**
   * 搜索文件 / 文件夹。
   * @param {string} query
   * @param {{ limit?: number, mode?: 'name'|'content', signal?: AbortSignal }} [opts]
   * @returns {Promise<{ok:boolean, engine:'everything'|'local', took:number, total:number, results:Array, message?:string}>}
   */
  async search(query, opts = {}) {
    const started = Date.now();
    const options = opts && typeof opts === 'object' ? opts : {};
    try {
      const q = typeof query === 'string' ? query.trim() : '';
      const limit = clampLimit(options.limit);
      const mode = options.mode === 'content' ? 'content' : 'name';
      const signal = options.signal;

      const cfg = this._settings();
      if (!q) {
        return { ok: true, engine: 'local', took: 0, total: 0, results: [] };
      }
      if (signal && signal.aborted) {
        return { ok: false, engine: 'local', took: 0, total: 0, results: [], message: '搜索已取消' };
      }

      /* 1) 优先 Everything */
      let everythingError = null;
      if (cfg.engine !== 'local') {
        if (Date.now() < this._downUntil) {
          everythingError = this._downMessage || 'Everything 暂时不可用';
        } else {
          const hit = await this._searchEverything(cfg.everythingUrl, q, { limit, mode, signal });
          if (hit.ok) {
            this._downUntil = 0;
            this._downMessage = '';
            return {
              ok: true,
              engine: 'everything',
              took: Date.now() - started,
              total: hit.total,
              results: hit.results
            };
          }
          everythingError = hit.message || 'Everything 不可用';
          this._markDown(everythingError);
          this._log('[search] Everything 不可用，回退内置扫描：', everythingError);
        }
      }

      /* 2) 内置扫描兜底 */
      const local = await this._scanLocal(cfg, q, { limit, mode, signal });
      const result = {
        ok: true,
        engine: 'local',
        took: Date.now() - started,
        total: local.total,
        results: local.results
      };
      if (local.aborted) result.aborted = true;
      if (everythingError) {
        result.fallback = true;
        result.message = `Everything 不可用（${everythingError}），已改用内置扫描`;
      }
      return result;
    } catch (err) {
      this._log('[search] 搜索异常', err);
      return {
        ok: false,
        engine: 'local',
        took: Date.now() - started,
        total: 0,
        results: [],
        message: describeError(err)
      };
    }
  }

  /** Everything 查询；失败返回 { ok:false, message } */
  async _searchEverything(baseUrl, query, { limit, mode, signal }) {
    // 内容搜索用 Everything 的前缀语法 content:<q>
    const expression = mode === 'content' ? `content:${query}` : query;
    const url = this._buildUrl(baseUrl, expression, { max: limit });

    const timeout = AbortSignal.timeout(HTTP_TIMEOUT_MS);
    let combined = timeout;
    try {
      if (signal && typeof AbortSignal.any === 'function') {
        combined = AbortSignal.any([timeout, signal]);
      }
    } catch (_) {
      combined = timeout;
    }

    let res;
    try {
      res = await fetch(url, {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: combined
      });
    } catch (err) {
      return { ok: false, message: describeError(err) };
    }
    if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };

    let data;
    try {
      data = await res.json();
    } catch (_) {
      return { ok: false, message: '返回内容不是 JSON' };
    }
    if (!data || typeof data !== 'object' || !Array.isArray(data.results)) {
      return { ok: false, message: '返回结构异常' };
    }

    const results = [];
    for (const item of data.results) {
      const normalized = normalizeEverythingItem(item);
      if (normalized) results.push(normalized);
    }
    // 服务端不排序（排序会让 Everything 卡死），这里对拿到的这一小批按修改时间倒序
    results.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
    const total = Number(data.totalResults);
    return {
      ok: true,
      total: Number.isFinite(total) && total >= 0 ? total : results.length,
      results: results.slice(0, limit)
    };
  }

  /* -------------------------------------------------------- 内置扫描 */

  /**
   * 广度优先扫描 searchRoots，命中即收集；最后按 mtime 倒序截断。
   * 预算：40000 个条目 或 3.5 秒，先到者停。
   */
  async _scanLocal(cfg, query, { limit, mode, signal }) {
    const started = Date.now();
    const deadline = started + SCAN_MAX_MS;
    const needle = query.toLowerCase();
    const found = [];
    const seenDirs = new Set();
    const queue = [];
    let visited = 0;
    let aborted = false;
    let contentFiles = 0;
    // 收集上限：避免极端查询（比如 "a"）把内存撑爆，只影响 total 的精度
    const collectCap = Math.max(limit * 20, 400);

    for (const root of cfg.searchRoots) {
      // 兼容 "字符串" 与 "{ dir, maxDepth }" 两种形态
      const rawDir = root && typeof root === 'object' ? root.dir : root;
      if (typeof rawDir !== 'string' || !rawDir) continue;
      let resolved;
      try {
        resolved = path.resolve(rawDir);
      } catch (_) {
        continue;
      }
      const key = resolved.toLowerCase();
      if (seenDirs.has(key)) continue;
      seenDirs.add(key);
      const maxDepth = root && typeof root === 'object' && Number.isFinite(root.maxDepth)
        ? Math.min(SCAN_MAX_DEPTH, Math.max(0, Math.floor(root.maxDepth)))
        : SCAN_MAX_DEPTH;
      queue.push({ dir: resolved, depth: 0, maxDepth });
    }

    while (queue.length) {
      if (Date.now() > deadline) break;
      if (signal && signal.aborted) {
        aborted = true;
        break;
      }
      const node = queue.shift(); // 队列即广度优先
      let dirHandle = null;
      try {
        dirHandle = await fsp.opendir(node.dir, { bufferSize: 64 });
      } catch (_) {
        continue; // EACCES / ENOENT 之类直接跳过
      }

      try {
        for await (const dirent of dirHandle) {
          visited++;
          if (visited > SCAN_MAX_ENTRIES) break;
          if ((visited & 255) === 0 && Date.now() > deadline) break;

          const name = dirent.name;
          // 跳过符号链接 / junction，防止目录环
          if (dirent.isSymbolicLink && dirent.isSymbolicLink()) continue;
          const isDir = dirent.isDirectory();

          let full;
          try {
            full = path.resolve(node.dir, name);
          } catch (_) {
            continue;
          }

          if (isDir) {
            const lower = name.toLowerCase();
            if (!SKIP_DIRS.has(lower) && node.depth + 1 <= node.maxDepth && node.depth + 1 <= SCAN_MAX_DEPTH) {
              const dirKey = full.toLowerCase();
              if (!seenDirs.has(dirKey)) {
                seenDirs.add(dirKey);
                queue.push({ dir: full, depth: node.depth + 1, maxDepth: node.maxDepth });
              }
            }
            if (mode === 'name' && lower.includes(needle)) {
              const info = await statOf(full);
              found.push({
                name,
                path: full,
                dir: path.dirname(full),
                size: 0,
                mtime: info.mtime,
                isDir: true,
                isText: false
              });
            }
          } else if (mode === 'name') {
            if (!name.toLowerCase().includes(needle)) continue;
            const info = await statOf(full);
            found.push({
              name,
              path: full,
              dir: path.dirname(full),
              size: info.size,
              mtime: info.mtime,
              isDir: false,
              isText: isTextPath(full)
            });
          } else {
            // 内容搜索：只看文本类扩展名，且 < 512KB
            if (!isTextPath(full)) continue;
            if (contentFiles >= CONTENT_MAX_FILES) continue;
            if (Date.now() > deadline) break;
            const info = await statOf(full);
            if (!info.ok || info.size > CONTENT_MAX_BYTES) continue;
            contentFiles++;
            const line = await findMatchingLine(full, needle);
            if (line > 0) {
              found.push({
                name,
                path: full,
                dir: path.dirname(full),
                size: info.size,
                mtime: info.mtime,
                isDir: false,
                isText: true,
                line
              });
            }
          }

          if (found.length >= collectCap) break;
        }
      } catch (err) {
        this._log('[search] 读取目录失败', node.dir, err);
      } finally {
        try {
          if (dirHandle) await dirHandle.close();
        } catch (_) {
          /* 已经自动关闭 */
        }
      }

      if (found.length >= collectCap) break;
    }

    found.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
    return {
      total: found.length,
      results: found.slice(0, limit),
      aborted
    };
  }
}

/**
 * 在文本文件里找第一个包含 needle 的行，返回行号（1 开始），没命中返回 0。
 * needle 必须先转小写。
 */
async function findMatchingLine(file, needle) {
  try {
    const buf = await fsp.readFile(file);
    if (!buf.length) return 0;
    // 前 4KB 里出现 \0 视为二进制，跳过
    if (buf.subarray(0, 4096).includes(0)) return 0;
    const text = buf.toString('utf8');
    const index = text.toLowerCase().indexOf(needle);
    if (index < 0) return 0;
    let line = 1;
    for (let i = 0; i < index; i++) {
      if (text.charCodeAt(i) === 10) line++;
    }
    return line;
  } catch (_) {
    return 0;
  }
}

module.exports = { SearchService };
