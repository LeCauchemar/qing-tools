#!/usr/bin/env node
/**
 * 灵动岛 · 小纸条服务端
 * ---------------------------------------------------------------
 * 零依赖：只用 Node 内置模块（http / node:sqlite / crypto / fs）。
 * 运行环境：Node >= 22.5（需要 node:sqlite），实测 Ubuntu + Node 24.15。
 *
 * 对外路径（nginx 反代 /island/ → 127.0.0.1:3311）：
 *   GET  /island/                         网页版
 *   GET  /island/api/health
 *   POST /island/api/rooms                新建匹配码房间
 *   POST /island/api/rooms/join           用匹配码加入 / 换机替换
 *   GET  /island/api/rooms/:id            房间信息 + 成员
 *   GET  /island/api/rooms/:id/messages   历史消息
 *   POST /island/api/rooms/:id/messages   发消息
 *   POST /island/api/rooms/:id/leave      退出
 *   POST /island/api/upload               上传图片 / GIF / 表情包（裸二进制）
 *   GET  /island/media/:file              图片静态访问
 *   GET  /island/api/stream               SSE 实时推送
 */
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { upyunReady, upyunConfig, publicUrl, thumbUrl, putObject, deleteObject, signUpload } from './upyun.mjs';
import { purgeRoom } from './room-purge.mjs';

const PORT = Number(process.env.ISLAND_PORT || 3311);
const DATA_DIR = process.env.ISLAND_DATA || '/www/wwwroot/island/data';
const MEDIA_DIR = path.join(DATA_DIR, 'media');
const DB_FILE = path.join(DATA_DIR, 'island.db');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.join(HERE, 'web');
const PREFIX = '/island';
const MAX_MEMBERS = 4;
const DAY = 86400000;
const IDLE_DISSOLVE_MS = 30 * DAY; // 30 天没人说话 → 进入 3 天倒计时
const IDLE_GRACE_MS = 3 * DAY; // 倒计时 3 天后真正解散
const VOTE_MS = 5 * 60 * 1000; // 投票有效期 5 分钟，到点没投完算没通过
const MAX_UPLOAD = 30 * 1024 * 1024;
const MAX_FILE_UPLOAD = 64 * 1024 * 1024;
const CODE_LEN = 12;
const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const MIME_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/bmp': 'bmp',
  'image/x-ms-bmp': 'bmp',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico'
};

fs.mkdirSync(MEDIA_DIR, { recursive: true });

/* ------------------------------------------------------------------ DB */

const db = new DatabaseSync(DB_FILE);
db.exec(`
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS rooms (
  id          TEXT PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,
  creator     TEXT,
  note        TEXT,
  created_at  INTEGER NOT NULL,
  last_active INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id            TEXT PRIMARY KEY,
  room_id       TEXT NOT NULL,
  name          TEXT NOT NULL,
  token         TEXT NOT NULL,
  joined_at     INTEGER NOT NULL,
  last_seen     INTEGER,
  replaced_from TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_room_name ON devices(room_id, name);

CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY,
  room_id     TEXT NOT NULL,
  device_id   TEXT,
  device_name TEXT,
  kind        TEXT NOT NULL,
  text        TEXT,
  media_id    TEXT,
  created_at  INTEGER NOT NULL,
  client_id   TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_msg_client ON messages(room_id, client_id);
CREATE INDEX IF NOT EXISTS idx_msg_room_time ON messages(room_id, created_at);
`);

// 老库补列：@提醒 / 拍一拍的目标设备 id 列表（JSON 数组字符串）
const msgCols = db.prepare('PRAGMA table_info(messages)').all();
if (!msgCols.some((c) => c.name === 'mentions')) {
  db.exec('ALTER TABLE messages ADD COLUMN mentions TEXT');
}
// 老库补列：引用回复（JSON：{id,name,text}）
if (!msgCols.some((c) => c.name === 'reply')) {
  db.exec('ALTER TABLE messages ADD COLUMN reply TEXT');
}
// 老库补列：频道归属的账号（先到先得认领，见 handleRoomClaim）
const roomCols = db.prepare('PRAGMA table_info(rooms)').all();
if (!roomCols.some((c) => c.name === 'owner_user_id')) {
  db.exec('ALTER TABLE rooms ADD COLUMN owner_user_id TEXT');
}

// M5：设备和消息都带账号。匿名照旧（user_id 为空），登录过的设备记下 owner，
// 计票 / @ / 拍一拍 / 已读都按「人」归并，同一个人多台设备只算一份。
const devCols = db.prepare('PRAGMA table_info(devices)').all();
if (!devCols.some((c) => c.name === 'user_id')) {
  db.exec('ALTER TABLE devices ADD COLUMN user_id TEXT');
}
if (!msgCols.some((c) => c.name === 'user_id')) {
  db.exec('ALTER TABLE messages ADD COLUMN user_id TEXT');
}

// room_members：一台设备一行；登录过的设备带 user_id；已读位置也记在这里
db.exec(`
CREATE TABLE IF NOT EXISTS room_members (
  room_id      TEXT NOT NULL,
  device_id    TEXT NOT NULL,
  user_id      TEXT,
  joined_at    INTEGER NOT NULL,
  last_read_id TEXT,
  PRIMARY KEY (room_id, device_id)
);
CREATE INDEX IF NOT EXISTS idx_rm_room_user ON room_members(room_id, user_id);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS media (
  id         TEXT PRIMARY KEY,
  room_id    TEXT,
  mime       TEXT NOT NULL,
  bytes      INTEGER NOT NULL,
  width      INTEGER,
  height     INTEGER,
  file       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS stickers (
  id         TEXT PRIMARY KEY,
  room_id    TEXT NOT NULL,
  media_id   TEXT NOT NULL,
  name       TEXT,
  added_by   TEXT,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sticker_media ON stickers(room_id, media_id);
CREATE INDEX IF NOT EXISTS idx_sticker_room ON stickers(room_id, created_at DESC);

CREATE TABLE IF NOT EXISTS votes (
  id          TEXT PRIMARY KEY,
  room_id     TEXT NOT NULL,
  kind        TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  target_name TEXT,
  started_by  TEXT,
  started_at  INTEGER NOT NULL,
  closes_at   INTEGER NOT NULL,
  status      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_votes_room ON votes(room_id, started_at DESC);

CREATE TABLE IF NOT EXISTS vote_ballots (
  vote_id   TEXT NOT NULL,
  device_id TEXT NOT NULL,
  yes       INTEGER NOT NULL,
  at        INTEGER NOT NULL,
  PRIMARY KEY (vote_id, device_id)
);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS sms (
  id         TEXT PRIMARY KEY,
  from_no    TEXT,
  body       TEXT NOT NULL,
  code       TEXT,
  src        TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sms_created ON sms(created_at DESC);
CREATE TABLE IF NOT EXISTS sms_devices (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  token      TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  last_seen  INTEGER,
  last_ip    TEXT,
  count      INTEGER NOT NULL DEFAULT 0,
  revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sms_dev_token ON sms_devices(token);
CREATE TABLE IF NOT EXISTS sms_owners (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  token      TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  last_seen  INTEGER,
  revoked_at INTEGER
);
`);

