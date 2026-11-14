(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  setTab('chat');
  await wait(80);
  setMode('panel', true);
  S.pointerIn = true;
  await wait(900);
  setMode('panel', true);
  await wait(200);
  const q = (s) => document.querySelector(s);
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), r: Math.round(r.right), b: Math.round(r.bottom) };
  };
  const island = q('#island');
  const ib = box(island);
  const nodes = [...document.querySelectorAll('.chat-side .cs-head, .chat-side .room-chip, .chat-side .cp-chip, .chat-main .members, .chat-main .composer')];
  const items = nodes.map((el) => ({ t: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 16), ...box(el) }));
  const overlaps = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b) overlaps.push([a.t, b.t]);
    }
  }
  const outside = items.filter((o) => o.r > ib.r + 1 || o.b > ib.b + 1 || o.x < ib.x - 1);
  return {
    v: S.data.meta.version,
    island: ib,
    cols: getComputedStyle(q('.chat-split')).gridTemplateColumns,
    side: box(q('.chat-side')),
    main: box(q('.chat-main')),
    items,
    overlaps,
    outside: outside.map((o) => o.t),
    rooms: (S.chat.rooms || []).map((r) => r.nick || r.name || ''),
    unread: (S.chat.rooms || []).map((r) => r.unread || 0)
  };
})()
