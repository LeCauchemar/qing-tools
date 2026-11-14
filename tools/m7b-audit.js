(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  setTab('chat');
  await wait(60);
  setMode('panel', true);
  S.pointerIn = true;
  await wait(900);
  setMode('panel', true);
  await wait(250);

  const q = (s) => document.querySelector(s);
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), r: Math.round(r.right), b: Math.round(r.bottom) };
  };
  const island = q('#island');
  const ib = box(island);
  const side = q('.chat-side');
  const main = q('.chat-main');
  const items = [...document.querySelectorAll('.chat-side .cs-head, .chat-side .room-chip, .chat-side .cp-chip')].map((el) => ({
    cls: el.className,
    text: (el.textContent || '').trim().slice(0, 12),
    ...box(el)
  }));
  let overlaps = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b) overlaps.push([a.text, b.text]);
    }
  }
  const msgs = q('#chatMsgs');
  return {
    state: document.getElementById('stage').dataset.state,
    island: ib,
    side: box(side),
    main: box(main),
    sideScroll: side ? [side.scrollWidth, side.clientWidth, side.scrollHeight, side.clientHeight] : null,
    sideItems: items,
    overlaps,
    msgsBox: box(msgs),
    msgsScroll: msgs ? [msgs.scrollHeight, msgs.clientHeight] : null,
    members: box(q('#chatMembers')),
    composer: box(q('.chat-composer')),
    gateHidden: q('#chatGate').classList.contains('hidden'),
    signed: S.account.signedIn,
    friends: (S.account.friends || []).length,
    requests: (S.account.requests || []).length,
    cpHidden: q('#chatPeople').classList.contains('hidden'),
    gateBox: box(q('#chatGate'))
  };
})()
