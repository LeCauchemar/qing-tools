(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  setTab('chat');
  await wait(60);
  setMode('panel', true);
  S.pointerIn = true;
  await wait(600);
  const backup = JSON.stringify(S.chat.rooms || []);
  S.chat.rooms = [];
  chatRenderRooms();
  await wait(500);
  const q = (s) => document.querySelector(s);
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), r: Math.round(r.right), b: Math.round(r.bottom) };
  };
  const gate = q('#chatGate');
  const gb = box(gate);
  const inner = [...gate.querySelectorAll('input, button, .check')].map((el) => ({ tag: el.tagName + (el.id ? '#' + el.id : ''), ...box(el) }));
  const overflow = inner.filter((b) => b && (b.r > gb.r + 1 || b.b > gb.b + 1)).map((b) => b.tag);
  const out = { island: box(q('#island')), gate: gb, side: box(q('.chat-side')), gateScroll: [gate.scrollWidth, gate.clientWidth, gate.scrollHeight, gate.clientHeight], inner, overflow };
  S.chat.rooms = JSON.parse(backup);
  chatRenderRooms();
  chatPersist && chatPersist();
  await wait(300);
  return out;
})()
