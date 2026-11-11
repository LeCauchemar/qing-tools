(async () => {
  const room = S.chat.rooms[0];
  setMode('idle'); await new Promise((r) => setTimeout(r, 300));
  chatPushMessage(room, { id: 'm-plain-1', kind: 'text', text: '晚上七点老地方见，别迟到', deviceId: 'peerX', deviceName: 'peer-nudger', mentions: [], at: Date.now() });
  await new Promise((r) => setTimeout(r, 250));
  const t = document.getElementById('peekTitle');
  return JSON.stringify({ mode: S.mode, rainbow: document.getElementById('stage').classList.contains('rainbow-peek'), titleColor: getComputedStyle(t).color, subColor: getComputedStyle(document.getElementById('peekSub')).color });
})()