/* ---------------------------------------------------- 账号 / 会话 / 事项 */
// 用户名不释放：注销时只清空凭据、保留 username_lc 占位，避免被顶替注册
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL,
  username_lc   TEXT NOT NULL UNIQUE,
  nick          TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  recovery_hash TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  deleted_at    INTEGER
);
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  token_hash  TEXT NOT NULL UNIQUE,
  device_name TEXT NOT NULL DEFAULT '',
  ua          TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL,
  last_seen   INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  revoked_at  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS bindings (
  id         TEXT PRIMARY KEY,
  from_user  TEXT NOT NULL,
  to_user    TEXT NOT NULL,
  status     TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  acted_at   INTEGER,
  UNIQUE(from_user, to_user)
);
CREATE TABLE IF NOT EXISTS shares (
  id          TEXT PRIMARY KEY,
  from_user   TEXT NOT NULL,
  to_user     TEXT NOT NULL,
  source_item TEXT NOT NULL,
  snapshot    TEXT NOT NULL,
  new_item_id TEXT,
  created_at  INTEGER NOT NULL,
  read_at     INTEGER
);
CREATE TABLE IF NOT EXISTS items (
  id         TEXT PRIMARY KEY,
  owner_id   TEXT NOT NULL,
  kind       TEXT NOT NULL,
  text       TEXT NOT NULL DEFAULT '',
  images     TEXT NOT NULL DEFAULT '[]',
  done       INTEGER NOT NULL DEFAULT 0,
  pinned     INTEGER NOT NULL DEFAULT 0,
  sort_at    INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  origin     TEXT,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_items_owner ON items(owner_id, deleted_at, sort_at DESC);
CREATE TABLE IF NOT EXISTS file_shares (
  id         TEXT PRIMARY KEY,
  from_user  TEXT NOT NULL,
  to_user    TEXT NOT NULL,
  name       TEXT NOT NULL,
  size       INTEGER NOT NULL DEFAULT 0,
  kind       TEXT NOT NULL DEFAULT 'file',
  key        TEXT NOT NULL,
  url        TEXT NOT NULL,
  note       TEXT,
  created_at INTEGER NOT NULL,
  read_at    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_fileshare_to ON file_shares(to_user, created_at DESC);
CREATE TABLE IF NOT EXISTS changes (
  seq       INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id  TEXT NOT NULL,
  entity    TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  op        TEXT NOT NULL,
  at        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_changes_owner ON changes(owner_id, seq);
`);

// 多租户：未登录时每台电脑一个 owner，只看得到自己名下的手机；
// 登录后短信跟着账号走（user_id），同一账号换台电脑也能收到同一批手机的验证码
{
  const devCols = db.prepare('PRAGMA table_info(sms_devices)').all().map((c) => c.name);
  if (!devCols.includes('owner_id')) db.exec('ALTER TABLE sms_devices ADD COLUMN owner_id TEXT');
  if (!devCols.includes('user_id')) db.exec('ALTER TABLE sms_devices ADD COLUMN user_id TEXT');
  const smsCols2 = db.prepare('PRAGMA table_info(sms)').all().map((c) => c.name);
  if (!smsCols2.includes('owner_id')) db.exec('ALTER TABLE sms ADD COLUMN owner_id TEXT');
  if (!smsCols2.includes('user_id')) db.exec('ALTER TABLE sms ADD COLUMN user_id TEXT');
  db.exec('CREATE INDEX IF NOT EXISTS idx_sms_dev_owner ON sms_devices(owner_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_sms_owner ON sms(owner_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_sms_dev_user ON sms_devices(user_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_sms_user ON sms(user_id)');
}

// 老库补列：sms 现在记录是哪台设备推来的
{
  const cols = db.prepare('PRAGMA table_info(sms)').all().map((c) => c.name);
  if (!cols.includes('device_id')) db.exec('ALTER TABLE sms ADD COLUMN device_id TEXT');
  if (!cols.includes('device_name')) db.exec('ALTER TABLE sms ADD COLUMN device_name TEXT');
}

/* ------------------------------------------------ 短信 / 验证码 hook */
// 两个密钥都只落在服务器本机：
//   hook —— 手机端用来「写」（推送短信）
//   read —— 桌面端用来「读」（SSE 订阅 + 历史），泄露风险更高，所以单独一把
const HOOK_FILE = path.join(DATA_DIR, 'hook.json');
let hookToken = process.env.ISLAND_HOOK_TOKEN || '';
let readToken = process.env.ISLAND_READ_TOKEN || '';
try {
  const saved = JSON.parse(fs.readFileSync(HOOK_FILE, 'utf8'));
  hookToken = hookToken || saved.token || saved.hook || '';
  readToken = readToken || saved.read || '';
} catch {
  /* 还没有就生成 */
}
let hookDirty = false;
if (!hookToken) {
  hookToken = crypto.randomBytes(15).toString('base64url');
  hookDirty = true;
}
if (!readToken) {
  readToken = crypto.randomBytes(18).toString('base64url');
  hookDirty = true;
}
if (hookDirty) {
  try {
    fs.writeFileSync(HOOK_FILE, JSON.stringify({ token: hookToken, hook: hookToken, read: readToken }, null, 2), {
      mode: 0o600
    });
    console.log('[hook] 已生成短信密钥：' + HOOK_FILE);
  } catch (err) {
    console.error('[hook] 写密钥失败', err && err.message);
  }
}

const CODE_WORDS =
  '(?:验证码|校验码|动态码|确认码|安全码|激活码|验证代码|登录码|口令|验证口令|' +
  '一次性\\s*(?:代码|密码|口令)|动态\\s*密码|登录\\s*代码|校验\\s*代码|安全\\s*代码|' +
  'verification\\s*code|security\\s*code|login\\s*code|one[\\s-]*time\\s*(?:code|password)|' +
  'auth(?:entication)?\\s*code|passcode|otp|code)';
const CODE_HINT = /(代码|密码|口令|验证|校验|激活|code|passcode|otp|pin)/i;

/** 从短信正文里抽验证码：关键词优先，其次离「代码/密码」最近的 6 位数 */
function codeFromText(text) {
  const raw = String(text || '');
  if (!raw) return '';
  const flat = raw.replace(/[\u200b-\u200f\u2060\ufeff]/g, '').replace(/(\d)[\s\u00a0]+(?=\d)/g, '$1');
  const variants = flat === raw ? [raw] : [raw, flat];
  const hits = [];
  for (const t of variants) {
    const re = new RegExp(CODE_WORDS + '[^0-9]{0,16}((?:\\d[ \\u00a0]?){4,8})', 'gi');
    let m;
    while ((m = re.exec(t))) {
      const digits = m[1].replace(/\D/g, '');
      if (digits.length >= 4 && digits.length <= 8) hits.push({ code: digits, w: 3, at: m.index });
    }
  }
  if (hits.length) {
    hits.sort((a, b) => b.w - a.w || a.at - b.at);
    return hits[0].code;
  }
  const six = Array.from(new Set(flat.match(/(?<!\d)\d{6}(?!\d)/g) || []));
  if (!six.length) return '';
  let pick = '';
  let best = 999;
  for (const c of six) {
    const at = flat.indexOf(c);
    const near = flat.slice(Math.max(0, at - 40), at + 40);
    if (!CODE_HINT.test(near)) continue;
    const gap = Math.min(
      ...Array.from(flat.matchAll(new RegExp(CODE_HINT.source, 'gi'))).map((mm) => Math.abs(mm.index - at)),
      999
    );
    if (gap < best) {
      best = gap;
      pick = c;
    }
  }
  return pick;
}

/** 短信推给在线的桌面端（按身份隔离：同账号/同一台电脑自己的设备才收得到） */
const smsStreams = new Set();

function pushSms(entry) {
  for (const s of smsStreams) {
    // 主密钥订阅（管理端）收全部
    // 账号订阅：只收这个账号名下手机推来的（entry.userId）
    // 本机身份订阅：只收这台电脑名下手机推来的（entry.ownerId）
    if (s.userId) {
      if (s.userId !== entry.userId) continue;
    } else if (s.ownerId && s.ownerId !== entry.ownerId) {
      continue;
    }
    try {
      s.res.write(`event: sms\ndata: ${JSON.stringify(entry)}\n\n`);
    } catch {
      /* 掉了会自己重连 */
    }
  }
}

async function handleHookSms(req, res, url, body) {
  const token = String(req.headers['x-hook-token'] || url.searchParams.get('token') || '');
  // 每台手机一把密钥：优先按设备表匹配；老的全局 hook 密钥仍然放行（标记为 legacy，方便旧 APK 过渡）
  let device = null;
  if (token) {
    device = db.prepare('SELECT * FROM sms_devices WHERE token = ?').get(token) || null;
    if (device && device.revoked_at) return fail(res, 'revoked', '这台设备的密钥已被撤销', 403);
  }
  const legacy = !device && token && token === hookToken;
  if (!device && !legacy) return fail(res, 'unauthorized', '密钥不对', 403);
  // 简单限流：同一台设备每分钟最多 20 条，防刷屏
  const key = device ? device.id : 'legacy';
  const now = Date.now();
  const hits = (rateHits.get(key) || []).filter((t) => now - t < 60000);
  if (hits.length >= 20) return fail(res, 'too_many', '发送太频繁了，稍等一下', 429);
  hits.push(now);
  rateHits.set(key, hits);
  // 快捷指令最省事的写法：GET …/api/hook/sms?token=…&text=…（不用拼 JSON）
  if (req.method === 'GET') body = url.searchParams.get('text') || '';
  let data = {};
  if (req.method === 'GET') {
    data = { text: body, from: url.searchParams.get('from') || '', src: url.searchParams.get('src') || 'shortcut' };
  } else {
    try {
      data = body ? JSON.parse(body) : {};
    } catch {
      // 兼容直接 POST 纯文本
      data = { text: String(body || '') };
    }
  }
  const text = String(data.text || data.body || '').slice(0, 4000).trim();
  if (!text) return fail(res, 'empty', 'text 不能为空', 400);
  const fromNo = String(data.from || data.sender || '').slice(0, 80);
  const src = String(data.src || data.source || 'phone').slice(0, 40);
  const code = codeFromText(text) || String(data.code || '').slice(0, 16);
  const devName = device ? device.name : '旧版共用密钥';
  const entry = {
    id: crypto.randomBytes(6).toString('hex'),
    from: fromNo,
    text,
    code,
    src,
    device: devName,
    deviceId: device ? device.id : '',
    ownerId: device && device.owner_id ? device.owner_id : '',
    userId: device && device.user_id ? device.user_id : '',
    at: Date.now()
  };
  db.prepare(
    'INSERT INTO sms (id, from_no, body, code, src, created_at, device_id, device_name, owner_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    entry.id,
    entry.from,
    entry.text,
    entry.code,
    entry.src,
    entry.at,
    device ? device.id : null,
    devName,
    entry.ownerId || null,
    entry.userId || null
  );
  if (device) {
    db.prepare('UPDATE sms_devices SET last_seen = ?, last_ip = ?, count = count + 1 WHERE id = ?').run(
      now,
      String(req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : '').slice(0, 64),
      device.id
    );
  }
  // 只留最近 200 条
  db.prepare('DELETE FROM sms WHERE id NOT IN (SELECT id FROM sms ORDER BY created_at DESC LIMIT 200)').run();
  pushSms(entry);
  console.log(
    '[sms] ' + (entry.code || '无验证码') + ' ← ' + (entry.from || entry.src) + ' [' + devName + '] / ' + entry.text.slice(0, 40)
  );
  return ok(res, { id: entry.id, code: entry.code, device: devName });
}

/* ------------------------------------------------ 设备密钥管理（要「读取密钥」或「本机身份」） */
const rateHits = new Map(); // deviceId|legacy → [ts]

/** 本机身份（owner）：每台电脑一份，只看得到自己名下的手机 */
function ownerByToken(token) {
  if (!token) return null;
  const row = db.prepare('SELECT * FROM sms_owners WHERE token = ?').get(token);
  if (!row || row.revoked_at) return null;
  return row;
}

/**
 * 谁来读短信。三种身份，优先级：账号 > 服务器主密钥 > 本机身份。
 *   {kind:'user', user}   —— 登录账号：手机密钥与短信都跟着账号走
 *   {kind:'master'}       —— 服务器主密钥：管理端，看全部
 *   {kind:'owner', owner} —— 未登录时的本机身份，只看这台电脑名下的手机
 * token 可以走 header（X-Read-Token / Authorization），也可以走 ?token=（SSE 只能用 query）。
 */
function resolveReader(req, url) {
  const queryToken = url ? String(url.searchParams.get('token') || '').trim() : '';
  const headerToken = String(req.headers['x-read-token'] || '').trim();
  const user = softUser(req) || userByRawToken(queryToken);
  if (user) return { kind: 'user', user };
  if (headerToken && headerToken === readToken) return { kind: 'master' };
  if (queryToken && queryToken === readToken) return { kind: 'master' };
  const owner = ownerByToken(headerToken) || ownerByToken(queryToken);
  return owner ? { kind: 'owner', owner } : null;
}

/** 只认服务器主密钥（用于给新电脑发身份） */
function requireRead(req, res, url) {
  const token = String(req.headers['x-read-token'] || url.searchParams.get('token') || '');
  if (!token || token !== readToken) {
    fail(res, 'unauthorized', '服务器主密钥不对', 403);
    return false;
  }
  return true;
}

/** 主密钥或本机身份都行 */
function requireReader(req, res, url) {
  const reader = resolveReader(req, url);
  if (!reader) {
    fail(res, 'unauthorized', '这台电脑还没绑定（或密钥不对）', 403);
    return null;
  }
  return reader;
}

function publicOwner(o) {
  const n = db.prepare('SELECT COUNT(*) AS n FROM sms_devices WHERE owner_id = ?').get(o.id);
  return {
    id: o.id,
    name: o.name,
    created: o.created_at,
    lastSeen: o.last_seen,
    devices: n ? n.n : 0,
    revoked: !!o.revoked_at
  };
}

function publicSmsDevice(d) {
  return {
    id: d.id,
    name: d.name,
    created: d.created_at,
    lastSeen: d.last_seen,
    lastIp: d.last_ip || '',
    count: d.count || 0,
    revoked: !!d.revoked_at
  };
}

function handleSmsDevices(req, res, url, body) {
  const reader = requireReader(req, res, url);
  if (!reader) return;
  const rows =
    reader.kind === 'master'
      ? db.prepare('SELECT * FROM sms_devices ORDER BY created_at DESC').all()
      : reader.kind === 'user'
        ? db.prepare('SELECT * FROM sms_devices WHERE user_id = ? ORDER BY created_at DESC').all(reader.user.id)
        : db.prepare('SELECT * FROM sms_devices WHERE owner_id = ? ORDER BY created_at DESC').all(reader.owner.id);
  return ok(res, {
    items: rows.map(publicSmsDevice),
    master: reader.kind === 'master',
    mode: reader.kind,
    owner: reader.kind === 'owner' ? { id: reader.owner.id, name: reader.owner.name } : null,
    user: reader.kind === 'user' ? { id: reader.user.id, username: reader.user.username } : null
  });
}

function handleSmsDeviceCreate(req, res, url, body) {
  const reader = requireReader(req, res, url);
  if (!reader) return;
  let data = {};
  try {
    data = body ? JSON.parse(body) : {};
  } catch {
    data = {};
  }
  const name = String(data.name || '').slice(0, 24).trim() || '新设备';
  const token = crypto.randomBytes(15).toString('base64url');
  const id = 'dev_' + crypto.randomBytes(4).toString('hex');
  // 登录后新建的设备直接挂在账号上：换台电脑登录同一账号也能收到这批手机的验证码
  const ownerId = reader.kind === 'owner' ? reader.owner.id : reader.kind === 'master' ? String(data.ownerId || '') : '';
  const userId = reader.kind === 'user' ? reader.user.id : String(data.userId || '');
  db.prepare('INSERT INTO sms_devices (id, name, token, created_at, owner_id, user_id) VALUES (?, ?, ?, ?, ?, ?)').run(
    id,
    name,
    token,
    Date.now(),
    ownerId || null,
    userId || null
  );
  const d = db.prepare('SELECT * FROM sms_devices WHERE id = ?').get(id);
  return ok(res, { item: publicSmsDevice(d), token });
}

/** 这台设备是不是归当前读取者所有 */
function ownDevice(reader, id) {
  const d = db.prepare('SELECT * FROM sms_devices WHERE id = ?').get(id);
  if (!d) return null;
  if (reader.kind === 'master') return d;
  if (reader.kind === 'user') return d.user_id && d.user_id === reader.user.id ? d : null;
  return d.owner_id && d.owner_id === reader.owner.id ? d : null;
}

function handleSmsDeviceRevoke(req, res, url, id) {
  const reader = requireReader(req, res, url);
  if (!reader) return;
  if (!ownDevice(reader, id)) return fail(res, 'not_found', '没有这台设备', 404);
  db.prepare('UPDATE sms_devices SET revoked_at = ? WHERE id = ?').run(Date.now(), id);
  return ok(res, { id, revoked: true });
}

function handleSmsDeviceRemove(req, res, url, id) {
  const reader = requireReader(req, res, url);
  if (!reader) return;
  if (!ownDevice(reader, id)) return fail(res, 'not_found', '没有这台设备', 404);
  db.prepare('DELETE FROM sms_devices WHERE id = ?').run(id);
  return ok(res, { id, removed: true });
}

/* 给一台新电脑发身份：主密钥换一把只属于自己的读密钥，并把无主手机认领过来 */
function handleSmsEnroll(req, res, url, body) {
  // 已经登录账号的客户端不该再走「本机身份」：短信跟着账号走，不需要给电脑发密钥
  const signed = softUser(req);
  if (signed) {
    return fail(res, 'use_account', '已登录账号，验证码已经跟着账号走了，不用再绑定本机身份', 400);
  }
  if (!requireRead(req, res, url)) return;
  let data = {};
  try {
    data = body ? JSON.parse(body) : {};
  } catch {
    data = {};
  }
  const name = String(data.name || '我的电脑').slice(0, 24).trim() || '我的电脑';
  const token = crypto.randomBytes(18).toString('base64url');
  const id = 'own_' + crypto.randomBytes(4).toString('hex');
  db.prepare('INSERT INTO sms_owners (id, name, token, created_at) VALUES (?, ?, ?, ?)').run(
    id,
    name,
    token,
    Date.now()
  );
  // 迁移：把还没归属的手机认领给第一个来绑定的电脑
  const claimed = db
    .prepare('UPDATE sms_devices SET owner_id = ? WHERE owner_id IS NULL OR owner_id = ?')
    .run(id, '').changes;
  db.prepare('UPDATE sms SET owner_id = ? WHERE owner_id IS NULL OR owner_id = ?').run(id, '');
  console.log('[sms] 新电脑绑定 ' + name + ' (' + id + ')，认领 ' + claimed + ' 台手机');
  return ok(res, { id, name, token, claimed });
}

function handleSmsOwners(req, res, url) {
  if (!requireRead(req, res, url)) return;
  const rows = db.prepare('SELECT * FROM sms_owners ORDER BY created_at DESC').all();
  return ok(res, { items: rows.map(publicOwner) });
}

function handleSmsOwnerRevoke(req, res, url, id) {
  if (!requireRead(req, res, url)) return;
  db.prepare('UPDATE sms_owners SET revoked_at = ? WHERE id = ?').run(Date.now(), id);
  return ok(res, { id, revoked: true });
}

function handleSmsStream(req, res, url) {
  const reader = requireReader(req, res, url);
  if (!reader) return;
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    ...cors()
  });
  res.write('retry: 4000\n\n');
  res.write('event: hello\ndata: {}\n\n');
  const sub = {
    res,
    userId: reader.kind === 'user' ? reader.user.id : '',
    ownerId: reader.kind === 'owner' ? reader.owner.id : ''
  };
  smsStreams.add(sub);
  if (reader.kind === 'owner') {
    db.prepare('UPDATE sms_owners SET last_seen = ? WHERE id = ?').run(Date.now(), reader.owner.id);
  }
  const timer = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      /* ignore */
    }
  }, 25000);
  req.on('close', () => {
    clearInterval(timer);
    smsStreams.delete(sub);
  });
}

function handleSmsList(req, res, url) {
  const reader = requireReader(req, res, url);
  if (!reader) return;
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || 10)));
  const rows =
    reader.kind === 'master'
      ? db
          .prepare(
            'SELECT id, from_no AS "from", body AS text, code, src, created_at AS at FROM sms ORDER BY created_at DESC LIMIT ?'
          )
          .all(limit)
      : reader.kind === 'user'
        ? db
            .prepare(
              'SELECT id, from_no AS "from", body AS text, code, src, created_at AS at FROM sms WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
            )
            .all(reader.user.id, limit)
        : db
            .prepare(
              'SELECT id, from_no AS "from", body AS text, code, src, created_at AS at FROM sms WHERE owner_id = ? ORDER BY created_at DESC LIMIT ?'
            )
            .all(reader.owner.id, limit);
  return ok(res, { items: rows });
}

// 拿到身份才能问地址；推送密钥不再下发（每台手机自己有）
function handleHookInfo(req, res, url) {
  const reader = requireReader(req, res, url);
  if (!reader) return;
  return ok(res, {
    enabled: true,
    mode: reader.kind,
    hook: reader.kind === 'master' ? hookToken : '',
    post: 'https://chat.ccyyqq.com/island/api/hook/sms',
    stream: 'https://chat.ccyyqq.com/island/api/sms/stream',
    owner: reader.kind === 'owner' ? { id: reader.owner.id, name: reader.owner.name } : null,
    account: reader.kind === 'user' ? { id: reader.user.id, username: reader.user.username } : null
  });
}

const q = {
  roomByCode: db.prepare('SELECT * FROM rooms WHERE code = ?'),  roomById: db.prepare('SELECT * FROM rooms WHERE id = ?'),
  insertRoom: db.prepare(
    'INSERT INTO rooms (id, code, creator, note, created_at, last_active) VALUES (?, ?, ?, ?, ?, ?)'
  ),
  touchRoom: db.prepare('UPDATE rooms SET last_active = ? WHERE id = ?'),
  // 认领：只有还没归属的频道才能抢到（先到先得），同一账号重复调用视为已认领
  claimRoom: db.prepare(
    "UPDATE rooms SET owner_user_id = ? WHERE code = ? AND (owner_user_id IS NULL OR owner_user_id = '')"
  ),
  setRoomOwner: db.prepare('UPDATE rooms SET owner_user_id = ? WHERE id = ?'),
  roomsOfOwner: db.prepare('SELECT * FROM rooms WHERE owner_user_id = ? ORDER BY last_active DESC LIMIT 50'),
  members: db.prepare('SELECT * FROM devices WHERE room_id = ? ORDER BY joined_at ASC'),
  memberByName: db.prepare('SELECT * FROM devices WHERE room_id = ? AND name = ?'),
  memberById: db.prepare('SELECT * FROM devices WHERE id = ?'),
  insertDevice: db.prepare(
    'INSERT INTO devices (id, room_id, name, token, joined_at, last_seen, replaced_from, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ),
  deleteDevice: db.prepare('DELETE FROM devices WHERE id = ?'),
  devicesOfUser: db.prepare('SELECT * FROM devices WHERE room_id = ? AND user_id = ?'),
  seenDevice: db.prepare('UPDATE devices SET last_seen = ? WHERE id = ?'),
  upsertMember: db.prepare(
    'INSERT INTO room_members (room_id, device_id, user_id, joined_at) VALUES (?, ?, ?, ?) ' +
      'ON CONFLICT(room_id, device_id) DO UPDATE SET user_id = excluded.user_id'
  ),
  attachDevice: db.prepare('UPDATE devices SET user_id = ? WHERE id = ?'),
  memberRow: db.prepare('SELECT * FROM room_members WHERE room_id = ? AND device_id = ?'),
  delMember: db.prepare('DELETE FROM room_members WHERE room_id = ? AND device_id = ?'),
  delMemberUser: db.prepare('DELETE FROM room_members WHERE room_id = ? AND user_id = ?'),
  setRead: db.prepare('UPDATE room_members SET last_read_id = ? WHERE room_id = ? AND device_id = ?'),
  countAfter: db.prepare('SELECT COUNT(*) AS c FROM messages WHERE room_id = ? AND created_at > ?'),
  insertMessage: db.prepare(
    'INSERT INTO messages (id, room_id, device_id, device_name, kind, text, media_id, created_at, client_id, mentions, reply, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ),
  messagesAfter: db.prepare(
    'SELECT * FROM messages WHERE room_id = ? AND created_at > ? ORDER BY created_at ASC LIMIT ?'
  ),
  messagesLatest: db.prepare(
    'SELECT * FROM messages WHERE room_id = ? ORDER BY created_at DESC LIMIT ?'
  ),
  messageById: db.prepare('SELECT * FROM messages WHERE id = ?'),
  messageByClient: db.prepare('SELECT * FROM messages WHERE room_id = ? AND client_id = ?'),
  insertMedia: db.prepare(
    'INSERT INTO media (id, room_id, mime, bytes, width, height, file, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ),
  mediaById: db.prepare('SELECT * FROM media WHERE id = ?'),
  attachMedia: db.prepare('UPDATE media SET room_id = ? WHERE id = ?'),
  insertSticker: db.prepare(
    'INSERT INTO stickers (id, room_id, media_id, name, added_by, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ),
  stickers: db.prepare('SELECT * FROM stickers WHERE room_id = ? ORDER BY created_at DESC LIMIT 200'),
  stickerByMedia: db.prepare('SELECT * FROM stickers WHERE room_id = ? AND media_id = ?'),
  stickerById: db.prepare('SELECT * FROM stickers WHERE id = ?'),
  deleteSticker: db.prepare('DELETE FROM stickers WHERE id = ?'),
  countRooms: db.prepare('SELECT COUNT(*) AS c FROM rooms'),
  insertVote: db.prepare(
    'INSERT INTO votes (id, room_id, kind, target_id, target_name, started_by, started_at, closes_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ),
  votesOpen: db.prepare("SELECT * FROM votes WHERE room_id = ? AND status = 'open' ORDER BY started_at DESC"),
  votesOpenAll: db.prepare("SELECT * FROM votes WHERE status = 'open' ORDER BY started_at ASC"),
  votesRecent: db.prepare('SELECT * FROM votes WHERE room_id = ? ORDER BY started_at DESC LIMIT 20'),
  voteById: db.prepare('SELECT * FROM votes WHERE id = ?'),
  closeVote: db.prepare('UPDATE votes SET status = ? WHERE id = ?'),
  voteBallots: db.prepare('SELECT * FROM vote_ballots WHERE vote_id = ?'),
  myBallot: db.prepare('SELECT * FROM vote_ballots WHERE vote_id = ? AND device_id = ?'),
  putBallot: db.prepare(
    'INSERT INTO vote_ballots (vote_id, device_id, yes, at) VALUES (?, ?, ?, ?) ON CONFLICT(vote_id, device_id) DO UPDATE SET yes = excluded.yes, at = excluded.at'
  ),
  allRooms: db.prepare('SELECT * FROM rooms'),
  // 账号
  userById: db.prepare('SELECT * FROM users WHERE id = ?'),
  userByName: db.prepare('SELECT * FROM users WHERE username_lc = ?'),
  insertUser: db.prepare(
    'INSERT INTO users (id, username, username_lc, nick, password_hash, password_salt, recovery_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ),
  updateUserCreds: db.prepare(
    'UPDATE users SET password_hash = ?, password_salt = ?, recovery_hash = ?, updated_at = ? WHERE id = ?'
  ),
  updateUserNick: db.prepare('UPDATE users SET nick = ?, updated_at = ? WHERE id = ?'),
  tombstoneUser: db.prepare(
    "UPDATE users SET password_hash = '', password_salt = '', recovery_hash = '', nick = '', deleted_at = ? WHERE id = ?"
  ),
  // 会话
  insertSession: db.prepare(
    'INSERT INTO sessions (id, user_id, token_hash, device_name, ua, created_at, last_seen, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ),
  sessionByHash: db.prepare('SELECT * FROM sessions WHERE token_hash = ?'),
  sessionById: db.prepare('SELECT * FROM sessions WHERE id = ?'),
  sessionsOf: db.prepare('SELECT * FROM sessions WHERE user_id = ? AND revoked_at IS NULL ORDER BY last_seen DESC'),
  touchSession: db.prepare('UPDATE sessions SET last_seen = ? WHERE id = ?'),
  revokeSession: db.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ?'),
  revokeAllSessions: db.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL')
};

/* --------------------------------------------------------------- utils */

const now = () => Date.now();
const rid = (bytes = 9) => crypto.randomBytes(bytes).toString('hex');
const hash = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const log = (...a) => console.log(new Date().toISOString(), ...a);

/** stored 里存的是 hash(token)，这里把明文 hash 后做定长比较 */
function tokenMatches(stored, raw) {
  if (!stored || !raw) return false;
  const a = Buffer.from(String(stored), 'hex');
  const b = Buffer.from(hash(raw), 'hex');
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function newCode() {
  const out = [];
  const buf = crypto.randomBytes(CODE_LEN);
  for (let i = 0; i < CODE_LEN; i++) out.push(CODE_ALPHABET[buf[i] % CODE_ALPHABET.length]);
  return out.join('');
}

function uniqueCode() {
  for (let i = 0; i < 20; i++) {
    const code = newCode();
    if (!q.roomByCode.get(code)) return code;
  }
  throw new Error('code collision');
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Island-Device, X-Island-Token, Authorization, X-Island-Session',
    'Access-Control-Max-Age': '86400'
  };
}

function json(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
    ...cors()
  });
  res.end(text);
}

const ok = (res, body = {}) => json(res, 200, { ok: true, ...body });
const fail = (res, code, message, extra) => {
  const status = typeof extra === 'number' ? extra : 200;
  const rest = typeof extra === 'object' && extra ? extra : {};
  json(res, status, { ok: false, code, message, ...rest });
};

async function readBody(req, limit = 1024 * 1024) {
  if (req.method === 'GET' || req.method === 'HEAD') return null;
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('body too large'), { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return null;
  return Buffer.concat(chunks);
}

function readJson(body) {
  if (!body) return {};
  try {
    return JSON.parse(body.toString('utf8'));
  } catch {
    return {};
  }
}

function mediaUrl(id) {
  const m = q.mediaById.get(id);
  if (!m) return null;
  if (!m.file) return null;
  // 云端的媒体存的是 cloud:<key>，直接给又拍云地址；本地的仍旧走 /island/media/xxx
  if (m.file.startsWith('cloud:')) return publicUrl(m.file.slice(6));
  return PREFIX + '/media/' + m.file;
}

/** 缩略图地址（又拍云 !default；本地文件没有缩略图，返回原地址） */
function mediaThumb(id) {
  const url = mediaUrl(id);
  if (!url) return null;
  if (String(url).startsWith('http')) return thumbUrl(url);
  return url;
}

function publicDevice(d, onlineSet) {
  return {
    id: d.id,
    name: d.name,
    userId: d.user_id || null,
    joinedAt: d.joined_at,
    lastSeen: d.last_seen,
    replacedFrom: d.replaced_from || null,
    online: onlineSet.has(d.id)
  };
}

function publicMessage(m) {
  let mentions = [];
  try {
    const parsed = JSON.parse(m.mentions || '[]');
    if (Array.isArray(parsed)) mentions = parsed.filter((x) => typeof x === 'string').slice(0, 8);
  } catch {
    mentions = [];
  }
  // 引用回复：只留 id / 名字 / 一小段原文，防止整条消息被反复复制进库
  let reply = null;
  try {
    const rp = JSON.parse(m.reply || 'null');
    if (rp && typeof rp === 'object') {
      reply = {
        id: String(rp.id || '').slice(0, 40),
        name: String(rp.name || '').slice(0, 40),
        text: String(rp.text || '').slice(0, 160)
      };
      if (!reply.id && !reply.text) reply = null;
    }
  } catch {
    reply = null;
  }
  const sender = m.user_id ? q.userById.get(m.user_id) : null;
  return {
    id: m.id,
    kind: m.kind,
    text: m.text || '',
    mediaId: m.media_id || null,
    url: m.media_id ? mediaUrl(m.media_id) : null,
    thumb: m.media_id ? mediaThumb(m.media_id) : null,
    deviceId: m.device_id,
    deviceName: m.device_name || '',
    // 登录过的发送者带账号昵称：拍一拍这类「谁干的」提示优先用它，而不是设备名
    userName: sender ? sender.nick || sender.username : '',
    userId: m.user_id || null,
    clientId: m.client_id || null,
    mentions,
    reply,
    at: m.created_at
  };
}

/* ---------------------------------------------------------------- SSE */

/** roomId -> Set<{res, deviceId, name, timer}> */
const streams = new Map();

function sendEvent(entry, event, data) {
  try {
    entry.res.write('event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n');
  } catch {
    /* 连接已断，交给 close 回收 */
  }
}

function broadcast(roomId, event, data, exceptDevice) {
  const set = streams.get(roomId);
  if (!set) return;
  for (const entry of set) {
    if (exceptDevice && entry.deviceId === exceptDevice) continue;
    sendEvent(entry, event, data);
  }
}

function onlineOf(roomId) {
  const set = new Set();
  for (const entry of streams.get(roomId) || []) set.add(entry.deviceId);
  return set;
}

function rosterOf(roomId) {
  return q.members.all(roomId).map((d) => publicDevice(d, onlineOf(roomId)));
}

function presence(roomId) {
  broadcast(roomId, 'presence', { online: [...onlineOf(roomId)], members: rosterOf(roomId) });
}

function disconnectDevice(roomId, deviceId, reason) {
  const set = streams.get(roomId);
  if (!set) return;
  for (const entry of [...set]) {
    if (entry.deviceId === deviceId) {
      sendEvent(entry, 'kicked', { reason: reason || '设备已离线' });
      try {
        entry.res.end();
      } catch {
        /* ignore */
      }
      clearInterval(entry.timer);
      set.delete(entry);
    }
  }
}

/* --------------------------------------------------------------- core */

function authDevice(roomId, deviceId, token) {
  if (!deviceId || !token) return null;
  const d = q.memberById.get(String(deviceId));
  if (!d || d.room_id !== roomId) return null;
  if (!tokenMatches(d.token, token)) return null;
  return d;
}

async function handleCreate(req, res, body) {
  const data = readJson(body);
  const deviceName = String(data.deviceName || '').trim().slice(0, 40) || '未命名设备';
  const deviceId = String(data.deviceId || '').trim() || rid(8);
  const u = softUser(req);
  const uid = u ? u.id : null;

  const code = uniqueCode();
  const roomId = rid(8);
  const token = rid(16);
  const t = now();
  q.insertRoom.run(roomId, code, deviceName, data.note ? String(data.note).slice(0, 80) : null, t, t);
  q.insertDevice.run(deviceId, roomId, deviceName, hash(token), t, t, null, uid);
  q.upsertMember.run(roomId, deviceId, uid, t);
  log('room created', roomId, code, deviceName, uid ? 'user=' + uid : 'anon');

  ok(res, { code, roomId, deviceId, token, deviceName, userId: uid, members: rosterOf(roomId) });
}

async function handleJoin(req, res, body) {
  const data = readJson(body);
  const code = String(data.code || '').replace(/\s+/g, '');
  const deviceName = String(data.deviceName || '').trim().slice(0, 40) || '未命名设备';
  let deviceId = String(data.deviceId || '').trim() || rid(8);
  const replace = !!data.replace;
  const u = softUser(req);
  const uid = u ? u.id : null;

  if (code.length !== CODE_LEN) return fail(res, 'bad_code', '匹配码是 12 位，请检查后重试');
  const room = q.roomByCode.get(code);
  if (!room) return fail(res, 'no_room', '这个匹配码不存在，或者已经被销毁');

  const members = q.members.all(room.id);
  const existing = q.memberByName.get(room.id, deviceName);
  let replacedFrom = null;

  if (existing) {
    if (existing.id === deviceId) {
      // 同一台设备重新连回来，续用即可
    } else if (replace) {
      replacedFrom = existing.id;
      q.deleteDevice.run(existing.id);
      disconnectDevice(room.id, existing.id, '这个设备名已被新电脑接管');
      log('device replaced', room.id, existing.name, existing.id, '->', deviceId);
    } else {
      return fail(
        res,
        'name_taken',
        '这台设备名「' + deviceName + '」已经在群里了。如果换了电脑，勾选「替换旧设备」再进',
        { canReplace: true }
      );
    }
  } else if (members.length >= MAX_MEMBERS) {
    return fail(res, 'room_full', '一个匹配码最多 ' + MAX_MEMBERS + ' 台设备，已经满了');
  }

  const token = rid(16);
  const t = now();
  const old = q.memberById.get(deviceId);
  if (old && old.room_id !== room.id) deviceId = rid(8); // 本地 id 属于别的房间，换新 id
  if (q.memberById.get(deviceId)) q.deleteDevice.run(deviceId);

  q.insertDevice.run(deviceId, room.id, deviceName, hash(token), t, t, replacedFrom, uid);
  q.upsertMember.run(room.id, deviceId, uid, t);
  q.touchRoom.run(t, room.id);

  ok(res, { code: room.code, roomId: room.id, deviceId, token, deviceName, userId: uid, members: rosterOf(room.id) });
  broadcast(room.id, 'members', { members: rosterOf(room.id) });
  presence(room.id);
}

async function handleRoomInfo(req, res, roomId, url) {
  const room = q.roomById.get(roomId);
  if (!room) return fail(res, 'no_room', '房间不存在', 404);
  const me = authDevice(roomId, url.searchParams.get('device'), url.searchParams.get('token'));
  if (!me) return fail(res, 'unauthorized', '身份校验失败', 403);

  for (const v of q.votesOpen.all(roomId)) settleVote(v);
  ok(res, {
    room: publicRoom(room),
    me: { id: me.id, name: me.name, userId: me.user_id || null },
    members: rosterOf(roomId),
    stickers: stickersOf(roomId),
    votes: votesOf(roomId, me.id)
  });
}

/* ------------------------------------------------------------- 表情包 */

function publicSticker(s) {
  return {
    id: s.id,
    mediaId: s.media_id,
    url: mediaUrl(s.media_id),
    thumb: mediaThumb(s.media_id),
    name: s.name || '',
    addedBy: s.added_by || '',
    at: s.created_at
  };
}

function stickersOf(roomId) {
  return q.stickers.all(roomId).map(publicSticker);
}

async function handleStickers(req, res, roomId, url) {
  const room = q.roomById.get(roomId);
  if (!room) return fail(res, 'no_room', '房间不存在', 404);
  if (!authDevice(roomId, url.searchParams.get('device'), url.searchParams.get('token')))
    return fail(res, 'unauthorized', '身份校验失败', 403);
  ok(res, { stickers: stickersOf(roomId) });
}

async function handleStickerAdd(req, res, roomId, body) {
  const room = q.roomById.get(roomId);
  if (!room) return fail(res, 'no_room', '房间不存在', 404);
  const data = readJson(body);
  const dev = authDevice(roomId, data.deviceId, data.token);
  if (!dev) return fail(res, 'unauthorized', '身份校验失败', 403);
  const mediaId = String(data.mediaId || '');
  const media = q.mediaById.get(mediaId);
  if (!media) return fail(res, 'no_media', '图片不存在', 404);
  if (media.room_id && media.room_id !== roomId) return fail(res, 'no_media', '图片不属于这个频道', 403);
  q.attachMedia.run(roomId, mediaId);
  const exist = q.stickerByMedia.get(roomId, mediaId);
  if (exist) return ok(res, { sticker: publicSticker(exist), duplicated: true });
  const s = {
    id: rid(8),
    room_id: roomId,
    media_id: mediaId,
    name: String(data.name || '').slice(0, 40),
    added_by: dev.name,
    created_at: now()
  };
  q.insertSticker.run(s.id, s.room_id, s.media_id, s.name, s.added_by, s.created_at);
  const list = stickersOf(roomId);
  broadcast(roomId, 'stickers', { stickers: list });
  ok(res, { sticker: publicSticker(s), stickers: list });
}

async function handleStickerRemove(req, res, roomId, stickerId, body) {
  const room = q.roomById.get(roomId);
  if (!room) return fail(res, 'no_room', '房间不存在', 404);
  const data = readJson(body);
  const dev = authDevice(roomId, data.deviceId, data.token);
  if (!dev) return fail(res, 'unauthorized', '身份校验失败', 403);
  const s = q.stickerById.get(stickerId);
  if (!s || s.room_id !== roomId) return fail(res, 'no_sticker', '表情不存在', 404);
  q.deleteSticker.run(stickerId);
  const list = stickersOf(roomId);
  broadcast(roomId, 'stickers', { stickers: list });
  ok(res, { stickers: list });
}

async function handleMessages(req, res, roomId, url) {
  const room = q.roomById.get(roomId);
  if (!room) return fail(res, 'no_room', '房间不存在', 404);
  if (!authDevice(roomId, url.searchParams.get('device'), url.searchParams.get('token')))
    return fail(res, 'unauthorized', '身份校验失败', 403);

  const since = Number(url.searchParams.get('since') || 0);
  const limit = Math.min(Number(url.searchParams.get('limit') || 80), 300);
  const rows = since
    ? q.messagesAfter.all(roomId, since, limit)
    : q.messagesLatest.all(roomId, limit).reverse();
  ok(res, { messages: rows.map(publicMessage) });
}

async function handleSend(req, res, roomId, body) {
  const room = q.roomById.get(roomId);
  if (!room) return fail(res, 'no_room', '房间不存在', 404);
  const data = readJson(body);
  const device = authDevice(roomId, data.deviceId, data.token);
  if (!device) return fail(res, 'unauthorized', '身份校验失败，请重新加入', 403);

  const kind = ['text', 'image', 'sticker', 'nudge'].includes(data.kind) ? data.kind : 'text';
  const text = kind === 'text' ? String(data.text || '').slice(0, 4000).trim() : '';
  const mediaId = data.mediaId ? String(data.mediaId) : null;
  if (kind === 'text' && !text) return fail(res, 'empty', '消息是空的');
  if (kind === 'image' || kind === 'sticker') {
    if (!mediaId) return fail(res, 'empty', '没有上传成功的图片');
  }
  if (mediaId && !q.mediaById.get(mediaId)) return fail(res, 'no_media', '图片不存在');

  // @提醒 / 拍一拍的目标：房里的人。匿名设备用设备 id，登录的人用 "u:<userId>"
  const members = q.members.all(roomId);
  const personTokens = new Set();
  for (const d of members) {
    personTokens.add(d.id);
    if (d.user_id) personTokens.add('u:' + d.user_id);
  }
  const wanted = Array.isArray(data.mentions) ? data.mentions : [];
  const mentions = [...new Set(wanted.map((x) => String(x).slice(0, 64)))].filter((tok) =>
    personTokens.has(tok)
  );
  if (kind === 'nudge' && !mentions.length) return fail(res, 'no_target', '没有指定要拍谁');
  if (kind === 'nudge' && mentions.length > 1) mentions.length = 1;

  const clientId = String(data.clientId || '').slice(0, 64) || null;
  if (clientId) {
    const dup = q.messageByClient.get(roomId, clientId);
    if (dup) return ok(res, { message: publicMessage(dup), duplicated: true });
  }

  // 引用回复：只接受「这个房间里真实存在的一条消息」，原文以库里的为准
  let replyJson = null;
  const rpId = data.reply && data.reply.id ? String(data.reply.id).slice(0, 40) : '';
  if (rpId) {
    const src = q.messageById.get(rpId);
    if (src && src.room_id === roomId) {
      const rpText = String(src.text || '').replace(/\[\[st:[^\]]*\]\]/g, '[表情]').slice(0, 160);
      replyJson = JSON.stringify({ id: src.id, name: src.device_name || '', text: rpText });
    }
  }

  const id = rid(8);
  const t = now();
  q.insertMessage.run(
    id,
    roomId,
    device.id,
    device.name,
    kind,
    text,
    mediaId,
    t,
    clientId,
    mentions.length ? JSON.stringify(mentions) : null,
    replyJson,
    device.user_id || null
  );
  q.touchRoom.run(t, roomId);
  q.seenDevice.run(t, device.id);
  if (mediaId) q.attachMedia.run(roomId, mediaId);

  const msg = publicMessage(q.messageById.get(id));
  ok(res, { message: msg });
  broadcast(roomId, 'message', { message: msg });
}

async function handleLeave(req, res, roomId, body) {
  const data = readJson(body);
  const device = authDevice(roomId, data.deviceId, data.token);
  if (!device) return fail(res, 'unauthorized', '身份校验失败', 403);
  q.deleteDevice.run(device.id);
  q.delMember.run(roomId, device.id);
  disconnectDevice(roomId, device.id, '已退出这个群');
  ok(res, { members: rosterOf(roomId) });
  broadcast(roomId, 'members', { members: rosterOf(roomId) });
  // 最后一个人退出 → 这个频道没人了，直接连图片一起清掉，不留空壳
  if (!q.members.all(roomId).length) {
    log('room empty, purging', roomId);
    broadcast(roomId, 'dissolved', { roomId, reason: 'empty' });
    await purgeRoom(db, { mediaDir: MEDIA_DIR, roomId, log });
  }
}

/* ------------------------------------------------- 闲置自动解散 + 投票踢人 */

/** 30 天没人说话 → 后 3 天进入倒计时；倒计时结束就解散 */
function roomTiming(room) {
  const warnFrom = room.last_active + IDLE_DISSOLVE_MS;
  const dissolveAt = warnFrom + IDLE_GRACE_MS;
  const t = now();
  return {
    idleMs: Math.max(0, t - room.last_active),
    warnFrom,
    dissolveAt,
    warn: t >= warnFrom && t < dissolveAt,
    daysLeft: t >= warnFrom ? Math.max(0, Math.ceil((dissolveAt - t) / DAY)) : 0
  };
}

function publicRoom(room) {
  const tm = roomTiming(room);
  return {
    id: room.id,
    code: room.code,
    note: room.note || '',
    createdAt: room.created_at,
    lastActive: room.last_active,
    maxMembers: MAX_MEMBERS,
    idleMs: tm.idleMs,
    warnFrom: tm.warnFrom,
    dissolveAt: tm.dissolveAt,
    warn: tm.warn,
    daysLeft: tm.daysLeft
  };
}

/**
 * 把设备归并成「人」：同一账号的多台设备算一个人（key = 'u:<uid>'），
 * 匿名设备各自算一个人（key = device id）。投票 / @ / 拍一拍都用这个 key。
 */
function peopleOf(roomId) {
  const map = new Map();
  for (const d of q.members.all(roomId)) {
    const key = d.user_id ? 'u:' + d.user_id : d.id;
    let p = map.get(key);
    if (!p) {
      p = { key, userId: d.user_id || null, name: d.name, deviceIds: [], online: false };
      map.set(key, p);
    }
    p.deviceIds.push(d.id);
    if (!p.name || (p.userId && d.name)) p.name = d.name;
  }
  const online = onlineOf(roomId);
  for (const p of map.values()) p.online = p.deviceIds.some((id) => online.has(id));
  return [...map.values()];
}

function personKeyOf(roomId, deviceId) {
  const d = q.memberById.get(String(deviceId || ''));
  if (!d || d.room_id !== roomId) return null;
  return d.user_id ? 'u:' + d.user_id : d.id;
}

/** 投票的票数：只有「除被踢者这个人以外」的人在册，一人一票 */
function tallyVote(v) {
  const people = peopleOf(v.room_id);
  const eligible = people.filter((p) => p.key !== v.target_id);
  const ballots = q.voteBallots.all(v.id).filter((b) => eligible.some((p) => p.key === b.device_id));
  const yes = ballots.filter((b) => b.yes).length;
  return {
    eligible,
    ballots,
    yes,
    no: ballots.length - yes,
    // 必须「过半」才算通过：4 人房 3 人同意、3 人房 2 人同意（都不含被投者自己）
    need: Math.floor((eligible.length + 1) / 2) + 1
  };
}

function publicVote(v, viewerId) {
  const t = tallyVote(v);
  const myKey = viewerId ? personKeyOf(v.room_id, viewerId) : null;
  const mine = myKey ? q.myBallot.get(v.id, myKey) : null;
  return {
    id: v.id,
    kind: v.kind,
    targetId: v.target_id,
    targetName: v.target_name || '',
    startedBy: v.started_by || '',
    startedAt: v.started_at,
    closesAt: v.closes_at,
    status: v.status,
    yes: t.yes,
    no: t.no,
    need: t.need,
    eligible: t.eligible.length,
    mine: mine ? !!mine.yes : null,
    voters: t.ballots.map((b) => ({ deviceId: b.device_id, yes: !!b.yes })),
    people: peopleOf(v.room_id).map((p) => ({
      key: p.key,
      userId: p.userId,
      name: p.name,
      devices: p.deviceIds.length,
      online: p.online
    }))
  };
}

function votesOf(roomId, viewerId) {
  return q.votesRecent.all(roomId).map((v) => publicVote(v, viewerId));
}

function broadcastVotes(roomId) {
  broadcast(roomId, 'votes', { votes: q.votesOpen.all(roomId).map((v) => publicVote(v, null)) });
}

/** 票数够了就踢人；全投完 / 超时则结算 */
function settleVote(v) {
  if (!v || v.status !== 'open') return v;
  const t = tallyVote(v);
  if (t.yes >= t.need && t.eligible.length > 0) {
    q.closeVote.run('passed', v.id);
    // 被投的是「一个人」：账号就把这个账号在这个频道的所有设备都清掉
    const kicked = [];
    if (String(v.target_id).startsWith('u:')) {
      const uid = String(v.target_id).slice(2);
      for (const d of q.devicesOfUser.all(v.room_id, uid)) kicked.push(d);
    } else {
      const d = q.memberById.get(v.target_id);
      if (d && d.room_id === v.room_id) kicked.push(d);
    }
    if (kicked.length) {
      for (const d of kicked) {
        q.deleteDevice.run(d.id);
        q.delMember.run(v.room_id, d.id);
        disconnectDevice(v.room_id, d.id, '被群成员投票移出');
      }
      log('vote passed, kicked', v.room_id, kicked.map((d) => d.name).join(','), t.yes + '/' + t.need);
      broadcast(v.room_id, 'members', { members: rosterOf(v.room_id) });
      if (!q.members.all(v.room_id).length) {
        purgeRoom(db, { mediaDir: MEDIA_DIR, roomId: v.room_id, log });
      }
    }
    return q.voteById.get(v.id);
  }
  const done = t.ballots.length >= t.eligible.length;
  if (done || now() >= v.closes_at) {
    q.closeVote.run('rejected', v.id);
    return q.voteById.get(v.id);
  }
  return v;
}

async function handleVotes(req, res, roomId, url) {
  const room = q.roomById.get(roomId);
  if (!room) return fail(res, 'no_room', '房间不存在', 404);
  const me = authDevice(roomId, url.searchParams.get('device'), url.searchParams.get('token'));
  if (!me) return fail(res, 'unauthorized', '身份校验失败', 403);
  // 顺手把过期/满票的投票结算掉
  for (const v of q.votesOpen.all(roomId)) settleVote(v);
  ok(res, { votes: votesOf(roomId, me.id) });
}

async function handleVoteStart(req, res, roomId, body) {
  const room = q.roomById.get(roomId);
  if (!room) return fail(res, 'no_room', '房间不存在', 404);
  const data = readJson(body);
  const me = authDevice(roomId, data.deviceId, data.token);
  if (!me) return fail(res, 'unauthorized', '身份校验失败', 403);
  const targetKey = String(data.target || '').slice(0, 64);
  const people = peopleOf(roomId);
  const target = people.find((p) => p.key === targetKey);
  if (!target) return fail(res, 'no_target', '这个人不在这个频道里', 404);
  const myKey = personKeyOf(roomId, me.id);
  if (target.key === myKey) return fail(res, 'self', '不能投票踢自己，直接「退出频道」就行');
  // 只有两个人时不投票：这种情况下「过半」没有意义，退群请直接走「退出频道」
  if (people.length <= 2) {
    return fail(res, 'too_few', '频道里只有两个人，不用投票，直接退出就行');
  }
  const running = q.votesOpen.all(roomId).find((v) => v.target_id === target.key);
  if (running) return ok(res, { vote: publicVote(running, me.id), duplicated: true });

  const t = now();
  const v = {
    id: rid(8),
    room_id: roomId,
    kind: 'kick',
    target_id: target.key,
    target_name: target.name,
    started_by: me.name,
    started_at: t,
    closes_at: t + VOTE_MS,
    status: 'open'
  };
  q.insertVote.run(v.id, v.room_id, v.kind, v.target_id, v.target_name, v.started_by, v.started_at, v.closes_at, v.status);
  log('vote started', roomId, me.name, '->', target.name);
  const pub = publicVote(v, me.id);
  broadcast(roomId, 'votes', { votes: q.votesOpen.all(roomId).map((x) => publicVote(x, null)) });
  ok(res, { vote: pub });
}

async function handleVoteBallot(req, res, roomId, voteId, body) {
  const room = q.roomById.get(roomId);
  if (!room) return fail(res, 'no_room', '房间不存在', 404);
  const data = readJson(body);
  const me = authDevice(roomId, data.deviceId, data.token);
  if (!me) return fail(res, 'unauthorized', '身份校验失败', 403);
  const v = q.voteById.get(voteId);
  if (!v || v.room_id !== roomId) return fail(res, 'no_vote', '没有这个投票', 404);
  if (v.status !== 'open') return fail(res, 'closed', '这个投票已经结束了', 409);
  const myKey = personKeyOf(roomId, me.id);
  if (v.target_id === myKey) return fail(res, 'self', '被投票的人不能投票');
  q.putBallot.run(v.id, myKey, data.yes ? 1 : 0, now());
  const settled = settleVote(q.voteById.get(v.id));
  broadcast(roomId, 'votes', { votes: q.votesOpen.all(roomId).map((x) => publicVote(x, null)) });
  ok(res, { vote: publicVote(settled, me.id), votes: votesOf(roomId, me.id) });
}

/* ------------------------------------------------- 已读位置（按人） */

function unreadOf(roomId, deviceId) {
  const row = q.memberRow.get(roomId, deviceId);
  const lastId = row && row.last_read_id ? row.last_read_id : '';
  if (!lastId) return { lastReadId: null, unread: q.countAfter.get(roomId, 0).c };
  const m = q.messageById.get(lastId);
  if (!m) return { lastReadId: lastId, unread: q.countAfter.get(roomId, 0).c };
  return { lastReadId: lastId, unread: q.countAfter.get(roomId, m.created_at).c };
}

async function handleReadState(req, res, roomId, url) {
  const room = q.roomById.get(roomId);
  if (!room) return fail(res, 'no_room', '房间不存在', 404);
  const me = authDevice(roomId, url.searchParams.get('device'), url.searchParams.get('token'));
  if (!me) return fail(res, 'unauthorized', '身份校验失败', 403);
  ok(res, unreadOf(roomId, me.id));
}

async function handleReadMark(req, res, roomId, body) {
  const room = q.roomById.get(roomId);
  if (!room) return fail(res, 'no_room', '房间不存在', 404);
  const data = readJson(body);
  const me = authDevice(roomId, data.deviceId, data.token);
  if (!me) return fail(res, 'unauthorized', '身份校验失败', 403);

  let mid = String(data.messageId || '').slice(0, 40);
  if (!mid) {
    // 不指定就用「这个频道最新的一条」，等价于「我都看过了」
    const latest = q.messagesLatest.all(roomId, 1)[0];
    mid = latest ? latest.id : '';
  }
  if (mid) {
    const m = q.messageById.get(mid);
    if (!m || m.room_id !== roomId) return fail(res, 'no_message', '这条消息不在这个频道里', 404);
    q.upsertMember.run(roomId, me.id, me.user_id || null, now());
    q.setRead.run(mid, roomId, me.id);
  }
  // 同一个人的其它设备也要把红点清掉（匿名设备没有 user_id，只有自己）
  if (me.user_id) {
    broadcast(roomId, 'read', { userId: me.user_id, deviceId: me.id, messageId: mid || null }, me.id);
  }
  ok(res, { lastReadId: mid || null, unread: 0 });
}

/** 每 10 分钟扫一次：到了解散时间的频道，连图片/表情一起清掉 */
async function sweepRooms() {
  const t = now();
  for (const room of q.allRooms.all()) {
    const tm = roomTiming(room);
    if (t < tm.dissolveAt) continue;
    log('room idle too long, dissolving', room.id, room.code, 'idleDays=', Math.floor(tm.idleMs / DAY));
    broadcast(room.id, 'dissolved', { roomId: room.id, reason: 'idle' });
    for (const e of streams.get(room.id) || []) {
      try {
        e.res.end();
      } catch {
        /* ignore */
      }
      clearInterval(e.timer);
    }
    streams.delete(room.id);
    await purgeRoom(db, { mediaDir: MEDIA_DIR, roomId: room.id, log });
  }
}

setTimeout(sweepRooms, 6000);
setInterval(sweepRooms, 10 * 60 * 1000);

/**
 * 投票看门狗：5 分钟到点、或该投的都投完了，立刻结算并推给房间。
 * 光靠请求触发结算的话，没人操作时票会一直挂着不关。
 */
function sweepVotes() {
  let open = [];
  try {
    open = q.votesOpenAll.all();
  } catch {
    return;
  }
  for (const v of open) {
    const after = settleVote(v);
    if (after && after.status !== 'open') {
      log('vote settled', v.room_id, v.id, after.status, v.target_name || '');
      broadcast(v.room_id, 'votes', {
        votes: q.votesOpen.all(v.room_id).map((x) => publicVote(x, null))
      });
    }
  }
}
setInterval(sweepVotes, 10 * 1000);


/**
 * 文件中转站：把一个文件（或打包好的 zip）传进又拍云，返回公开链接。
 * 客户端在自己电脑和另一台电脑之间传文件时用，不经过聊天房间。
 * 请求头：
 *   X-Island-Name   文件名（URL 编码，保底 200 字符）
 *   X-Island-App    共享口令（upyun.json 的 appToken，可选校验）
 *   Content-Type    原始类型
 */
async function handleFileUpload(req, res) {
  if (!upyunReady()) return fail(res, 'cloud_off', '云存储还没配置好', 503);
  const cfg = upyunConfig();
  if (cfg.appToken) {
    const got = String(req.headers['x-island-app'] || '');
    if (got !== cfg.appToken) return fail(res, 'unauthorized', '口令不对', 403);
  }
  const rawName = decodeURIComponent(String(req.headers['x-island-name'] || 'file')).slice(-160);
  const name = rawName.replace(/[\\/:*?"<>|\r\n]+/g, '_') || 'file';
  const mime = String(req.headers['content-type'] || 'application/octet-stream').split(';')[0].trim();

  const buf = await readBody(req, MAX_FILE_UPLOAD);
  if (!buf || !buf.length) return fail(res, 'empty', '没有收到文件', 400);

  const d = new Date();
  const ym = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0');
  const key = `${cfg.prefix}/files/${ym}/${rid(9)}-${name}`;
  const up = await putObject(key, buf, mime);
  if (!up.ok) {
    console.error('[upyun] file upload failed', up.status, up.message);
    return fail(res, 'cloud_failed', '上传到云存储失败：' + (up.message || '未知错误'), 502);
  }
  ok(res, { url: up.url, key: up.key, name, bytes: buf.length, mime });
}

/**
 * 又拍云的 `!default` 缩略图是「第一次被访问时才生成」的，
 * 所以上传完要主动把它拉一次，等它真的可用再返回，
 * 这样消息广播出去时，对方的通知条/bubble 立刻就有小图。
 */
async function warmThumb(url, tries = 10, gap = 250) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(5000) });
      if (r.ok) {
        const buf = await r.arrayBuffer();
        if (buf.byteLength > 0) return true;
      }
    } catch {
      /* 还没生成好，等一会儿再试 */
    }
    await new Promise((r) => setTimeout(r, gap));
  }
  return false;
}

async function handleUpload(req, res, url) {
  const mime = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  const ext = MIME_EXT[mime];
  if (!ext) return fail(res, 'bad_type', '只支持 png / jpg / webp / gif 图片', 415);

  const buf = await readBody(req, MAX_UPLOAD);
  if (!buf || !buf.length) return fail(res, 'empty', '没有收到文件');

  const id = rid(9);
  const file = id + '.' + ext;
  const room = String(url.searchParams.get('room') || '').replace(/[^A-Za-z0-9_-]/g, '');

  // 优先传到又拍云：聊天里的图都走 CDN，服务器只留数据库记录
  let stored = file;
  if (upyunReady()) {
    const cfg = upyunConfig();
    const key = `${cfg.prefix}/chat/${room || 'misc'}/${file}`;
    const up = await putObject(key, buf, mime);
    if (!up.ok) {
      console.error('[upyun] upload failed', up.status, up.message);
      return fail(res, 'cloud_failed', '上传到云存储失败：' + (up.message || '未知错误'), 502);
    }
    stored = 'cloud:' + key;
  } else {
    fs.writeFileSync(path.join(MEDIA_DIR, file), buf);
  }

  q.insertMedia.run(
    id,
    room || null,
    mime,
    buf.length,
    Number(url.searchParams.get('w')) || null,
    Number(url.searchParams.get('h')) || null,
    stored,
    now()
  );
  const pub = stored.startsWith('cloud:') ? publicUrl(stored.slice(6)) : PREFIX + '/media/' + file;
  const thumb = stored.startsWith('cloud:') ? thumbUrl(pub) : pub;
  // 云存储的缩略图是懒生成的：这里等它生成好，再让客户端发消息
  let thumbReady = true;
  if (stored.startsWith('cloud:')) {
    thumbReady = await warmThumb(thumb);
    if (!thumbReady) log('[upyun] thumb warm-up timeout', thumb);
  }
  ok(res, {
    mediaId: id,
    url: pub,
    thumb,
    thumbReady,
    bytes: buf.length,
    mime,
    cloud: stored.startsWith('cloud:')
  });
}

function handleMedia(req, res, file) {
  const safe = path.basename(file);
  const full = path.join(MEDIA_DIR, safe);
  if (!fs.existsSync(full)) return fail(res, 'not_found', '图片不存在', 404);
  const ext = path.extname(safe).slice(1).toLowerCase();
  const mime =
    Object.entries(MIME_EXT).find(([, e]) => e === ext)?.[0] || 'application/octet-stream';
  const buf = fs.readFileSync(full);
  res.writeHead(200, {
    'Content-Type': mime,
    'Content-Length': buf.length,
    'Cache-Control': 'public, max-age=31536000, immutable',
    ...cors()
  });
  res.end(buf);
}

function handleStream(req, res, url) {
  const roomId = url.searchParams.get('room') || '';
  const deviceId = url.searchParams.get('device') || '';
  const token = url.searchParams.get('token') || '';
  const device = authDevice(roomId, deviceId, token);
  if (!device) return fail(res, 'unauthorized', '身份校验失败', 403);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    ...cors()
  });
  res.write('retry: 3000\n\n');

  const entry = { res, deviceId, name: device.name, timer: null };
  if (!streams.has(roomId)) streams.set(roomId, new Set());
  streams.get(roomId).add(entry);
  q.seenDevice.run(now(), deviceId);

  const roomRow = q.roomById.get(roomId);
  sendEvent(entry, 'hello', {
    roomId,
    deviceId,
    room: roomRow ? publicRoom(roomRow) : null,
    votes: votesOf(roomId, deviceId),
    online: [...onlineOf(roomId)],
    members: rosterOf(roomId),
    stickers: stickersOf(roomId)
  });
  presence(roomId);

  entry.timer = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      /* ignore */
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(entry.timer);
    const set = streams.get(roomId);
    if (set) {
      set.delete(entry);
      if (!set.size) streams.delete(roomId);
    }
    presence(roomId);
  });
}

/* ------------------------------------------------------------- 网页版 */

const WEB_MIME = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  png: 'image/png',
  svg: 'image/svg+xml',
  ico: 'image/x-icon'
};

/* ------------------------------------------------------- 热更新（latest.json + 安装包） */

const UPDATE_DIR = process.env.ISLAND_UPDATE || path.join(DATA_DIR, '..', 'update');

function handleUpdateManifest(res) {
  const file = path.join(UPDATE_DIR, 'latest.json');
  if (!fs.existsSync(file)) return fail(res, 'no_update', '还没有发布过版本', 404);
  const buf = fs.readFileSync(file);
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': buf.length,
    'Cache-Control': 'no-cache'
  });
  res.end(buf);
}

function handleUpdateFile(req, res, p) {
  const name = path.basename(p.replace('/update/', ''));
  if (!/^[A-Za-z0-9._-]+$/.test(name)) return fail(res, 'bad_name', '文件名不合法', 400);
  const full = path.join(UPDATE_DIR, name);
  if (!full.startsWith(UPDATE_DIR) || !fs.existsSync(full))
    return fail(res, 'not_found', 'not found', 404);
  const stat = fs.statSync(full);
  const type = name.endsWith('.json')
    ? 'application/json; charset=utf-8'
    : 'application/octet-stream';
  const range = req.headers.range;
  if (range && /^bytes=\d*-\d*$/.test(range)) {
    const [a, b] = range.replace('bytes=', '').split('-');
    const start = a ? Number(a) : 0;
    const end = b ? Math.min(Number(b), stat.size - 1) : stat.size - 1;
    if (start >= stat.size) {
      res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
      return res.end();
    }
    res.writeHead(206, {
      'Content-Type': type,
      'Content-Length': end - start + 1,
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes'
    });
    return fs.createReadStream(full, { start, end }).pipe(res);
  }
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': stat.size,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=300'
  });
  fs.createReadStream(full).pipe(res);
}

const fmtSize = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB');
const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function handleDownloadPage(req, res) {
  let meta = null;
  try {
    meta = JSON.parse(fs.readFileSync(path.join(UPDATE_DIR, 'latest.json'), 'utf8'));
  } catch {
    meta = null;
  }
  const dir = path.dirname(new URL(req.url, 'http://x').pathname); // /island
  const file = meta && /^[A-Za-z0-9._-]+$/.test(meta.file || '') ? meta.file : '';
  const direct = file ? `${dir}/update/${encodeURIComponent(file)}` : '';
  const cloud = upyunReady() ? upyunConfig() : null;
  const mirror =
    file && cloud && cloud.domain
      ? `${cloud.domain.replace(/\/+$/, '')}/${(cloud.prefix || 'island').replace(/^\/+|\/+$/g, '')}/update/${encodeURIComponent(file)}`
      : '';
  const version = (meta && meta.version) || '—';
  const size = meta && meta.size ? fmtSize(meta.size) : '';
  const notes = (meta && meta.notes) || '';
  const at = (meta && meta.at) || '';

  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Qing Tools ${esc(version)} 下载</title>
<style>
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
background:radial-gradient(1200px 600px at 50% -10%,#1c2033,#080a12 60%,#05060b);
font:15px/1.65 "Segoe UI","Microsoft YaHei",system-ui,sans-serif;color:#e8ebf7;padding:28px}
.card{width:100%;max-width:520px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);
border-radius:22px;padding:30px 30px 26px;box-shadow:0 24px 70px rgba(0,0,0,.55);backdrop-filter:blur(18px)}
.pill{display:inline-flex;align-items:center;gap:7px;height:26px;padding:0 11px;border-radius:999px;
background:rgba(143,123,255,.16);color:#c9c1ff;font-size:12px;letter-spacing:.02em}
.dot{width:6px;height:6px;border-radius:50%;background:#8f7bff;box-shadow:0 0 8px #8f7bff}
h1{margin:16px 0 6px;font-size:25px;letter-spacing:-.02em}
.sub{margin:0 0 22px;color:#9aa2ba;font-size:13.5px}
.btn{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;height:52px;border:0;
border-radius:14px;background:linear-gradient(180deg,#9a88ff,#7c66f5);color:#fff;font-size:15.5px;
font-weight:600;text-decoration:none;cursor:pointer;box-shadow:0 10px 26px rgba(124,102,245,.4);
transition:transform .15s ease,box-shadow .15s ease}
.btn:hover{transform:translateY(-1px);box-shadow:0 14px 30px rgba(124,102,245,.5)}
.meta{display:flex;gap:16px;flex-wrap:wrap;margin:16px 2px 0;color:#8f97ae;font-size:12.5px}
.meta b{color:#dfe4f4;font-weight:600}
.hr{height:1px;background:rgba(255,255,255,.08);margin:22px 0 18px}
h2{margin:0 0 8px;font-size:13px;color:#9aa2ba;font-weight:600;letter-spacing:.04em;text-transform:uppercase}
ol,ul{margin:0;padding-left:19px;color:#a9b1c6;font-size:13px}
li{margin:5px 0}
li b{color:#dfe4f4;font-weight:600}
code{background:rgba(255,255,255,.08);padding:1px 6px;border-radius:5px;font-size:12px}
.notes{margin:0 0 4px;color:#b9c0d4;font-size:13px;padding:10px 12px;border-radius:10px;
background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06)}
.alt{margin:14px 0 0;font-size:12px;color:#7d859b;word-break:break-all}
.alt a{color:#a99cff;text-decoration:none}
.foot{margin:20px 0 0;font-size:11.5px;color:#636b81;text-align:center}
@media(max-width:520px){.card{padding:24px 20px}}
</style></head><body><div class="card">
<span class="pill"><i class="dot"></i>Windows 10 / 11 · x64</span>
<h1>Qing Tools <span style="color:#a99cff">${esc(version)}</span></h1>
<p class="sub">顶部灵动岛 / 刘海 · 邮件推送 · 备忘录 · 剪贴板 · 文件暂存 · 小纸条 · 计时器</p>
${direct ? `<a class="btn" href="${esc(direct)}" download>下载安装包</a>` : '<p class="notes">还没有发布任何版本。</p>'}
<div class="meta">${size ? `<span>大小 <b>${esc(size)}</b></span>` : ''}${at ? `<span>发布于 <b>${esc(at)}</b></span>` : ''}<span>安装后自动开机启动</span></div>
${notes ? `<div class="hr"></div><h2>本次更新</h2><p class="notes">${esc(notes)}</p>` : ''}
<div class="hr"></div>
<h2>安装</h2>
<ol>
<li>双击安装包，装到 <code>%LOCALAPPDATA%\\Programs\\dynamic-island</code></li>
<li>如果弹出「Windows 已保护你的电脑」，点 <b>更多信息 → 仍要运行</b>（没有代码签名证书，属于正常提示）</li>
<li>首次运行后自动写入开机启动项，可在设置里关掉</li>
</ol>
<div class="hr"></div>
<h2>装好之后</h2>
<ul>
<li>鼠标移到屏幕顶部正中的药丸上展开，<b>Ctrl+K</b> 打开命令面板</li>
<li>邮箱：设置 → 邮箱，QQ/163 用授权码；微软邮箱要用「账户授权」（程序里有 6 步指引）</li>
<li>小纸条：新建频道拿到 12 位匹配码，发给朋友填码加入（最多 4 台）</li>
</ul>
${mirror ? `<p class="alt">下载慢？用 CDN 镜像：<a href="${esc(mirror)}" download>${esc(mirror)}</a></p>` : ''}
<p class="foot">文件校验 SHA-256：${esc((meta && meta.sha256) || '—')}</p>
</div></body></html>`;

  const buf = Buffer.from(html, 'utf8');
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': buf.length,
    'Cache-Control': 'no-cache'
  });
  res.end(buf);
}

