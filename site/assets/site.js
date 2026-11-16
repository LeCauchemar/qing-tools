/* Qing Tools 官网脚本：主题 / 导航 / 入场 / 版本与下载信息
   （实机演示台已移除，页面上不再有 #demo 相关逻辑） */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const qs = new URLSearchParams(location.search);
  if (qs.has('nofx')) document.documentElement.classList.add('no-fx');

  /* ───────── 主题 ───────── */
  const saved = localStorage.getItem('qt-theme');
  if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
  $('#themeBtn')?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('qt-theme', next);
  });

  /* ───────── 导航吸顶 ───────── */
  const nav = $('#nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('stuck', window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ───────── 入场 ───────── */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        en.target.classList.add('in');
        io.unobserve(en.target);
      }
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
  $$('.reveal').forEach((n) => io.observe(n));

  /* ───────── 卡片光晕跟随 ───────── */
  $$('.card').forEach((c) => {
    c.addEventListener('pointermove', (e) => {
      const r = c.getBoundingClientRect();
      c.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
      c.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
    });
  });

  /* ───────── 版本 / 下载信息 ───────── */
  // 安装包优先走又拍云 CDN（qing.ccyyqq.com），探不通就自动把按钮切到本站 /download/ 镜像
  const CDN = 'https://qing.ccyyqq.com/island/update/';
  const fmtSize = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);
  const text = (sel, v) => { const n = $(sel); if (n && v) n.textContent = v; };

  async function cdnReachable() {
    try {
      const r = await fetch(`${CDN}latest.json?t=${Date.now()}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(4000)
      });
      return r.ok;
    } catch (_) {
      return false;
    }
  }

  async function applyDownloadLinks(file) {
    if (!file) return;
    const portable = file.replace('-setup.exe', '-portable.exe');
    const ok = await cdnReachable();
    const base = ok ? CDN : 'download/';
    $$('.js-dl').forEach((a) => (a.href = base + file));
    $$('.js-dl-portable').forEach((a) => (a.href = base + portable));
    $$('.js-mirror').forEach((a) => (a.href = (ok ? 'download/' : CDN) + file));
    const box = $('#dlMirror');
    if (box) box.classList.toggle('fallback', !ok);
    const line = $('#dlMirrorText');
    if (line) {
      line.textContent = ok
        ? '下载由又拍云 CDN 加速（qing.ccyyqq.com），不占本站带宽。'
        : '又拍云 CDN 暂时连不上，已自动切到本站镜像。';
    }
  }

  fetch('latest.json', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('no latest.json'))))
    .then((m) => {
      const file = m.file || '';
      text('#heroVer', `v${m.version}`);
      text('#heroSize', m.size ? fmtSize(m.size) : '');
      text('#dlVer', `v${m.version}`);
      text('#dlSize', m.size ? fmtSize(m.size) : '');
      text('#mcVer', m.version);
      text('#mcSize', m.size ? fmtSize(m.size) : '');
      text('#mcDate', (m.at || '').slice(0, 10));
      text('#footVer', `v${m.version}`);
      if (m.notes) {
        const n = $('#dlNotes');
        if (n) n.textContent = m.notes;
      }
      if (m.sha256) {
        const code = $('#mcSha');
        if (code) {
          code.textContent = `${m.sha256.slice(0, 10)}…${m.sha256.slice(-6)}`;
          code.dataset.full = m.sha256;
          code.title = m.sha256;
        }
      }
      if (file) applyDownloadLinks(file);
      const st = $('#stat');
      if (st) { st.classList.add('ok'); st.innerHTML = '<i></i>服务在线 · 最新版已就绪'; }
    })
    .catch(() => {
      const st = $('#stat');
      if (st) { st.classList.add('bad'); st.innerHTML = '<i></i>版本信息暂时取不到'; }
    });

  $('#copySha')?.addEventListener('click', async (e) => {
    const code = $('#mcSha');
    const full = (code && (code.dataset.full || code.textContent)) || '';
    try {
      await navigator.clipboard.writeText(full);
      const b = e.currentTarget;
      const old = b.textContent;
      b.textContent = '已复制';
      setTimeout(() => (b.textContent = old), 1400);
    } catch { /* 忽略：不支持剪贴板 API 时保持原样 */ }
  });
  /* ───────────────── 演示台：真的状态机 ───────────────── */
  (() => {
    const stage = $('#stage');
    if (!stage) return;
    const isl = $('#isl');
    const ctrl = $$('.stage-ctrl .chip-btn');
    const styleBtns = $$('.sb-right .chip-btn');
    const tabs = $$('.p-tab', stage);
    const panes = $$('.p-pane', stage);
    const ring = $('#dRing');
    const val = $('#dVal');
    const RING = 2 * Math.PI * 17;

    let holdUntil = 0;
    let left = 25 * 60;

    function paint(state) {
      stage.dataset.state = state;
      ctrl.forEach((b) => b.classList.toggle('active', b.dataset.state === state));
    }

    // 用户一旦自己动过，就暂停自动演出 12 秒
    function hold() {
      holdUntil = Date.now() + 12000;
    }

    /* ── 自动演出：像一段循环播放的动图，模拟“有人在用” ── */
    const wall = $('.wall', stage);
    const cur = $('#cur');
    const cap = $('#demoStep');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    function say(t) {
      if (cap) cap.textContent = t;
    }

    // 把假光标移到某个元素中心（相对壁纸定位）
    function moveTo(node, dx = 0, dy = 0) {
      if (!cur || !wall || !node) return;
      const w = wall.getBoundingClientRect();
      const r = node.getBoundingClientRect();
      const x = r.left - w.left + r.width / 2 + dx;
      const y = r.top - w.top + Math.min(r.height / 2, 26) + dy;
      cur.style.transform = `translate(${x}px, ${y}px)`;
      cur.classList.add('on');
    }

    function moveAway() {
      if (!cur || !wall) return;
      const w = wall.getBoundingClientRect();
      cur.style.transform = `translate(${w.width - 96}px, ${w.height - 76}px)`;
      cur.classList.remove('on');
    }

    // 演出自己点的这一下不算“用户操作”（否则会把 autoPlay 挂起 12 秒）
    let scripting = false;

    async function click(node, dx = 0, dy = 0) {
      if (!node) {
        await sleep(400);
        return;
      }
      moveTo(node, dx, dy);
      await sleep(620);
      cur.classList.add('press');
      await sleep(160);
      cur.classList.remove('press');
      await sleep(120);
      scripting = true;
      node.click?.();
      scripting = false;
    }

    let alive = true;
    let storyTimer = 0;

    async function waitUser() {
      while (alive && Date.now() < holdUntil) await sleep(220);
    }

    function setPane(pane) {
      tabs.forEach((t) => t.classList.toggle('active', t.dataset.pane === pane));
      panes.forEach((p) => p.classList.toggle('on', p.dataset.pane === pane));
    }

    async function story() {
      if (!alive) return;
      if (reduced) {
        paint('idle');
        say('鼠标靠近就伸开，点一下进面板');
        return;
      }
      stage.dataset.style = 'island';
      styleBtns.forEach((x) => x.classList.toggle('active', x.dataset.style === 'island'));

      // ① 安静地挂在顶上
      paint('idle');
      setPane('mail');
      moveAway();
      say('平时它只是一条细细的时间');
      await sleep(1700);
      await waitUser();

      // ② 鼠标靠近 → 伸开
      moveTo($('.v-time', stage) || isl);
      await sleep(760);
      paint('compact');
      say('鼠标移上去 → 伸开成五个入口');
      await sleep(1600);
      await waitUser();

      // ③ 点「邮件」
      await click($$('.v-compact .quick', stage)[0]);
      paint('panel');
      setPane('mail');
      say('点「邮件」→ 面板展开，验证码 / 链接都变成可点的芯片');
      await sleep(2600);
      await waitUser();

      // ④ 切到 Qing 事项（待办圆圈）
      await click($('.p-tab[data-pane="notes"]', stage));
      setPane('notes');
      say('Qing 事项：待办一行一个圆圈，做完划掉变灰，钉到桌面也能勾');
      await sleep(2400);
      await waitUser();

      // ⑤ 切到小纸条
      await click($('.p-tab[data-pane="chat"]', stage));
      setPane('chat');
      say('切到小纸条：群里谁发了什么，图片和表情包直接看');
      await sleep(2200);
      await waitUser();

      // ⑥ 图片消息：把光标停在图上，讲清楚群里什么都能发
      moveTo($('.p-msg.them .p-bub.img', stage));
      say('图片、动图、表情包直接在群里看，点一下能铺满整屏');
      await sleep(2000);
      await waitUser();

      // ⑦ 小工具
      await click($('.p-tab[data-pane="tools"]', stage));
      setPane('tools');
      say('小工具：番茄钟、免打扰、系统小圆点，都是一眼能看懂的');
      await sleep(2200);
      await waitUser();

      // ⑧ 移开 → 收回；顺手弹一条通知
      moveAway();
      await sleep(420);
      paint('idle');
      say('不看的时候，它自己收回去');
      await sleep(1300);
      await waitUser();

      paint('peek');
      say('有新邮件 → 通知条把验证码顶到眼前，点一下就复制');
      await sleep(3000);
      await waitUser();

      paint('idle');
      await sleep(700);
    }

    async function loop() {
      for (;;) {
        if (!alive) return;
        await waitUser();
        try {
          await story();
        } catch (err) {
          // 演出里任何一步出错都不要把循环卡死
          await sleep(1200);
        }
      }
    }

    if (!qs.has('state')) {
      storyTimer = setTimeout(loop, 600);
    }

    ctrl.forEach((b) => {
      b.addEventListener('click', () => {
        hold();
        paint(b.dataset.state);
      });
    });

    styleBtns.forEach((b) => {
      b.addEventListener('click', () => {
        stage.dataset.style = b.dataset.style;
        styleBtns.forEach((x) => x.classList.toggle('active', x === b));
      });
    });
    styleBtns[0]?.classList.add('active');

    // 点岛：空闲 → 快捷 → 面板；再点面板空白处回空闲
    isl?.addEventListener('click', (e) => {
      if (scripting) return;
      hold();
      const tab = e.target.closest('.p-tab');
      if (tab) {
        tabs.forEach((t) => t.classList.toggle('active', t === tab));
        panes.forEach((p) => p.classList.toggle('on', p.dataset.pane === tab.dataset.pane));
        return;
      }
      const s = stage.dataset.state;
      if (s === 'idle') paint('compact');
      else if (s === 'compact' || s === 'peek') paint('panel');
    });

    // 鼠标移上去自己伸开，移开一会儿再收回去
    let enterT = 0;
    let leaveT = 0;
    const hoverZone = $('.wall', stage);
    hoverZone?.addEventListener('mouseenter', () => {
      clearTimeout(leaveT);
      if (stage.dataset.state !== 'idle') return;
      enterT = setTimeout(() => {
        if (stage.dataset.state === 'idle') paint('compact');
        hold();
      }, 180);
    });
    hoverZone?.addEventListener('mouseleave', () => {
      clearTimeout(enterT);
      leaveT = setTimeout(() => {
        if (Date.now() < holdUntil) return;
        if (stage.dataset.state === 'compact') paint('idle');
      }, 900);
    });

    // 计时环：每 4 秒走一格，循环
    setInterval(() => {
      left = left > 240 ? left - 7 : 25 * 60;
      const m = String(Math.floor(left / 60)).padStart(2, '0');
      const s = String(left % 60).padStart(2, '0');
      if (val) val.textContent = `${m}:${s}`;
      if (ring) ring.style.strokeDashoffset = String(RING * (1 - left / (25 * 60)));
    }, 4000);

    // 时钟跟随本机
    const tick = () => {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const t = `${hh}:${mm}`;
      const a = $('#dTime');
      const b = $('#dClock');
      if (a) a.textContent = t;
      if (b) b.textContent = t;
    };
    tick();
    setInterval(tick, 15000);

    // 支持 ?state=xxx 冻结在某一个状态（截图 / 分享用）
    const want = qs.get('state');
    const wantStyle = qs.get('style');
    if (wantStyle === 'notch' || wantStyle === 'island') {
      stage.dataset.style = wantStyle;
      styleBtns.forEach((x) => x.classList.toggle('active', x.dataset.style === wantStyle));
    }
    if (want && ['idle', 'compact', 'panel', 'peek'].includes(want)) {
      alive = false;
      paint(want);
    } else {
      paint('idle');
    }
  })();
})();
