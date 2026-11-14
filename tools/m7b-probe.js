(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  setTab('chat');
  await wait(60);
  setMode('panel', true);
  S.pointerIn = true;
  await wait(900);
  const q = (s) => document.querySelector(s);
  const split = q('.chat-split');
  const side = q('.chat-side');
  const island = q('#island');
  return {
    state: document.getElementById('stage').dataset.state,
    cols: split ? getComputedStyle(split).gridTemplateColumns : '',
    island: island ? [Math.round(island.getBoundingClientRect().width), Math.round(island.getBoundingClientRect().height)] : null,
    sideW: side ? Math.round(side.getBoundingClientRect().width) : 0,
    gateVisible: !q('#chatGate').classList.contains('hidden'),
    rooms: document.querySelectorAll('#chatRooms .room-chip').length,
    msgs: document.querySelectorAll('#chatMsgs .msg').length
  };
})()
