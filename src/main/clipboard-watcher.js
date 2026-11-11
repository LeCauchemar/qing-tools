'use strict';
/**
 * 剪贴板监听：文本 + 图片
 * Electron 45 的 clipboard 是异步 W3C 风格 API（readText/read/write/has 均返回 Promise）
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { clipboard, app } = require('electron');
const { uid } = require('./store');

const MAX_TEXT = 60000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGES = 12;

class ClipWatcher {
  constructor(store, onChange) {
    this.store = store;
    this.onChange = onChange;
    this.timer = null;
    this.busy = false;
    this.lastText = '';
    this.lastImageSig = '';
    this.images = []; // { id, kind:'image', dataUrl, w, h, createdAt, pinned, file }
  }

  get dir() {
    return path.join(app.getPath('userData'), 'clip-images');
  }

  start() {
    this.hydrate();
    this.timer = setInterval(() => this.tick(), 750);
    this.tick();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** 启动时只把磁盘上的历史图片读成元数据（不读 base64，省内存） */
  hydrate() {
    try {
      const list = this.store.data.clips.filter((c) => c.kind === 'image' && c.file);
      for (const c of list.slice(0, MAX_IMAGES)) {
        this.images.push({ id: c.id, kind: 'image', file: c.file, bytes: c.bytes, createdAt: c.createdAt, pinned: !!c.pinned });
      }
    } catch (err) {
      console.error('[clip] hydrate failed', err);
    }
  }

  async tick() {
    if (this.busy || !this.store.data.settings.clipEnabled) return;
    this.busy = true;
    try {
      let text = '';
      try {
        text = await clipboard.readText();
      } catch (_) {
        text = '';
      }
      if (text && text !== this.lastText) {
        this.lastText = text;
        this.pushText(text);
      }

      let hasImg = false;
      try {
        hasImg = await clipboard.has('image/png');
      } catch (_) {
        hasImg = false;
      }
      if (hasImg) {
        const items = await clipboard.read();
        for (const item of items) {
          if (!item.types || !item.types.includes('image/png')) continue;
          const blob = await item.getType('image/png');
          const buf = Buffer.from(await blob.arrayBuffer());
          if (!buf.length || buf.length > MAX_IMAGE_BYTES) break;
          const sig = buf.length + ':' + crypto.createHash('sha1').update(buf.subarray(0, 4096)).digest('hex');
          if (sig !== this.lastImageSig) {
            this.lastImageSig = sig;
            this.pushImage(buf);
          }
          break;
        }
      }
    } catch (err) {
      /* 剪贴板偶尔会被其它程序锁住，忽略即可 */
    } finally {
      this.busy = false;
    }
  }

  /** 本程序自己写剪贴板后调用，避免把自己写的内容再记一遍 */
  async suppress() {
    try {
      this.lastText = await clipboard.readText();
    } catch (_) {}
  }

  pushText(raw) {
    let text = raw.length > MAX_TEXT ? raw.slice(0, MAX_TEXT) : raw;
    const list = this.store.data.clips;
    const exist = list.find((c) => c.kind === 'text' && c.text === text);
    if (exist) {
      exist.createdAt = Date.now();
    } else {
      list.unshift({ id: uid('clip'), kind: 'text', text, createdAt: Date.now(), pinned: false });
    }
    const limit = Math.max(10, Number(this.store.data.settings.clipLimit) || 60);
    const texts = list.filter((c) => c.kind === 'text');
    if (texts.length > limit) {
      const drop = new Set(texts.slice(limit).map((c) => c.id));
      this.store.data.clips = list.filter((c) => !drop.has(c.id));
    }
    this.store.save();
    this.onChange && this.onChange();
  }

  pushImage(buf) {
    const file = `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}.png`;
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      fs.writeFileSync(path.join(this.dir, file), buf);
    } catch (err) {
      console.error('[clip] write image failed', err);
      return;
    }
    const item = {
      id: uid('clip'),
      kind: 'image',
      file,
      bytes: buf.length,
      createdAt: Date.now(),
      pinned: false
    };
    this.images.unshift(item);
    this.store.data.clips.unshift({ id: item.id, kind: 'image', file, bytes: buf.length, createdAt: item.createdAt, pinned: false });

    while (this.images.length > MAX_IMAGES) {
      const gone = this.images.pop();
      const idx = this.store.data.clips.findIndex((c) => c.id === gone.id);
      if (idx >= 0) this.store.data.clips.splice(idx, 1);
      try {
        fs.unlinkSync(path.join(this.dir, gone.file));
      } catch (_) {}
    }
    this.store.save();
    this.onChange && this.onChange();
  }

  list() {
    const texts = this.store.data.clips.filter((c) => c.kind === 'text');
    const merged = [...texts, ...this.images];
    merged.sort((a, b) => {
      if (!!b.pinned !== !!a.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      return b.createdAt - a.createdAt;
    });
    // 图片只给自定义协议的缩略图地址（按需从磁盘读，不占内存）
    return merged.slice(0, 80).map((c) => ({
      id: c.id,
      kind: c.kind,
      text: c.text,
      thumb: c.kind === 'image' && c.file ? 'islandclip://img/' + encodeURIComponent(c.file) : undefined,
      bytes: c.bytes,
      createdAt: c.createdAt,
      pinned: !!c.pinned
    }));
  }

  get(id) {
    const text = this.store.data.clips.find((c) => c.id === id && c.kind === 'text');
    if (text) return text;
    return this.images.find((c) => c.id === id) || null;
  }

  async copy(id) {
    const item = this.get(id);
    if (!item) return false;
    try {
      if (item.kind === 'text') {
        await clipboard.writeText(item.text);
        this.lastText = item.text;
      } else if (item.file || item.dataUrl) {
        // 从磁盘按需读取（不在内存里常驻 base64）
        let buf = null;
        if (item.file) {
          try {
            buf = fs.readFileSync(path.join(this.dir, item.file));
          } catch (_) {
            buf = null;
          }
        }
        if (!buf && item.dataUrl) buf = Buffer.from(item.dataUrl.split(',')[1], 'base64');
        if (!buf) return false;
        const { ClipboardItem } = require('electron');
        const blob = new Blob([buf], { type: 'image/png' });
        const ci = new ClipboardItem({ 'image/png': blob });
        await clipboard.write([ci]);
        this.lastImageSig = buf.length + ':' + crypto.createHash('sha1').update(buf.subarray(0, 4096)).digest('hex');
      }
      return true;
    } catch (err) {
      console.error('[clip] copy failed', err);
      return false;
    }
  }

  remove(id) {
    const idx = this.store.data.clips.findIndex((c) => c.id === id);
    if (idx >= 0) {
      const item = this.store.data.clips[idx];
      if (item.kind === 'image' && item.file) {
        try {
          fs.unlinkSync(path.join(this.dir, item.file));
        } catch (_) {}
      }
      this.store.data.clips.splice(idx, 1);
      this.store.save();
    }
    this.images = this.images.filter((i) => i.id !== id);
    this.onChange && this.onChange();
  }

  togglePin(id) {
    const item = this.store.data.clips.find((c) => c.id === id);
    if (item) {
      item.pinned = !item.pinned;
      const img = this.images.find((i) => i.id === id);
      if (img) img.pinned = item.pinned;
      this.store.save();
      this.onChange && this.onChange();
    }
  }

  // 全部删除：固定的（pinned）条目保留，其余连图片文件一起清掉
  clear() {
    const keep = [];
    for (const c of this.store.data.clips) {
      if (c.pinned) {
        keep.push(c);
        continue;
      }
      if (c.kind === 'image' && c.file) {
        try {
          fs.unlinkSync(path.join(this.dir, c.file));
        } catch (_) {}
      }
    }
    const removed = this.store.data.clips.length - keep.length;
    this.store.data.clips = keep;
    this.images = this.images.filter((img) => keep.some((c) => c.id === img.id));
    this.store.save();
    this.onChange && this.onChange();
    return { removed, kept: keep.length };
  }
}

module.exports = { ClipWatcher };
