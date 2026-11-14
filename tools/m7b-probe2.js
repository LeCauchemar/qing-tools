(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  setTab('chat');
  await wait(80);
  if (!(S.chat.rooms || []).length) {
    await chatCreate();
    await wait(900);
  }
  out.room = (S.chat.rooms || [])[0] ? { code: S.chat.rooms[0].code, name: S.chat.rooms[0].nick } : null;
  setMode('panel', true);
  S.pointerIn = true;
  await wait(300);
  const texts = ['左侧是频道和好友', '右边这条是消息区，宽度 460', '元素不再挤在一起了'];
  for (const t of texts) {
    await chatPost('text', t, null, null, []);
    await wait(260);
  }
  await wait(800);
  const q = (s) => document.querySelector(s);
  const side = q('.chat-side');
  const msgs = q('#chatMsgs');
  const island = q('#island');
  out.layout = {
    island: [Math.round(island.getBoundingClientRect().width), Math.round(island.getBoundingClientRect().height)],
    sideW: Math.round(side.getBoundingClientRect().width),
    msgsW: Math.round(msgs.getBoundingClientRect().width),
    msgsH: Math.round(msgs.getBoundingClientRect().height),
    chips: document.querySelectorAll('#chatRooms .room-chip').length,
    chipW: (() => {
      const c = q('#chatRooms .room-chip');
      return c ? Math.round(c.getBoundingClientRect().width) : 0;
    })(),
    friends: document.querySelectorAll('#cpList .cp-chip').length,
    friendRows: [...document.querySelectorAll('#cpList .cp-chip')].map((x) => Math.round(x.getBoundingClientRect().width)),
    msgCount: document.querySelectorAll('#chatMsgs .msg').length,
    bubbleW: (() => {
      const b = q('#chatMsgs .bub');
      return b ? Math.round(b.getBoundingClientRect().width) : 0;
    })()
  };
  return out;
})()