function serveWeb(res, file) {
  const safe = path.basename(file || 'index.html');
  const full = path.join(WEB_DIR, safe);
  if (!full.startsWith(WEB_DIR) || !fs.existsSync(full))
    return fail(res, 'not_found', 'not found', 404);
  const ext = path.extname(safe).slice(1).toLowerCase();
  const buf = fs.readFileSync(full);
  res.writeHead(200, {
    'Content-Type': WEB_MIME[ext] || 'application/octet-stream',
    'Content-Length': buf.length,
    'Cache-Control': 'no-cache',
    ...cors()
  });
  res.end(buf);
}

/* ------------------------------------------------------------ routing */

/* ------------------------------------------------------------- 账号体系 */
// 密码与恢复码都用 scrypt（Node 内置，不引入原生依赖）
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 128 * 1024 * 1024 };
const SESSION_TTL = 90 * DAY;
const REC_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
const MIN_PW = 8;

function scryptHash(secret, salt = crypto.randomBytes(16).toString('hex')) {
  const buf = crypto.scryptSync(String(secret).normalize('NFKC'), salt, 32, SCRYPT);
  return { salt, hash: buf.toString('hex') };
}

function scryptCheck(secret, salt, expected) {
  if (!salt || !expected) return false;
  let buf;
  try {
    buf = crypto.scryptSync(String(secret).normalize('NFKC'), salt, 32, SCRYPT);
  } catch {
    return false;
  }
  const a = Buffer.from(String(expected), 'hex');
  return a.length === buf.length && crypto.timingSafeEqual(a, buf);
}

