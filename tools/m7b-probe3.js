(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  setTab('chat');
  await wait(60);
  setMode('panel', true);
  S.pointerIn = true;
  await wait(900);
  setMode('panel', true);
  await wait(200);
  const q = (s) => document.querySelector(s);
  const r = (el) => (el ? [Math.round(el.getBoundingClientRect().width), Math.round(el.getBoundingClientRect().height)] : null);
  return {
    state: document.getElementById('stage').dataset.state,
    island: r(q('#island')),
    side: r(q('.chat-side')),
    msgs: r(q('#chatMsgs')),
    chip: r(q('#chatRooms .room-chip')),
    chips: document.querySelectorAll('#chatRooms .room-chip').length,
    friends: document.querySelectorAll('#cpList .cp-chip').length,
    friendRows: [...document.querySelectorAll('#cpList .cp-chip')].map((x) => Math.round(x.getBoundingClientRect().width)),
    bubbles: document.querySelectorAll('#chatMsgs .msg').length,
    bubble: r(q('#chatMsgs .bub')),
    composerW: r(q('.chat-composer') && q('.chat-composer').getBoundingClientRect ? q('.chat-composer') : null)
  };
})()
