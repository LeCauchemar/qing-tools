// M7：Qing 事项多端同步（主进程）
// - 本地 notes 为唯一真相（store.data.notes），远端是镜像
// - 本地改动 → 防抖 500ms → POST/PATCH；远端改动 → /api/items?since= 增量拉取
// - 正文里的 [[img:<file>]] 在推送时上传到又拍云并改写为 [[img:cloud:key]]
const fs = require('node:fs');
const path = require('node:path');
const accountMod = require('./account');
const acc = () => accountMod.account();

const PULL_MS = 20000;
const TOKEN_RE = /\[\[img:([^\]\s]+)\]\]/g;

let getStore = () => null;
let notify = () => {};
let noteImagesDir = () => '';
let timer = null;
let flushTimer = null;
let pulling = false;
const dirty = new Set();
let lastError = '';
let lastPullAt = 0;
let lastPushAt = 0;

function init(deps) {
  if (deps.getStore) getStore = deps.getStore;
  if (deps.notify) notify = deps.notify;
  if (deps.noteImagesDir) noteImagesDir = deps.noteImagesDir;
}

function meta() {
  const st = getStore();
  if (!st) return {};
  if (!st.data.meta) st.data.meta = {};
  return st.data.meta;
}

function cloudCache() {
  const m = meta();
  if (!m.cloudImgs || typeof m.cloudImgs !== 'object') m.cloudImgs = {};
  return m.cloudImgs;
}

function tokensOf(text) {
  const out = [];
  String(text || '').replace(TOKEN_RE, (all, f) => {
    out.push(f);
    return all;
  });
  return out;
}

// 把本地文件上传成 cloud:key（同一文件只传一次）
async function uploadOne(file) {
  if (!file || file.startsWith('cloud:')) return file;
  const cache = cloudCache();
  if (cache[file]) return cache[file];
  const dir = noteImagesDir();
  if (!dir) return file;
  const full = path.join(dir, path.basename(file));
  let buf;
  try {
    buf = fs.readFileSync(full);
  } catch {
    return file;
  }
  const ext = path.extname(file).toLowerCase();
  const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : 'image/png';
  const r = await acc().itemImage(buf, mime);
  if (!r || !r.ok) {
    lastError = r && r.message ? r.message : '图片上传失败';
    return file;
  }
  cache[file] = r.key;
  return r.key;
}

async function cloudify(text) {
  let out = String(text || '');
  for (const f of tokensOf(out)) {
    if (f.startsWith('cloud:')) continue;
    const key = await uploadOne(f);
    if (key && key !== f) out = out.split('[[' + 'img:' + f + ']]').join('[[' + 'img:' + key + ']]');
  }
  return out;
}

function fromRemote(it) {
  return {
    id: it.id,
    text: it.text || '',
    kind: it.kind === 'todo' ? 'todo' : 'note',
    done: !!it.done,
    pinned: !!it.pinned,
    createdAt: Number(it.createdAt) || Date.now(),
    updatedAt: Number(it.updatedAt) || Date.now(),
    origin: it.origin || null,
    remote: true
  };
}

async function pushOne(id) {
  const st = getStore();
  if (!st || !acc().signedIn) return { ok: false, code: 'no_account' };
  const note = (st.data.notes || []).find((n) => n.id === id);
  if (!note) return { ok: false, code: 'gone' };
  const text = await cloudify(note.text);
  if (text !== note.text) {
    note.text = text;
    st.save();
    notify('sync:images');
  }
  const payload = {
    id: note.id,
    kind: note.kind === 'todo' ? 'todo' : 'note',
    text: note.text,
    images: tokensOf(note.text).filter((f) => f.startsWith('cloud:') || f.startsWith('local:')).slice(0, 12),
    done: !!note.done,
    pinned: !!note.pinned
  };
  const r = note.remote
    ? await acc().itemPatch(note.id, Object.assign({}, payload, { baseUpdatedAt: Number(note.updatedAt) || 0 }))
    : await acc().itemCreate(payload);
  if (!r || !r.ok) {
    lastError = r && r.message ? r.message : '同步失败';
    return r || { ok: false };
  }
  note.remote = true;
  if (r.item) {
    note.updatedAt = Number(r.item.updatedAt) || note.updatedAt;
    if (r.item.origin) note.origin = r.item.origin;
  }
  const m = meta();
  m.syncSeq = Math.max(Number(m.syncSeq) || 0, Number(r.seq) || 0);
  st.save();
  lastPushAt = Date.now();
  lastError = '';
  if (r.conflictId) notify('sync:conflict');
  return r;
}