function newRecoveryCode() {
  const buf = crypto.randomBytes(12);
  const ch = [...buf].map((b) => REC_ALPHABET[b % REC_ALPHABET.length]);
  return [ch.slice(0, 4).join(''), ch.slice(4, 8).join(''), ch.slice(8, 12).join('')].join('-');
}

const normRecovery = (s) => String(s || '').toUpperCase().replace(/[^0-9A-Z]/g, '');

function ipOf(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || req.socket.remoteAddress || 'unknown';
}

// 简易滑动窗口限流：key → 最近命中时间
const authHits = new Map();
function tooMany(key, max, winMs) {
  const t = now();
  const arr = (authHits.get(key) || []).filter((x) => t - x < winMs);
  if (arr.length >= max) {
    authHits.set(key, arr);
    return true;
  }
  arr.push(t);
  authHits.set(key, arr);
  if (authHits.size > 5000) authHits.clear();
  return false;
}

// 同一用户名连续错 5 次 → 锁 15 分钟
const loginLocks = new Map();
function loginLocked(lc) {
  const l = loginLocks.get(lc);
  if (!l) return 0;
  if (l.until && l.until > now()) return l.until;
  if (l.until && l.until <= now()) loginLocks.delete(lc);
  return 0;
}
function loginFail(lc) {
  const l = loginLocks.get(lc) || { fails: [], until: 0 };
  l.fails = l.fails.filter((t) => now() - t < 15 * 60000);
  l.fails.push(now());
  if (l.fails.length >= 5) {
    l.until = now() + 15 * 60000;
    l.fails = [];
  }
  loginLocks.set(lc, l);
}
function loginOk(lc) {
  loginLocks.delete(lc);
}

