'use strict';
/* 桌面小便条：内容可编辑，改动自动存回主进程；支持缩放字号 */
(function () {
  const note = document.getElementById('note');
  const stamp = document.getElementById('stamp');
  const foot = document.querySelector('.foot');
  const btnUnpin = document.getElementById('btnUnpin');
  const btnDelete = document.getElementById('btnDelete');
  const btnMinus = document.getElementById('btnFontMinus');
  const btnPlus = document.getElementById('btnFontPlus');
  const api = window.sticky;

  const FS_MIN = 11;
  const FS_MAX = 42;
  let fs = 15;
  let last = '';
  let saveT = null;
  let loading = true;
  // 待办便条要按行画圆圈：kind / done / doneLines 由主进程推过来
  const meta = { kind: 'note', done: false, doneLines: [] };

  function applyFont(size, persist) {
    fs = Math.max(FS_MIN, Math.min(FS_MAX, Math.round(size)));
    document.documentElement.style.setProperty('--fs', fs + 'px');
    // 横线跟着字号走，否则字一放大就不在格子里了
    document.documentElement.style.setProperty('--lh', Math.round(fs * 1.72) + 'px');
    document.querySelector('.note').style.lineHeight = Math.round(fs * 1.72) + 'px';
    if (persist) api.font(fs);
  }

  function setText(text) {
    last = String(text == null ? '' : text);
    note.replaceChildren(meta.kind === 'todo' ? todoDom(last) : noteDom(last));
  }

  /** 待办便条：每行前面一个圆圈，已完成的行划线变灰；空行直接不显示 */
  function todoDom(text) {
    const frag = document.createDocumentFragment();
    const lines = String(text || '').split('\n');
    const doneLines = Array.isArray(meta.doneLines) ? meta.doneLines : [];
    let first = true;
    lines.forEach((ln, i) => {
      if (!ln.trim()) return;
      if (!first) frag.appendChild(document.createElement('br'));
      first = false;
      const done = !!meta.done || doneLines.indexOf(i) >= 0;
      const chk = document.createElement('span');
      chk.className = 'chk' + (done ? ' on' : '');
      chk.contentEditable = 'false';
      chk.dataset.line = String(i);
      chk.title = done ? '取消完成' : '完成';
      frag.appendChild(chk);
      const tl = document.createElement('span');
      tl.className = 'tl' + (done ? ' done' : '');
      // 不能带前导空格：readNote() 会把它读回正文，反复保存会越积越多
      tl.textContent = ln;
      frag.appendChild(tl);
    });
    return frag;
  }

  /* 正文里的图片标记：[[img:<file>]]，渲染成一张小图，保存时再写回标记 */
  const IMG_TOKEN = /\[\[img:([^\]\s]+)\]\]/g;

  /* 事项同步之后，图片可能已经搬到又拍云，正文里留下的是 cloud:<key>；
     直接拼 islandclip://note/cloud%3A… 会变成破图，这里按前缀分流 */
  const CLOUD_BASE = 'https://qing.ccyyqq.com';

  function srcOf(file) {
    const f = String(file == null ? '' : file);
    if (!f) return '';
    if (f === 'undefined' || f === 'null') return '';
    if (f.indexOf('cloud:') === 0) return CLOUD_BASE + '/' + f.slice(6).replace(/^\/+/, '');
    return 'islandclip://note/' + encodeURIComponent(f);
  }

  function pushText(frag, str) {
    const lines = String(str).split('\n');
    lines.forEach((ln, i) => {
      if (i) frag.appendChild(document.createElement('br'));
      if (ln) frag.appendChild(document.createTextNode(ln));
    });
  }

  function noteDom(text) {
    const frag = document.createDocumentFragment();
    const s = String(text || '');
    let at = 0;
    let m;
    let afterImg = false;
    IMG_TOKEN.lastIndex = 0;
    while ((m = IMG_TOKEN.exec(s))) {
      let pre = s.slice(at, m.index);
      // 图片是块级元素，自己会换行：紧贴图片两侧的换行不再输出，否则会空一行
      if (pre && /^\n/.test(pre) && afterImg) pre = pre.replace(/^\n/, '');
      if (pre && /\n$/.test(pre)) pre = pre.replace(/\n$/, '');
      if (pre) pushText(frag, pre);
      const imgSrc = srcOf(m[1]);
      if (!imgSrc) continue;
      const img = document.createElement('img');
      img.className = 'pic';
      img.dataset.file = m[1];
      img.src = imgSrc;
      img.contentEditable = 'false';
      img.draggable = false;
      img.alt = '图片';
      img.addEventListener('error', () => { img.classList.add('bad'); img.alt = '图片没加载出来'; });
      frag.appendChild(img);
      at = m.index + m[0].length;
      afterImg = true;
    }
    if (at < s.length) {
      let tail = s.slice(at);
      if (afterImg) tail = tail.replace(/^\n/, '');
      if (tail) pushText(frag, tail);
    }
    return frag;
  }

  function readNote() {
    let out = '';
    const walk = (node) => {
      node.childNodes.forEach((n) => {
        if (n.nodeType === 3) {
          out += n.nodeValue.replace(/\u00a0/g, ' ');
          return;
        }
        if (n.nodeName === 'BR') {
          out += '\n';
          return;
        }
        if (n.nodeName === 'IMG') {
          const f = n.dataset && n.dataset.file;
          if (f) out += '\n[[img:' + f + ']]\n';
          return;
        }
        // 待办行前的圆圈是控件，不算正文
        if (n.classList && n.classList.contains('chk')) return;
        if (n.nodeName === 'DIV' || n.nodeName === 'P') {
          if (out && !/\n$/.test(out)) out += '\n';
          walk(n);
          return;
        }
        walk(n);
      });
    };
    walk(note);
    return out.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').replace(/\n+$/, '');
  }

  function flash(msg) {
    stamp.textContent = msg;
    foot.classList.add('saving');
    clearTimeout(flash.t);
    flash.t = setTimeout(() => {
      stamp.textContent = '已保存';
      foot.classList.remove('saving');
    }, 900);
  }

  function save() {
    const text = readNote();
    if (text === last) return;
    last = text;
    flash('保存中…');
    api.update(text).then(() => flash('已保存'));
  }

  note.addEventListener('input', () => {
    if (loading) return;
    clearTimeout(saveT);
    saveT = setTimeout(save, 600);
  });

  note.addEventListener('blur', save);
  window.addEventListener('beforeunload', save);

  btnUnpin.addEventListener('click', () => api.unstuck());
  btnDelete.addEventListener('click', () => {
    if (confirm('删除这张便条？')) api.remove();
  });

  btnMinus.addEventListener('click', () => applyFont(fs - 1, true));
  btnPlus.addEventListener('click', () => applyFont(fs + 1, true));

  // 点便条里的图片 → 开「看大图」窗口（可缩放、可平移）
  note.addEventListener(
    'mousedown',
    (e) => {
      // 待办圆圈和图片都不该让 contenteditable 落光标
      if (e.target.closest && (e.target.closest('img.pic') || e.target.closest('.chk'))) e.preventDefault();
    },
    true
  );
  note.addEventListener('click', (e) => {
    const chk = e.target.closest && e.target.closest('.chk');
    if (chk) {
      e.preventDefault();
      e.stopPropagation();
      api.lineDone(Number(chk.dataset.line));
      return;
    }
    const img = e.target.closest && e.target.closest('img.pic');
    if (!img) return;
    e.preventDefault();
    e.stopPropagation();
    const f = img.dataset.file;
    if (f) api.view(f);
  });

  // 拖动右下/右/下三条把手改窗口大小（透明无边框窗口没有系统缩放边框）
  document.querySelectorAll('.rz').forEach((h) => {
    h.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const axis = h.dataset.rz || 'xy';
      const sx = e.screenX;
      const sy = e.screenY;
      const sw = window.innerWidth;
      const sh = window.innerHeight;
      let nw = sw;
      let nh = sh;
      let raf = 0;
      const flush = () => {
        raf = 0;
        api.resize(Math.max(190, Math.round(nw)), Math.max(150, Math.round(nh)));
      };
      const onMove = (ev) => {
        if (axis !== 'y') nw = sw + (ev.screenX - sx);
        if (axis !== 'x') nh = sh + (ev.screenY - sy);
        if (!raf) raf = requestAnimationFrame(flush);
      };
      const onUp = () => {
        if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
          flush();
        }
        document.body.classList.remove('resizing');
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
      };
      document.body.classList.add('resizing');
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    });
  });

  // Ctrl + 滚轮缩放字号（不缩放整张纸，只改文字大小）
  window.addEventListener(
    'wheel',
    (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      applyFont(fs + (e.deltaY < 0 ? 1 : -1), true);
    },
    { passive: false }
  );

  // Ctrl +/-/0 也顺手支持
  window.addEventListener('keydown', (e) => {
    if (!e.ctrlKey) return;
    if (e.key === '=' || e.key === '+') {
      e.preventDefault();
      applyFont(fs + 1, true);
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      applyFont(fs - 1, true);
    } else if (e.key === '0') {
      e.preventDefault();
      applyFont(15, true);
    }
  });

  /** 只刷新圆圈与划线，不重建 contenteditable（否则正在打字的光标会丢） */
  function paintChk() {
    const doneLines = Array.isArray(meta.doneLines) ? meta.doneLines : [];
    note.querySelectorAll('.chk').forEach((el) => {
      const i = Number(el.dataset.line);
      const done = !!meta.done || doneLines.indexOf(i) >= 0;
      el.classList.toggle('on', done);
      el.title = done ? '取消完成' : '完成';
      const tl = el.nextElementSibling;
      if (tl && tl.classList && tl.classList.contains('tl')) tl.classList.toggle('done', done);
    });
  }

  /** 当前光标在正文里的字符偏移（重建 DOM 前记下来，重建后放回去） */
  function caretOffset() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    if (!note.contains(range.startContainer)) return null;
    const pre = document.createRange();
    pre.selectNodeContents(note);
    pre.setEnd(range.startContainer, range.startOffset);
    return pre.toString().length;
  }

  function placeCaret(off) {
    // off 为空 = 放到末尾（删掉空行之后光标回到上一行末尾）
    if (off == null) {
      const r0 = document.createRange();
      r0.selectNodeContents(note);
      r0.collapse(false);
      const s0 = window.getSelection();
      s0.removeAllRanges();
      s0.addRange(r0);
      return;
    }
    let acc = 0;
    const walker = document.createTreeWalker(note, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const len = node.nodeValue.length;
      if (acc + len >= off) {
        const r = document.createRange();
        r.setStart(node, Math.max(0, Math.min(len, off - acc)));
        r.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
        return;
      }
      acc += len;
    }
    const r = document.createRange();
    r.selectNodeContents(note);
    r.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  }

  /** 在便条里继续加行（按回车）后，行数会多于圆圈数：重建一次补上圆圈，并尽量保住光标 */
  function syncTodoChk() {
    if (meta.kind !== 'todo') return;
    const lines = String(last).split('\n');
    const cleaned = lines.filter((s) => s.trim());
    // 整行删空：把这一行连同圆圈一起去掉，光标回到末尾（上一行末尾）
    if (cleaned.length !== lines.length) {
      last = cleaned.join('\n');
      note.replaceChildren(todoDom(last));
      placeCaret(null);
      api.update(last);
      return;
    }
    const need = cleaned.length;
    const have = note.querySelectorAll('.chk').length;
    if (need !== have) {
      const off = caretOffset();
      note.replaceChildren(todoDom(last));
      placeCaret(off);
      return;
    }
    paintChk();
  }

  // 主进程推送（岛上面板改了同一张便条）
  api.onUpdate((n) => {
    if (!n || n.id !== api.id) return;
    if (typeof n.fontSize === 'number') applyFont(n.fontSize, false);
    meta.kind = n.kind === 'todo' ? 'todo' : 'note';
    meta.done = !!n.done;
    meta.doneLines = Array.isArray(n.doneLines) ? n.doneLines : [];
    if (n.text !== last) {
      // 正在这张便条里打字时不要重建，等失焦保存后再同步
      if (document.activeElement === note) return;
      setText(n.text);
      return;
    }
    if (document.activeElement === note) {
      syncTodoChk();
      return;
    }
    note.replaceChildren(meta.kind === 'todo' ? todoDom(last) : noteDom(last));
  });

  api.snapshot().then((r) => {
    if (r && r.ok) {
      meta.kind = r.note.kind === 'todo' ? 'todo' : 'note';
      meta.done = !!r.note.done;
      meta.doneLines = Array.isArray(r.note.doneLines) ? r.note.doneLines : [];
      setText(r.note.text);
      if (typeof r.note.fontSize === 'number') applyFont(r.note.fontSize, false);
    }
    // 没有存过字号时给个默认值，保证纸面横线有 --lh 可用
    if (!document.documentElement.style.getPropertyValue('--lh')) applyFont(15, false);
    loading = false;
    note.focus();
    const r0 = document.createRange();
    r0.selectNodeContents(note);
    r0.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r0);
  });
})();
