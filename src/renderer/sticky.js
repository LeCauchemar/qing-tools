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
    note.replaceChildren(noteDom(last));
  }

  /* 正文里的图片标记：[[img:<file>]]，渲染成一张小图，保存时再写回标记 */
  const IMG_TOKEN = /\[\[img:([^\]\s]+)\]\]/g;

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
      const img = document.createElement('img');
      img.className = 'pic';
      img.dataset.file = m[1];
      img.src = 'islandclip://note/' + encodeURIComponent(m[1]);
      img.contentEditable = 'false';
      img.draggable = false;
      img.alt = '图片';
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
      const img = e.target.closest && e.target.closest('img.pic');
      if (!img) return;
      // 拦住 contenteditable 落光标，避免点完图光标跳到图前面
      e.preventDefault();
    },
    true
  );
  note.addEventListener('click', (e) => {
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

  // 主进程推送（岛上面板改了同一张便条）
  api.onUpdate((n) => {
    if (!n || n.id !== api.id) return;
    if (typeof n.fontSize === 'number') applyFont(n.fontSize, false);
    if (document.activeElement === note) return;
    if (n.text !== last) setText(n.text);
  });

  api.snapshot().then((r) => {
    if (r && r.ok) {
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