function publicUser(u, self = false) {
  const out = { id: u.id, username: u.username, nick: u.nick || u.username, createdAt: u.created_at };
  if (self) out.deletedAt = u.deleted_at || 0;
  return out;
}

function publicSession(s, currentId) {
  return {
    id: s.id,
    deviceName: s.device_name || '未命名设备',
    createdAt: s.created_at,
    lastSeen: s.last_seen,
    current: s.id === currentId
  };
}

function bearerOf(req) {
  const h = String(req.headers.authorization || '');
  if (/^Bearer\s+/i.test(h)) return h.replace(/^Bearer\s+/i, '').trim();
  return String(req.headers['x-island-session'] || '').trim();
}

/** 会话 token（明文）→ 用户；SSE 不能带 header，所以也可能从 ?token= 传进来 */
function userByRawToken(raw) {
  try {
    if (!raw) return null;
    const s = q.sessionByHash.get(hash(raw));
    if (!s || s.revoked_at || s.expires_at < now()) return null;
    const u = q.userById.get(s.user_id);
    if (!u || u.deleted_at) return null;
    return u;
  } catch {
    return null;
  }
}

/**
 * 软身份：带了合法 token 就返回账号，没带或过期返回 null。
 * 频道接口用它给设备/消息打上「这是谁」，匿名设备照旧能用。
 */
