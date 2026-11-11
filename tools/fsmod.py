import io
p = r'src/renderer/app.js'
lines = io.open(p, encoding='utf-8').read().split('\n')
# 保留 1..3873 与 4045..（1-based：3874 是注释行，4046 是「// 文件拖出」）
head = lines[:3873]
tail = lines[4045:]
new = r'''  // ---- 本地文件搜索：文件名 / 文件夹名 / 内容一起搜（Everything 优先，没有就用内置扫描）
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
'''
out = '\n'.join(head) + '\n' + new + '\n' + '\n'.join(tail)
io.open(p, 'w', encoding='utf-8', newline='').write(out)
print('replaced')
