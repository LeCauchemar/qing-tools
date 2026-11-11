(async () => {
  applyStyle('island'); applyTheme('light'); setPinned(false); setMode('idle');
  await new Promise((r) => setTimeout(r, 500));
  const room = S.chat.rooms[0];
  chatPushMessage(room, { id: 'm-nudge-2', kind: 'nudge', text: '', deviceId: 'peerX', deviceName: 'peer-nudger', mentions: [room.deviceId], at: Date.now() }, true);
  await new Promise((r) => setTimeout(r, 120));
  document.getElementById('island').style.animationPlayState = 'paused';
  return JSON.stringify({ mode: S.mode, shake: document.getElementById('island').classList.contains('shake') });
})()