async function pushDeleted(id) {
  if (!acc().signedIn) return { ok: false };
  const r = await acc().itemDelete(id);
  if (r && r.ok) {
    const m = meta();
    m.syncSeq = Math.max(Number(m.syncSeq) || 0, Number(r.seq) || 0);
    getStore().save();
  }
  return r;
}

async function flush() {
  if (!dirty.size || !acc().signedIn) return { ok: true, pushed: 0 };
  const ids = Array.from(dirty);
  dirty.clear();
  let pushed = 0;
  for (const id of ids) {
    const st = getStore();
    const exists = st && (st.data.notes || []).some((n) => n.id === id);
    const r = exists ? await pushOne(id) : await pushDeleted(id);
    if (r && r.ok) pushed++;
  }
  return { ok: true, pushed };
}

function queue(id) {
  if (!id) return;
  dirty.add(id);
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flush().catch((e) => console.error('[sync] flush', e && e.message));
  }, 500);
}

async function pull() {
  if (!acc().signedIn || pulling) return { ok: false, code: 'busy' };
  const st = getStore();
  if (!st) return { ok: false, code: 'no_store' };
  pulling = true;
  try {
    const since = Number(meta().syncSeq) || 0;
    const r = await acc().items(since);
    if (!r || !r.ok) {
      lastError = r && r.message ? r.message : '拉取失败';
      return r || { ok: false };
    }
    const notes = st.data.notes || [];
    const map = new Map(notes.map((n) => [n.id, n]));
    let changed = 0;
    for (const it of r.items || []) {
      if (it.deleted) {
        const cur = map.get(it.id);
        if (cur) {
          notes.splice(notes.indexOf(cur), 1);
          map.delete(it.id);
          changed++;
        }
        continue;
      }
      const cur = map.get(it.id);
      if (!cur) {
        const n = fromRemote(it);
        notes.push(n);
        map.set(it.id, n);
        changed++;
      } else if (Number(it.updatedAt) > Number(cur.updatedAt || 0) + 1) {
        Object.assign(cur, fromRemote(it));
        changed++;
      }
    }
    st.data.meta = st.data.meta || {};
    st.data.meta.syncSeq = Number(r.seq) || since;
    if (changed) st.data.notes = notes;
    st.save();
    lastPullAt = Date.now();
    lastError = '';
    if (changed) notify('sync:changed');
    return { ok: true, changed, seq: st.data.meta.syncSeq, full: !!r.full };
  } finally {
    pulling = false;
  }
}

function start() {
  stop();
  pull().catch(() => {});
  timer = setInterval(() => {
    pull().catch((e) => console.error('[sync] pull', e && e.message));
  }, PULL_MS);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
  clearTimeout(flushTimer);
  flushTimer = null;
}

function status() {
  const st = getStore();
  return {
    running: !!timer,
    signedIn: acc().signedIn,
    seq: (st && st.data && st.data.meta && st.data.meta.syncSeq) || 0,
    dirty: dirty.size,
    lastPullAt,
    lastPushAt,
    lastError
  };
}

// 登录后把本机老数据一次性推上去（只推没有 remote 标记的）
async function pushLocalAll() {
  const st = getStore();
  if (!st || !acc().signedIn) return { ok: false };
  const local = (st.data.notes || []).filter((n) => !n.remote);
  let pushed = 0;
  for (const n of local) {
    const r = await pushOne(n.id);
    if (r && r.ok) pushed++;
  }
  return { ok: true, pushed, total: local.length };
}

module.exports = { init, start, stop, pull, queue, flush, status, pushLocalAll };