function softUser(req) {
  try {
    return userByRawToken(bearerOf(req));
  } catch {
    return null;
  }
}

function requireUser(req, res) {  const raw = bearerOf(req);
  if (!raw) {
    fail(res, 'unauthorized', '请先登录', 401);
    return null;
  }
  const s = q.sessionByHash.get(hash(raw));
  if (!s || s.revoked_at || s.expires_at < now()) {
    fail(res, 'unauthorized', '登录已过期，请重新登录', 401);
    return null;
  }
  const u = q.userById.get(s.user_id);
  if (!u || u.deleted_at) {
    fail(res, 'unauthorized', '账号不可用', 401);
    return null;
  }
  q.touchSession.run(now(), s.id);
  return { user: u, session: s };
}

function newSession(userId, deviceName, ua) {
  const raw = crypto.randomBytes(32).toString('base64url');
  const id = 'ses_' + rid(6);
  q.insertSession.run(
    id,
    userId,
    hash(raw),
    String(deviceName || '').slice(0, 60),
    String(ua || '').slice(0, 200),
    now(),
    now(),
    now() + SESSION_TTL
  );
  return { id, token: raw, expiresAt: now() + SESSION_TTL };
}

function badName(name) {
  return !USERNAME_RE.test(String(name || ''));
}

function handleAuthCheck(req, res, url) {
  if (tooMany('check:' + ipOf(req), 60, 3600e3)) return fail(res, 'rate_limited', '试得有点频繁，歇一会儿再试');
  const name = String(url.searchParams.get('u') || '').trim();
  if (badName(name)) return fail(res, 'bad_username', '用户名要 3–20 位，只能是字母、数字、下划线');
  const u = q.userByName.get(name.toLowerCase());
  return ok(res, { available: !u, reserved: !!(u && u.deleted_at) });
}

async function handleAuthRegister(req, res, body) {
  const ip = ipOf(req);
  if (tooMany('reg:' + ip, 10, 3600e3)) return fail(res, 'rate_limited', '注册太频繁了，过一会儿再试');
  const b = readJson(body);
  const username = String(b.username || '').trim();
  const password = String(b.password || '');
  const nick = String(b.nick || '').trim().slice(0, 24);
  if (badName(username)) return fail(res, 'bad_username', '用户名要 3–20 位，只能是字母、数字、下划线');
  if (password.length < MIN_PW) return fail(res, 'weak_password', '密码至少 8 位');
  if (password.length > 128) return fail(res, 'weak_password', '密码太长了');
  const lc = username.toLowerCase();
  if (q.userByName.get(lc)) return fail(res, 'taken', '这个名字已经有人用了');

  const id = 'usr_' + rid(6);
  const pw = scryptHash(password);
  const recovery = newRecoveryCode();
  const rc = scryptHash(normRecovery(recovery), pw.salt);
  q.insertUser.run(id, username, lc, nick || username, pw.hash, pw.salt, rc.hash, now(), now());
  const s = newSession(id, b.deviceName, req.headers['user-agent']);
  const u = q.userById.get(id);
  log('[auth] register', username, id, ip);
  return ok(res, { token: s.token, expiresAt: s.expiresAt, user: publicUser(u, true), recoveryCode: recovery });
}

async function handleAuthLogin(req, res, body) {
  const ip = ipOf(req);
  if (tooMany('login-ip:' + ip, 20, 3600e3)) return fail(res, 'rate_limited', '尝试太频繁了，过一会儿再试');
  const b = readJson(body);
  const username = String(b.username || '').trim();
  const password = String(b.password || '');
  if (!username || !password) return fail(res, 'bad_request', '用户名和密码都要填');
  const lc = username.toLowerCase();
  const until = loginLocked(lc);
  if (until) {
    const mins = Math.max(1, Math.ceil((until - now()) / 60000));
    return fail(res, 'locked', `试错太多次了，${mins} 分钟后再试`);
  }
  const u = q.userByName.get(lc);
  if (!u || u.deleted_at || !scryptCheck(password, u.password_salt, u.password_hash)) {
    loginFail(lc);
    return fail(res, 'bad_credentials', '用户名或密码不对');
  }
  loginOk(lc);
  const s = newSession(u.id, b.deviceName, req.headers['user-agent']);
  log('[auth] login', u.username, u.id, ip);
  return ok(res, { token: s.token, expiresAt: s.expiresAt, user: publicUser(u, true) });
}

function handleAuthMe(req, res) {
  const ctx = requireUser(req, res);
  if (!ctx) return;
  const list = q.sessionsOf.all(ctx.user.id).map((s) => publicSession(s, ctx.session.id));
  return ok(res, { user: publicUser(ctx.user, true), sessions: list });
}

function handleAuthLogout(req, res) {
  const ctx = requireUser(req, res);
  if (!ctx) return;
  q.revokeSession.run(now(), ctx.session.id);
  return ok(res, {});
}

function handleAuthLogoutAll(req, res) {
  const ctx = requireUser(req, res);
  if (!ctx) return;
  q.revokeAllSessions.run(now(), ctx.user.id);
  return ok(res, {});
}

function handleSessionRevoke(req, res, id) {
  const ctx = requireUser(req, res);
  if (!ctx) return;
  const s = q.sessionById.get(id);
  if (!s || s.user_id !== ctx.user.id) return fail(res, 'not_found', '没有这台设备');
  q.revokeSession.run(now(), id);
  return ok(res, {});
}

async function handleAuthRecover(req, res, body) {
  const ip = ipOf(req);
  if (tooMany('rec:' + ip, 10, 3600e3)) return fail(res, 'rate_limited', '试得有点频繁，歇一会儿再试');
  const b = readJson(body);
  const username = String(b.username || '').trim();
  const code = String(b.code || '');
  const password = String(b.newPassword || '');
  if (password.length < MIN_PW) return fail(res, 'weak_password', '新密码至少 8 位');
  const u = q.userByName.get(username.toLowerCase());
  if (!u || u.deleted_at || !scryptCheck(normRecovery(code), u.password_salt, u.recovery_hash)) {
    return fail(res, 'bad_recovery', '用户名或恢复码不对');
  }
  const pw = scryptHash(password);
  const recovery = newRecoveryCode();
  const rc = scryptHash(normRecovery(recovery), pw.salt);
  q.updateUserCreds.run(pw.hash, pw.salt, rc.hash, now(), u.id);
  q.revokeAllSessions.run(now(), u.id);
  const s = newSession(u.id, b.deviceName, req.headers['user-agent']);
  log('[auth] recover', u.username, u.id, ip);
  return ok(res, { token: s.token, expiresAt: s.expiresAt, user: publicUser(q.userById.get(u.id), true), recoveryCode: recovery });
}

