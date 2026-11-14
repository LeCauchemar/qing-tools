(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  setTab('chat');
  await wait(60);
  setMode('panel', true);
  S.pointerIn = true;
  await wait(500);
  const q = (s) => document.querySelector(s);
  const rooms = q('#chatRoom');
  const gate = q('#chatGate');
  const hadRoom = rooms ? !rooms.classList.contains('hidden') : false;
  if (rooms) rooms.classList.add('hidden');
  gate.classList.remove('hidden');
  await wait(450);
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), r: Math.round(r.right), b: Math.round(r.bottom) };
  };
  const gb = box(gate);
  const inner = [...gate.querySelectorAll('input, button, .check, .gate-head, .gate-form')].map((el) => ({
    tag: el.tagName + (el.id ? '#' + el.id : '.' + String(el.className).split(' ')[0]),
    ...box(el)
  }));
  const overflow = inner.filter((b) => b && (b.r > gb.r + 1 || b.b > gb.b + 1)).map((b) => b.tag);
  const out = { island: box(q('#island')), gate: gb, gateScroll: [gate.scrollWidth, gate.clientWidth, gate.scrollHeight, gate.clientHeight], inner, overflow };
  gate.classList.add('hidden');
  if (rooms && hadRoom) rooms.classList.remove('hidden');
  await wait(200);
  return out;
})()
