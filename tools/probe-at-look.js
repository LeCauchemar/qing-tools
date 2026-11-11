(async () => {
  const room = S.chat.rooms[0];
  setMode('idle'); await new Promise((r) => setTimeout(r, 300));
  chatPushMessage(room, { id: 'm-at-2', kind: 'text', text: '@chenyuqing-life 这个周末一起出去转转？', deviceId: 'peerX', deviceName: 'peer-nudger', mentions: [room.deviceId], at: Date.now() });
  await new Promise((r) => setTimeout(r, 250));
  return JSON.stringify({ mode: S.mode, rainbow: document.getElementById('stage').classList.contains('rainbow-peek'), rainbowIsland: document.getElementById('island').classList.contains('rainbow'), title: document.getElementById('peekTitle').textContent, sub: document.getElementById('peekSub').textContent });
})()