async function handleAccountDelete(req, res, body) {
  const ctx = requireUser(req, res);
  if (!ctx) return;
  const b = readJson(body);
  const u = ctx.user;
  if (String(b.username || '').trim().toLowerCase() !== u.username_lc) return fail(res, 'bad_request', '用户名不对');
  if (!scryptCheck(String(b.password || ''), u.password_salt, u.password_hash)) return fail(res, 'bad_request', '密码不对');
  if (!scryptCheck(normRecovery(b.code), u.password_salt, u.recovery_hash)) return fail(res, 'bad_request', '恢复码不对');

  db.exec('BEGIN');
  try {
    q.revokeAllSessions.run(now(), u.id);
    db.prepare('DELETE FROM items WHERE owner_id = ?').run(u.id);
    db.prepare('DELETE FROM shares WHERE from_user = ? OR to_user = ?').run(u.id, u.id);
    db.prepare('DELETE FROM bindings WHERE from_user = ? OR to_user = ?').run(u.id, u.id);
    db.prepare('DELETE FROM changes WHERE owner_id = ?').run(u.id);
    q.tombstoneUser.run(now(), u.id);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  log('[auth] delete', u.username, u.id, ipOf(req));
  return ok(res, {});
}

// 频道认领：谁先在自己机器上点确认，频道就归谁（先到先得）
async function handleRoomClaim(req, res) {
  const ctx = requireUser(req, res);
  if (!ctx) return;
  const b = readJson(await readBody(req));
  const code = String(b.code || '').replace(/\s+/g, '');
  if (!code) return fail(res, 'bad_request', '缺少频道码');
  const room = q.roomByCode.get(code);
  if (!room) return fail(res, 'not_found', '没找到这个频道', 404);
  if (room.owner_user_id === ctx.user.id) {
    return ok(res, { claimed: false, already: true, room: { id: room.id, code: room.code } });
  }
  const r = q.claimRoom.run(ctx.user.id, code);
  if (!r.changes) return fail(res, 'taken', '这个频道已经被别的账号认领了', 409);
  log('[claim] room', room.code, '->', ctx.user.username);
  return ok(res, { claimed: true, already: false, room: { id: room.id, code: room.code } });
}

// 认领旧设备（M5 补丁）：登录前就加进来的频道，把本机设备挂到账号上，
// 这样成员列表、投票、已读才按「人」算。
async function handleRoomAttach(req, res, roomId) {
  const ctx = requireUser(req, res);
  if (!ctx) return;
  const b = readJson(await readBody(req));
  const d = authDevice(roomId, String(b.deviceId || ''), String(b.token || ''));
  if (!d) return fail(res, 'bad_device', '这台设备不在这个频道里了', 403);
  if (d.user_id && d.user_id !== ctx.user.id) {
    return fail(res, 'taken', '这台设备已经绑在别的账号上了', 409);
  }
  if (d.user_id === ctx.user.id) return ok(res, { attached: false, already: true });
  q.attachDevice.run(ctx.user.id, d.id);
  q.upsertMember.run(roomId, d.id, ctx.user.id, d.joined_at || now());
  log('[attach] device', d.id, '->', ctx.user.username, 'room', roomId);
  broadcast(roomId, 'members', { members: rosterOf(roomId) });
  return ok(res, { attached: true, already: false });
}

// 我的频道（M5 第一刀）：登录后客户端拿这份列表把别的设备上的频道自动加回来
function handleMyRooms(req, res) {
  const ctx = requireUser(req, res);
  if (!ctx) return;
  const list = q.roomsOfOwner.all(ctx.user.id).map((r) => ({
    id: r.id,
    code: r.code,
    note: r.note || '',
    createdAt: r.created_at,
    lastActive: r.last_active
  }));
  return ok(res, { rooms: list });
}

// 频道归属查询（给客户端显示「已跟账号」）
function handleRoomOwner(req, res, url) {
  const code = String(url.searchParams.get('code') || '').replace(/\s+/g, '');
  if (!code) return fail(res, 'bad_request', '缺少频道码');
  const room = q.roomByCode.get(code);
  if (!room) return fail(res, 'not_found', '没找到这个频道', 404);
  const u = room.owner_user_id ? q.userById.get(room.owner_user_id) : null;
  return ok(res, {
    owner: u && !u.deleted_at ? { id: u.id, username: u.username, nick: u.nick || u.username } : null,
    claimed: !!room.owner_user_id
  });
}

// ── 亲密好友（绑定）与事项分享（M6） ────────────────────────────────
const MAX_FRIENDS = 3;

function friendOf(u) {
  if (!u) return null;
  return { id: u.id, username: u.username, nick: u.nick || u.username };
}

function acceptedFriends(userId) {
  return db
    .prepare("SELECT * FROM bindings WHERE from_user = ? AND status = 'accepted' ORDER BY acted_at ASC")
    .all(userId)
    .map((b) => {
      const u = q.userById.get(b.to_user);
      if (!u || u.deleted_at) return null;
      return Object.assign({ bindId: b.id }, friendOf(u));
    })
    .filter(Boolean);
}

function areFriends(a, b) {
  const row = db
    .prepare("SELECT 1 AS ok FROM bindings WHERE from_user = ? AND to_user = ? AND status = 'accepted'")
    .get(a, b);
  return !!row;
}

function handleBindings(req, res) {
  const ctx = requireUser(req, res);
  if (!ctx) return;
  const me = ctx.user.id;
  const mine = db.prepare('SELECT * FROM bindings WHERE from_user = ? OR to_user = ?').all(me, me);
  const friends = acceptedFriends(me);
  const incoming = mine
    .filter((b) => b.to_user === me && b.status === 'pending')
    .map((b) => ({ id: b.id, from: friendOf(q.userById.get(b.from_user)), createdAt: b.created_at }));
  const outgoing = mine
    .filter((b) => b.from_user === me && b.status === 'pending')
    .map((b) => ({ id: b.id, to: friendOf(q.userById.get(b.to_user)), createdAt: b.created_at }));
  return ok(res, { friends, incoming, outgoing, max: MAX_FRIENDS });
}

async function handleBind(req, res) {
  const ctx = requireUser(req, res);
  if (!ctx) return;
  const b = readJson(await readBody(req));
  const name = String(b.username || '').trim();
  if (badName(name)) return fail(res, 'bad_username', '用户名要 3–20 位');
  const target = q.userByName.get(name.toLowerCase());
  if (!target || target.deleted_at) return fail(res, 'not_found', '没有这个用户', 404);
  if (target.id === ctx.user.id) return fail(res, 'bad_request', '不能绑定自己');
  if (acceptedFriends(ctx.user.id).length >= MAX_FRIENDS) return fail(res, 'limit', `最多绑定 ${MAX_FRIENDS} 个人`);
  if (acceptedFriends(target.id).length >= MAX_FRIENDS) return fail(res, 'limit', '对方已经绑满 3 个人了');
  if (areFriends(ctx.user.id, target.id)) return fail(res, 'already', '你们已经是好友了');

  const reverse = db
    .prepare("SELECT * FROM bindings WHERE from_user = ? AND to_user = ? AND status = 'pending'")
    .get(target.id, ctx.user.id);
  if (reverse) {
    db.prepare("UPDATE bindings SET status = 'accepted', acted_at = ? WHERE id = ?").run(now(), reverse.id);
    const mineRow = db
      .prepare('INSERT INTO bindings (id, from_user, to_user, status, created_at, acted_at) VALUES (?,?,?,?,?,?)')
      .run('bnd_' + rid(6), ctx.user.id, target.id, 'accepted', now(), now());
    log('[bind] auto-accept', ctx.user.username, target.username);
    return ok(res, { ok: true, accepted: true, id: String(mineRow.lastInsertRowid || ''), friend: friendOf(target) });
  }

  const dup = db
    .prepare("SELECT 1 AS ok FROM bindings WHERE from_user = ? AND to_user = ? AND status = 'pending'")
    .get(ctx.user.id, target.id);
  if (dup) return fail(res, 'already', '已经发过申请了，等对方同意');
  const id = 'bnd_' + rid(6);
  db.prepare('INSERT INTO bindings (id, from_user, to_user, status, created_at) VALUES (?,?,?,?,?)').run(
    id,
    ctx.user.id,
    target.id,
    'pending',
    now()
  );
  log('[bind] request', ctx.user.username, '->', target.username);
  return ok(res, { ok: true, accepted: false, id, friend: friendOf(target) });
}

function handleBindAct(req, res, id, act) {
  const ctx = requireUser(req, res);
  if (!ctx) return;
  const row = db.prepare('SELECT * FROM bindings WHERE id = ?').get(id);
  if (!row) return fail(res, 'not_found', '没有这条申请', 404);
  if (row.to_user !== ctx.user.id && row.from_user !== ctx.user.id) return fail(res, 'not_found', '没有这条申请', 404);
  if (act === 'accept') {
    if (row.to_user !== ctx.user.id) return fail(res, 'bad_request', '只能由对方同意');
    if (row.status !== 'pending') return fail(res, 'bad_request', '这条申请已经处理过了');
    if (acceptedFriends(ctx.user.id).length >= MAX_FRIENDS) return fail(res, 'limit', `最多绑定 ${MAX_FRIENDS} 个人`);
    db.prepare("UPDATE bindings SET status = 'accepted', acted_at = ? WHERE id = ?").run(now(), id);
    const back = db
      .prepare("SELECT * FROM bindings WHERE from_user = ? AND to_user = ?")
      .get(ctx.user.id, row.from_user);
    if (back) db.prepare("UPDATE bindings SET status = 'accepted', acted_at = ? WHERE id = ?").run(now(), back.id);
    else
      db.prepare('INSERT INTO bindings (id, from_user, to_user, status, created_at, acted_at) VALUES (?,?,?,?,?,?)').run(
        'bnd_' + rid(6),
        ctx.user.id,
        row.from_user,
        'accepted',
        now(),
        now()
      );
    log('[bind] accept', ctx.user.username, row.from_user);
    return ok(res, { ok: true, accepted: true });
  }
  if (act === 'reject') {
    if (row.to_user !== ctx.user.id) return fail(res, 'bad_request', '只能由对方处理');
    db.prepare('DELETE FROM bindings WHERE id = ?').run(id);
    return ok(res, { ok: true, rejected: true });
  }
  // remove：任何一方都能解除，两个方向一起删
  db.prepare('DELETE FROM bindings WHERE (from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?)').run(
    row.from_user,
    row.to_user,
    row.to_user,
    row.from_user
  );
  log('[bind] remove', ctx.user.username, row.from_user, row.to_user);
  return ok(res, { ok: true, removed: true });
}

function shareView(s) {
  const from = q.userById.get(s.from_user);
  let snap = {};
  try {
    snap = JSON.parse(s.snapshot || '{}');
  } catch {
    snap = {};
  }
  return {
    id: s.id,
    from: friendOf(from),
    item: { kind: snap.kind === 'todo' ? 'todo' : 'note', text: String(snap.text || '').slice(0, 4000) },
    createdAt: s.created_at,
    read: !!s.read_at
  };
}

async function handleShareCreate(req, res) {
  const ctx = requireUser(req, res);
  if (!ctx) return;
  const b = readJson(await readBody(req));
  const toId = String(b.toUserId || '').trim();
  const kind = b.kind === 'todo' ? 'todo' : 'note';
  const text = String(b.text || '').slice(0, 4000);
  if (!text.trim() && !kind) return fail(res, 'bad_request', '这条事项是空的');
  const target = q.userById.get(toId);
  if (!target || target.deleted_at) return fail(res, 'not_found', '找不到这个人', 404);
  if (!areFriends(ctx.user.id, target.id)) return fail(res, 'not_friend', '你们还不是好友，先绑定一下', 403);

  const shareId = 'shr_' + rid(6);
  const itemId = 'itm_' + rid(6);
  const snap = JSON.stringify({ kind, text });
  const origin = JSON.stringify({ from: ctx.user.id, name: ctx.user.nick || ctx.user.username, shareId });
  db.exec('BEGIN');
  try {
    db.prepare(
      'INSERT INTO shares (id, from_user, to_user, source_item, snapshot, new_item_id, created_at) VALUES (?,?,?,?,?,?,?)'
    ).run(shareId, ctx.user.id, target.id, String(b.sourceItem || ''), snap, itemId, now());
    db.prepare(
      'INSERT INTO items (id, owner_id, kind, text, images, done, pinned, sort_at, created_at, updated_at, origin) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
    ).run(itemId, target.id, kind, text, '[]', 0, 0, now(), now(), now(), origin);
    db.prepare('INSERT INTO changes (owner_id, entity, entity_id, op, at) VALUES (?,?,?,?,?)').run(
      target.id,
      'item',
      itemId,
      'create',
      now()
    );
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  log('[share]', ctx.user.username, '->', target.username, kind);
  return ok(res, { ok: true, id: shareId, itemId, to: friendOf(target) });
}

function handleShareInbox(req, res) {
  const ctx = requireUser(req, res);
  if (!ctx) return;
  const rows = db
    .prepare('SELECT * FROM shares WHERE to_user = ? AND read_at IS NULL ORDER BY created_at ASC LIMIT 50')
    .all(ctx.user.id);
  return ok(res, { items: rows.map(shareView), unread: rows.length });
}

function handleShareHistory(req, res) {
  const ctx = requireUser(req, res);
  if (!ctx) return;
  const rows = db
    .prepare('SELECT * FROM shares WHERE from_user = ? OR to_user = ? ORDER BY created_at DESC LIMIT 100')
    .all(ctx.user.id, ctx.user.id);
  const items = rows.map((s) => {
    const out = s.from_user === ctx.user.id;
    const other = q.userById.get(out ? s.to_user : s.from_user);
    let snap = {};
    try {
      snap = JSON.parse(s.snapshot || '{}');
    } catch {
      snap = {};
    }
    return {
      id: s.id,
      dir: out ? 'out' : 'in',
      peer: friendOf(other),
      item: { kind: snap.kind === 'todo' ? 'todo' : 'note', text: String(snap.text || '').slice(0, 200) },
      createdAt: s.created_at,
      read: !!s.read_at
    };
  });
  return ok(res, { items });
}

function handleShareRead(req, res, id) {
  const ctx = requireUser(req, res);
  if (!ctx) return;
  const row = db.prepare('SELECT * FROM shares WHERE id = ?').get(id);
  if (!row || row.to_user !== ctx.user.id) return fail(res, 'not_found', '没有这条分享', 404);
  db.prepare('UPDATE shares SET read_at = ? WHERE id = ?').run(now(), id);
  return ok(res, { ok: true });
}

// ── M7：事项同步（items / changes / SSE）──────────────────────────

const SYNC_PAGE = 500;
const syncStreams = new Map(); // userId -> Set<res>

function syncNotify(userId, seq) {
  const set = syncStreams.get(userId);
  if (!set || !set.size) return;
  for (const res of set) {
    try {
      res.write("event: sync\ndata: " + JSON.stringify({ seq }) + "\n\n");
    } catch (_) {
      /* 断线由 close 事件清理 */
    }
  }
}

function bumpChange(ownerId, entityId, op) {
  const r = db
    .prepare("INSERT INTO changes (owner_id, entity, entity_id, op, at) VALUES (?,?,?,?,?)")
    .run(ownerId, "item", entityId, op, now());
  const seq = Number(r.lastInsertRowid) || 0;
  syncNotify(ownerId, seq);
  return seq;
}

function maxSeqOf(ownerId) {
  const r = db.prepare("SELECT MAX(seq) AS s FROM changes WHERE owner_id = ?").get(ownerId);
  return (r && r.s) || 0;
}

function cleanImages(v) {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => String(x || ""))
    .filter((x) => /^(local|cloud):[A-Za-z0-9_.\/-]{1,160}$/.test(x))
    .slice(0, 12);
}

function itemView(row) {
  let images = [];
  try {
    images = JSON.parse(row.images || "[]");
  } catch (_) {
    images = [];
  }
  let origin = null;
  try {
    origin = row.origin ? JSON.parse(row.origin) : null;
  } catch (_) {
    origin = null;
  }
  const urls = {};
  for (const k of images) {
    if (String(k).startsWith("cloud:")) urls[k] = publicUrl(String(k).slice(6));
  }
  return {
    id: row.id,
    kind: row.kind === "todo" ? "todo" : "note",
    text: row.text || "",
    images,
    urls,
    done: !!row.done,
    pinned: !!row.pinned,
    sortAt: row.sort_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    origin,
    deleted: !!row.deleted_at
  };
}

function handleItemsList(req, res, url) {
  const ctx = requireUser(req, res);
  if (!ctx) return;
  const since = Math.max(0, Number(url.searchParams.get("since")) || 0);
  const max = maxSeqOf(ctx.user.id);
  if (!since) {
    // 首次同步：给全量快照，客户端直接整体覆盖
    const rows = db
      .prepare(
        "SELECT * FROM items WHERE owner_id = ? AND deleted_at IS NULL ORDER BY sort_at DESC LIMIT 300"
      )
      .all(ctx.user.id);
    return ok(res, { full: true, since: 0, seq: max, items: rows.map(itemView) });
  }
  const rows = db
    .prepare(
      "SELECT c.seq AS cseq, i.* FROM changes c JOIN items i ON i.id = c.entity_id" +
        " WHERE c.owner_id = ? AND c.entity = ? AND c.seq > ? ORDER BY c.seq ASC LIMIT ?"
    )
    .all(ctx.user.id, "item", since, SYNC_PAGE);
  const seq = rows.length ? Number(rows[rows.length - 1].cseq) : max;
  return ok(res, { full: false, since, seq, items: rows.map(itemView), more: rows.length >= SYNC_PAGE });
}

function handleSyncPull(req, res, url) {
  return handleItemsList(req, res, url);
}

async function handleItemCreate(req, res) {
  const ctx = requireUser(req, res);
  if (!ctx) return;
  const b = readJson(await readBody(req));
  const kind = b.kind === "todo" ? "todo" : "note";
  const text = String(b.text || "").slice(0, 20000);
  const images = cleanImages(b.images);
  const pinned = b.pinned ? 1 : 0;
  const done = b.done ? 1 : 0;
  let id = String(b.id || "").trim();
  if (id && !/^[A-Za-z0-9_-]{6,48}$/.test(id)) id = "";
  const existed = id ? db.prepare("SELECT * FROM items WHERE id = ?").get(id) : null;
  if (existed && existed.owner_id !== ctx.user.id) id = "";
  if (!id || (existed && existed.deleted_at)) id = "itm_" + rid(9);
  const t = now();
  if (existed && existed.owner_id === ctx.user.id) {
    db.prepare(
      "UPDATE items SET kind = ?, text = ?, images = ?, done = ?, pinned = ?, sort_at = ?, updated_at = ?, deleted_at = NULL WHERE id = ?"
    ).run(kind, text, JSON.stringify(images), done, pinned, t, t, id);
  } else {
    db.prepare(
      "INSERT INTO items (id, owner_id, kind, text, images, done, pinned, sort_at, created_at, updated_at, origin) VALUES (?,?,?,?,?,?,?,?,?,?,NULL)"
    ).run(id, ctx.user.id, kind, text, JSON.stringify(images), done, pinned, t, t, t);
  }
  const seq = bumpChange(ctx.user.id, id, existed ? "update" : "create");
  const row = db.prepare("SELECT * FROM items WHERE id = ?").get(id);
  return ok(res, { item: itemView(row), seq });
}

async function handleItemPatch(req, res, id) {
  const ctx = requireUser(req, res);
  if (!ctx) return;
  const row = db.prepare("SELECT * FROM items WHERE id = ? AND owner_id = ?").get(id, ctx.user.id);
  if (!row || row.deleted_at) return fail(res, "not_found", "这条事项不在了", 404);
  const b = readJson(await readBody(req));
  const base = Number(b.baseUpdatedAt || 0);
  const t = now();
  let conflictId = "";
  const nextText = b.text === undefined ? row.text : String(b.text).slice(0, 20000);
  // 我拿到的版本比服务器旧，且两边都改了 → 把服务器那份留成冲突副本（LWW + 副本）
  if (base && row.updated_at > base + 500 && nextText !== (row.text || "")) {
    conflictId = "itm_" + rid(9);
    const origin = JSON.stringify({ conflict: true, of: row.id, at: t });
    db.prepare(
      "INSERT INTO items (id, owner_id, kind, text, images, done, pinned, sort_at, created_at, updated_at, origin) VALUES (?,?,?,?,?,?,?,?,?,?,?)"
    ).run(conflictId, ctx.user.id, row.kind, row.text || "", row.images || "[]", row.done, row.pinned, row.sort_at, t, t, origin);
    bumpChange(ctx.user.id, conflictId, "create");
  }
  const kind = b.kind === "todo" ? "todo" : b.kind === "note" ? "note" : row.kind;
  const images = b.images === undefined ? row.images : JSON.stringify(cleanImages(b.images));
  const done = b.done === undefined ? row.done : b.done ? 1 : 0;
  const pinned = b.pinned === undefined ? row.pinned : b.pinned ? 1 : 0;
  db.prepare(
    "UPDATE items SET kind = ?, text = ?, images = ?, done = ?, pinned = ?, sort_at = ?, updated_at = ? WHERE id = ?"
  ).run(kind, nextText, images, done, pinned, t, t, id);
  const seq = bumpChange(ctx.user.id, id, "update");
  const fresh = db.prepare("SELECT * FROM items WHERE id = ?").get(id);
  return ok(res, { item: itemView(fresh), seq, conflictId: conflictId || null });
}

function handleItemDelete(req, res, id) {
  const ctx = requireUser(req, res);
  if (!ctx) return;
  const row = db.prepare("SELECT * FROM items WHERE id = ? AND owner_id = ?").get(id, ctx.user.id);
  if (!row || row.deleted_at) return fail(res, "not_found", "这条事项不在了", 404);
  if (row.pinned) return fail(res, "pinned", "先取消钉在桌面才能删除", 409);
  const t = now();
  db.prepare("UPDATE items SET deleted_at = ?, updated_at = ? WHERE id = ?").run(t, t, id);
  const seq = bumpChange(ctx.user.id, id, "delete");
  return ok(res, { id, seq });
}

async function handleItemImage(req, res) {
  const ctx = requireUser(req, res);
  if (!ctx) return;
  const mime = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
  const ext = MIME_EXT[mime];
  if (!ext) return fail(res, "bad_type", "只支持 png / jpg / webp / gif 图片", 415);
  const buf = await readBody(req, MAX_UPLOAD);
  if (!buf || !buf.length) return fail(res, "empty", "没有收到文件");
  const name = rid(9) + "." + ext;
  if (!upyunReady()) return fail(res, "cloud_off", "云存储没配置好，暂时传不了图片", 503);
  const cfg = upyunConfig();
  const key = cfg.prefix + "/note/" + ctx.user.id + "/" + name;
  const up = await putObject(key, buf, mime);
  if (!up.ok) return fail(res, "cloud_failed", "上传失败：" + (up.message || "未知错误"), 502);
  return ok(res, { key: "cloud:" + key, url: publicUrl(key), bytes: buf.length });
}

/* ------------------------------------------------- 文件流转（嗖一下）
 * 文件本体由客户端直传又拍云（服务器只发签名），元数据走这里。
 * 这样服务器不承担下载流量，好友拿到的是 CDN 链接。
 */
const FILE_MAX_BYTES = 2 * 1024 * 1024 * 1024;

function safeFileName(name) {
  const base = String(name || 'file')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .trim();
  return (base || 'file').slice(0, 80);
}

async function handleFileSign(req, res) {
  const ctx = requireUser(req, res);
  if (!ctx) return;
  if (!upyunReady()) return fail(res, 'cloud_off', '云存储没配置好，暂时传不了文件', 503);
  const b = readJson(await readBody(req));
  const name = safeFileName(b.name);
  const size = Math.max(0, Number(b.size) || 0);
  if (size > FILE_MAX_BYTES) return fail(res, 'too_big', '单个文件最大 2GB', 413);
  const kind = b.kind === 'dir' ? 'dir' : 'file';
  const d = new Date();
  const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
  const cfg = upyunConfig();
  const prefix = (cfg && cfg.prefix ? cfg.prefix + '/' : '') + 'files/' + ym + '/';
  const cloudName = kind === 'dir' && !/\.zip$/i.test(name) ? name + '.zip' : name;
  const key = prefix + rid(9) + '-' + cloudName;
  const signed = signUpload(key, String(b.type || 'application/octet-stream'));
  if (!signed.ok) return fail(res, 'cloud_off', signed.message || '云存储签名失败', 503);
  return ok(res, { key: signed.key, url: signed.url, uploadUrl: signed.uploadUrl, headers: signed.headers });
}

async function handleFileShareCreate(req, res) {
  const ctx = requireUser(req, res);
  if (!ctx) return;
  const b = readJson(await readBody(req));
  const to = String(b.toUserId || '').trim();
  if (!to) return fail(res, 'bad_request', '要指定发给谁');
  if (to === ctx.user.id) return fail(res, 'bad_request', '不能发给自己');
  if (!areFriends(ctx.user.id, to)) return fail(res, 'forbidden', '只有好友之间才能嗖文件', 403);
  const key = String(b.key || '').replace(/^\/+/, '').slice(0, 300);
  const url = String(b.url || '').slice(0, 600);
  if (!key || !url) return fail(res, 'bad_request', '文件还没传上去');
  const name = safeFileName(b.name);
  const size = Math.max(0, Number(b.size) || 0);
  const kind = b.kind === 'dir' ? 'dir' : 'file';
  const id = 'fsh_' + rid(9);
  db.prepare(
    'INSERT INTO file_shares (id, from_user, to_user, name, size, kind, key, url, note, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).run(id, ctx.user.id, to, name, size, kind, key, url, String(b.note || '').slice(0, 200), now());
  log('[file] share', ctx.user.username, '->', to, name, size);
  return ok(res, { ok: true, id });
}

function handleFileInbox(req, res) {
  const ctx = requireUser(req, res);
  if (!ctx) return;
  const rows = db
    .prepare('SELECT * FROM file_shares WHERE to_user = ? ORDER BY created_at DESC LIMIT 60')
    .all(ctx.user.id);
  const items = rows.map((r) => {
    const u = q.userById.get(r.from_user);
    return {
      id: r.id,
      from: friendOf(u),
      name: r.name,
      size: r.size,
      kind: r.kind,
      key: r.key,
      url: r.url,
      note: r.note || '',
      createdAt: r.created_at,
      readAt: r.read_at || 0
    };
  });
  return ok(res, { items, unread: items.filter((x) => !x.readAt).length });
}

function handleFileShareRead(req, res, id) {
  const ctx = requireUser(req, res);
  if (!ctx) return;
  const row = db.prepare('SELECT * FROM file_shares WHERE id = ? AND to_user = ?').get(id, ctx.user.id);
  if (!row) return fail(res, 'not_found', '没有这条文件', 404);
  if (!row.read_at) db.prepare('UPDATE file_shares SET read_at = ? WHERE id = ?').run(now(), id);
  return ok(res, { ok: true });
}

// EventSource 不能带 header，SSE 这条允许 ?token=
function requireUserSse(req, res, url) {
  let raw = bearerOf(req);
  if (!raw && url) raw = String(url.searchParams.get("token") || "").trim();
  if (!raw) {
    fail(res, "unauthorized", "请先登录", 401);
    return null;
  }
  const s = q.sessionByHash.get(hash(raw));
  if (!s || s.revoked_at || s.expires_at < now()) {
    fail(res, "unauthorized", "登录已过期，请重新登录", 401);
    return null;
  }
  const u = q.userById.get(s.user_id);
  if (!u || u.deleted_at) {
    fail(res, "unauthorized", "账号不可用", 401);
    return null;
  }
  q.touchSession.run(now(), s.id);
  return { user: u, session: s };
}

function handleSyncStream(req, res, url) {
  const ctx = requireUserSse(req, res, url);
  if (!ctx) return;
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    ...cors()
  });
  res.write("retry: 4000\n\n");
  res.write("event: hello\ndata: " + JSON.stringify({ seq: maxSeqOf(ctx.user.id) }) + "\n\n");
  const uid = ctx.user.id;
  if (!syncStreams.has(uid)) syncStreams.set(uid, new Set());
  syncStreams.get(uid).add(res);
  const timer = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch (_) {
      /* ignore */
    }
  }, 25000);
  req.on("close", () => {
    clearInterval(timer);
    const set = syncStreams.get(uid);
    if (set) set.delete(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  let p = url.pathname;
  if (p === PREFIX) p = '/';
  else if (p.startsWith(PREFIX + '/')) p = p.slice(PREFIX.length);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors());
    return res.end();
  }

  try {
    if (req.method === 'GET' && p === '/api/health') {
      return ok(res, {
        service: 'island-notebook',
        version: 1,
        rooms: q.countRooms.get().c,
        uptime: Math.round(process.uptime())
      });
    }

    if (req.method === 'GET' && p === '/api/stream') return handleStream(req, res, url);

    // 账号：注册 / 登录 / 恢复码找回 / 会话与注销
    if (p === '/api/auth/check' && req.method === 'GET') return handleAuthCheck(req, res, url);
    if (p === '/api/auth/register' && req.method === 'POST')
      return await handleAuthRegister(req, res, await readBody(req));
    if (p === '/api/auth/login' && req.method === 'POST')
      return await handleAuthLogin(req, res, await readBody(req));
    if (p === '/api/auth/recover' && req.method === 'POST')
      return await handleAuthRecover(req, res, await readBody(req));
    if (p === '/api/auth/logout' && req.method === 'POST') return handleAuthLogout(req, res);
    if (p === '/api/auth/logout-all' && req.method === 'POST') return handleAuthLogoutAll(req, res);
    if (p === '/api/me' && req.method === 'GET') return handleAuthMe(req, res);
    if (p === '/api/me' && req.method === 'DELETE')
      return await handleAccountDelete(req, res, await readBody(req));
    {
      const sm = p.match(/^\/api\/me\/sessions\/([A-Za-z0-9_]+)$/);
      if (sm && req.method === 'DELETE') return handleSessionRevoke(req, res, sm[1]);
    }

    // 短信 / 验证码：手机端 POST 进来，桌面端订阅 SSE
    if (req.method === 'GET' && p === '/api/hook/info') return handleHookInfo(req, res, url);
    if (req.method === 'GET' && p === '/api/sms/stream') return handleSmsStream(req, res, url);
    if (req.method === 'GET' && p === '/api/sms') return handleSmsList(req, res, url);
    if ((req.method === 'POST' || req.method === 'GET') && (p === '/api/hook/sms' || (req.method === 'POST' && p === '/api/sms')))
      return await handleHookSms(req, res, url, await readBody(req));

    // 手机密钥（每台手机一把，可单独撤销）
    if (req.method === 'GET' && p === '/api/sms/devices') return handleSmsDevices(req, res, url);
    if (req.method === 'POST' && p === '/api/sms/devices')
      return handleSmsDeviceCreate(req, res, url, await readBody(req));
    const dm = req.method === 'POST' ? p.match(/^\/api\/sms\/devices\/([A-Za-z0-9_]+)\/(revoke|remove)$/) : null;
    if (dm) return dm[2] === 'revoke' ? handleSmsDeviceRevoke(req, res, url, dm[1]) : handleSmsDeviceRemove(req, res, url, dm[1]);

    // 本机身份（多租户）：主密钥换一把本机专用密钥；管理人用主密钥可以看全部
    if (req.method === 'POST' && p === '/api/sms/enroll') return handleSmsEnroll(req, res, url, await readBody(req));
    if (req.method === 'GET' && p === '/api/sms/owners') return handleSmsOwners(req, res, url);
    const ow = req.method === 'POST' ? p.match(/^\/api\/sms\/owners\/([A-Za-z0-9_]+)\/revoke$/) : null;
    if (ow) return handleSmsOwnerRevoke(req, res, url, ow[1]);

    // 热更新：latest.json + 安装包静态下载
    if (req.method === 'GET' && p === '/update/latest.json') return handleUpdateManifest(res);
    if (req.method === 'GET' && p.startsWith('/update/')) return handleUpdateFile(req, res, p);

    // 分享用的下载页：/island/get、/island/download、/island/dl
    if (req.method === 'GET' && (p === '/get' || p === '/download' || p === '/dl'))
      return handleDownloadPage(req, res);

    if (req.method === 'POST' && p === '/api/rooms')
      return await handleCreate(req, res, await readBody(req));

    if (req.method === 'POST' && p === '/api/rooms/join')
      return await handleJoin(req, res, await readBody(req));

    if (req.method === 'POST' && p === '/api/rooms/claim') return await handleRoomClaim(req, res);
    if (req.method === 'GET' && p === '/api/me/rooms') return handleMyRooms(req, res);
    if (req.method === 'GET' && p === '/api/rooms/owner') return handleRoomOwner(req, res, url);
    {
      const at = p.match(/^\/api\/rooms\/([A-Za-z0-9_]+)\/attach$/);
      if (at && req.method === 'POST') return await handleRoomAttach(req, res, at[1]);
    }

    // 亲密好友（绑定）与事项分享（M6）
    if (req.method === 'GET' && p === '/api/bindings') return handleBindings(req, res);
    if (req.method === 'POST' && p === '/api/bindings') return await handleBind(req, res);
    {
      const bm = p.match(/^\/api\/bindings\/([A-Za-z0-9_]+)\/(accept|reject)$/);
      if (bm && req.method === 'POST') return handleBindAct(req, res, bm[1], bm[2]);
      const bd = p.match(/^\/api\/bindings\/([A-Za-z0-9_]+)$/);
      if (bd && req.method === 'DELETE') return handleBindAct(req, res, bd[1], 'remove');
    }
    if (req.method === 'GET' && p === '/api/shares/inbox') return handleShareInbox(req, res);
    if (req.method === 'GET' && p === '/api/shares/history') return handleShareHistory(req, res);
    if (req.method === 'POST' && p === '/api/shares') return await handleShareCreate(req, res);
    {
      const sr = p.match(/^\/api\/shares\/([A-Za-z0-9_]+)\/read$/);
      if (sr && req.method === 'POST') return handleShareRead(req, res, sr[1]);
    }


    // M7：Qing 事项增量同步
    if (req.method === "GET" && p === "/api/items") return handleItemsList(req, res, url);
    if (req.method === "POST" && p === "/api/items") return await handleItemCreate(req, res);
    if (req.method === "POST" && p === "/api/items/image") return await handleItemImage(req, res);
    if (req.method === "GET" && p === "/api/sync") return handleSyncPull(req, res, url);
    if (req.method === "GET" && p === "/api/sync/stream") return handleSyncStream(req, res, url);
    {
      const im = p.match(/^\/api\/items\/([A-Za-z0-9_-]{6,48})$/);
      if (im && req.method === "PATCH") return await handleItemPatch(req, res, im[1]);
      if (im && req.method === "DELETE") return handleItemDelete(req, res, im[1]);
    }

    if (req.method === 'POST' && p === '/api/upload') return await handleUpload(req, res, url);

    if (req.method === 'GET' && p === '/api/cloud') {
      const c = upyunConfig();
      return ok(res, {
        enabled: upyunReady(),
        domain: c ? c.domain : '',
        prefix: c ? c.prefix : '',
        thumbRule: c ? c.thumbRule : ''
      });
    }
    if (req.method === 'POST' && p === '/api/files/sign') return await handleFileSign(req, res);
    if (req.method === 'POST' && p === '/api/files/share') return await handleFileShareCreate(req, res);
    if (req.method === 'GET' && p === '/api/files/inbox') return handleFileInbox(req, res);
    {
      const fr = p.match(/^\/api\/files\/inbox\/([A-Za-z0-9_]+)\/read$/);
      if (fr && req.method === 'POST') return handleFileShareRead(req, res, fr[1]);
    }
    if (req.method === 'POST' && p === '/api/files') return await handleFileUpload(req, res);

    let m;
    if (req.method === 'GET' && (m = p.match(/^\/api\/rooms\/([a-f0-9]+)$/)))
      return await handleRoomInfo(req, res, m[1], url);

    if (req.method === 'GET' && (m = p.match(/^\/api\/rooms\/([a-f0-9]+)\/messages$/)))
      return await handleMessages(req, res, m[1], url);

    if (req.method === 'POST' && (m = p.match(/^\/api\/rooms\/([a-f0-9]+)\/messages$/)))
      return await handleSend(req, res, m[1], await readBody(req));

    if (req.method === 'POST' && (m = p.match(/^\/api\/rooms\/([a-f0-9]+)\/leave$/)))
      return await handleLeave(req, res, m[1], await readBody(req));

    // 已读位置：按人存一条，多端同步
    if (req.method === 'GET' && (m = p.match(/^\/api\/rooms\/([a-f0-9]+)\/read$/)))
      return await handleReadState(req, res, m[1], url);

    if (req.method === 'POST' && (m = p.match(/^\/api\/rooms\/([a-f0-9]+)\/read$/)))
      return await handleReadMark(req, res, m[1], await readBody(req));

    // 投票踢人
    if (req.method === 'GET' && (m = p.match(/^\/api\/rooms\/([a-f0-9]+)\/votes$/)))
      return await handleVotes(req, res, m[1], url);

    if (req.method === 'POST' && (m = p.match(/^\/api\/rooms\/([a-f0-9]+)\/votes$/)))
      return await handleVoteStart(req, res, m[1], await readBody(req));

    if (req.method === 'POST' && (m = p.match(/^\/api\/rooms\/([a-f0-9]+)\/votes\/([a-f0-9]+)\/ballot$/)))
      return await handleVoteBallot(req, res, m[1], m[2], await readBody(req));

    // 表情包（房间内共享）
    if (req.method === 'GET' && (m = p.match(/^\/api\/rooms\/([a-f0-9]+)\/stickers$/)))
      return await handleStickers(req, res, m[1], url);

    if (req.method === 'POST' && (m = p.match(/^\/api\/rooms\/([a-f0-9]+)\/stickers$/)))
      return await handleStickerAdd(req, res, m[1], await readBody(req));

    if (req.method === 'POST' && (m = p.match(/^\/api\/rooms\/([a-f0-9]+)\/stickers\/([a-f0-9]+)\/remove$/)))
      return await handleStickerRemove(req, res, m[1], m[2], await readBody(req));

    if (req.method === 'GET' && (m = p.match(/^\/media\/([\w.-]+)$/)))
      return handleMedia(req, res, m[1]);

    if (req.method === 'GET' && (p === '/' || p === '/index.html')) return serveWeb(res, 'index.html');
    if (req.method === 'GET' && p === '/app.js') return serveWeb(res, 'app.js');
    if (req.method === 'GET' && p === '/style.css') return serveWeb(res, 'style.css');

    return fail(res, 'not_found', 'not found', 404);
  } catch (err) {
    log('error', req.method, p, err && err.message);
    if (!res.headersSent)
      fail(res, 'server_error', (err && err.message) || 'server error', err && err.status === 413 ? 413 : 500);
    else res.end();
  }
});

server.listen(PORT, '127.0.0.1', () => {
  log('island-notebook listening on 127.0.0.1:' + PORT + '  data=' + DATA_DIR);
});

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    log('shutting down', sig);
    try {
      for (const set of streams.values()) for (const e of set) e.res.end();
    } catch {
      /* ignore */
    }
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500);
  });
}
