(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  setTab('chat');
  await wait(60);
  setMode('panel', true);
  S.pointerIn = true;
  await wait(700);

  const backupRooms = JSON.stringify(S.chat.rooms || []);
  const backupAcc = { signedIn: S.account.signedIn, friends: S.account.friends };

  // 造两个频道（只在内存里，测完还原）
  const base = (S.chat.rooms || [])[0] || {};
  S.chat.rooms = [
    { ...base, code: 'AAAAAAAAAAAA', nick: '频道 1', unread: 2 },
    { ...base, code: 'BBBBBBBBBBBB', nick: '频道 2', unread: 0 }
  ];
  chatRenderRooms();

  // 造三个好友
  S.account.signedIn = true;
  S.account.friends = [
    { id: 'u1', name: '老婆', username: 'wife', display: '老婆' },
    { id: 'u2', name: '大威天龙', username: 'dw', display: '大威天龙' },
    { id: 'u3', name: 'Cikian', username: 'cik', display: 'Cikian' }
  ];
  renderChatPeople();
  await wait(400);

  const q = (s) => document.querySelector(s);
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), r: Math.round(r.right), b: Math.round(r.bottom) };
  };
  const items = [...document.querySelectorAll('.chat-side .cs-head, .chat-side .room-chip, .chat-side .cp-chip')].map((el) => ({
    t: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 14),
    ...box(el)
  }));
  const overlaps = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b) overlaps.push([a.t, b.t]);
    }
  }
  const side = q('.chat-side');
  const out = {
    island: box(q('#island')),
    items,
    overlaps,
    sideScroll: side ? [side.scrollWidth, side.clientWidth, side.scrollHeight, side.clientHeight] : null
  };

  // 还原
  S.chat.rooms = JSON.parse(backupRooms);
  chatRenderRooms();
  chatPersist && chatPersist();
  S.account.signedIn = backupAcc.signedIn;
  S.account.friends = backupAcc.friends;
  renderChatPeople();
  return out;
})()
